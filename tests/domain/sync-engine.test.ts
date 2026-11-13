import "fake-indexeddb/auto"

import { Dexie } from "dexie"
import { beforeEach, describe, expect, it } from "vitest"

import { db } from "@/lib/db"
import { ApiError } from "@/lib/api/client"
import { categoryRepository, transactionRepository } from "@/lib/repositories"
import { OTHER_EXPENSE_ID, type SyncEntity } from "@/lib/schema"
import { rejectedEvents, statusAfter, syncOnce } from "@/lib/sync/engine"
import type { PulledChange, PushResult, SyncTransport } from "@/lib/sync/transport"

type Row = PulledChange["row"]

/** A tiny in-memory server with the API's rules (ADR 0005), and a way for "another device" to write. */
class FakeServer implements SyncTransport {
  rows = new Map<string, Row>()
  log: PulledChange[] = []
  reject = new Set<string>()

  write(entity: SyncEntity, row: Row) {
    const key = `${entity}:${row.id}`
    const existing = this.rows.get(key)
    if (existing?.deleted_at) return { status: "stale" as const, current: existing }
    if (existing && !row.deleted_at && row.updated_at < existing.updated_at) return { status: "stale" as const, current: existing }
    this.rows.set(key, row)
    this.log.push({ server_seq: this.log.length + 1, entity, entity_id: row.id, operation: row.deleted_at ? "delete" : "update", row })
    return { status: "applied" as const, server_seq: this.log.length, updated_at: row.updated_at }
  }

  async push(body: { events: unknown[] }) {
    const results: PushResult[] = (body.events as { event_id: string; entity: SyncEntity; entity_id: string; payload: Row }[]).map((event) =>
      this.reject.has(event.entity_id) ? { event_id: event.event_id, status: "rejected", reason: "amount: Not an exact decimal" } : { event_id: event.event_id, ...this.write(event.entity, event.payload) }
    )
    return { results, partial: false }
  }

  async pull(_client: string, cursor: number) {
    const changes = this.log.filter((change) => change.server_seq > cursor)
    return { changes, next_cursor: this.log.length, has_more: false }
  }

  async snapshot(entity: SyncEntity) {
    const rows = [...this.rows].filter(([key]) => key.startsWith(`${entity}:`)).map(([, row]) => row)
    return { rows, server_seq: this.log.length, next_after: null }
  }
}

const at = (minute: number) => new Date(Date.UTC(2026, 10, 1, 10, minute)).toISOString()
const category = (id: string, name: string, minute: number, deleted = false): Row => ({
  id, name, kind: "expense", icon: null, color: null, is_renamed: false, sort_index: 0, budget_amount: null, budget_currency: null,
  created_at: at(0), updated_at: at(minute), deleted_at: deleted ? at(minute) : null,
})

const expense = (categoryId: string) => ({
  date: at(1), status: "confirmed" as const, description: "Croquetas", kind: "expense" as const, categoryId, amount: "12.50", currency: "USD",
  accountId: "00000000-0000-4000-8000-000000000001", exchangeRate: { principal: "USD", second: "NIO", rate: "36.6" }, isShared: false,
})

beforeEach(async () => {
  db.close()
  await Dexie.delete("keepwell")
  await db.open()
})

describe("web sync engine", () => {
  it("pushes the outbox, empties it, and the server holds the rows", async () => {
    const server = new FakeServer()
    await categoryRepository.save({ id: "custom-1", name: "Mascotas", kind: "expense", isRenamed: false })
    expect(await db.sync_outbox.count()).toBe(1)
    await syncOnce(server)
    expect(await db.sync_outbox.count()).toBe(0)
    expect(server.rows.get("category:custom-1")?.name).toBe("Mascotas")
  })

  it("applies another device's changes without echoing them back", async () => {
    const server = new FakeServer()
    await syncOnce(server)
    server.write("category", category("groceries", "From the iPhone", 5))
    await syncOnce(server)
    expect((await db.categories.get("groceries"))?.name).toBe("From the iPhone")
    expect(await db.sync_outbox.count()).toBe(0)
  })

  it("loads today's state with a snapshot on a new installation, then follows the log", async () => {
    const server = new FakeServer()
    server.write("category", category("groceries", "Super", 1))
    server.write("category", category("rent", "Alquiler", 2))
    await syncOnce(server)
    expect((await db.categories.toArray()).map((c) => c.id).sort()).toEqual(["groceries", "rent"])
    expect((await db.meta.get("sync_cursor"))?.value).toBe("2")
  })

  it("never overwrites a row that has a pending local change", async () => {
    const server = new FakeServer()
    await syncOnce(server)
    await categoryRepository.save({ id: "custom-1", name: "Mine", kind: "expense", isRenamed: false })
    const pushNothing: SyncTransport = { ...server, push: async () => ({ results: [], partial: false }), pull: server.pull.bind(server), snapshot: server.snapshot.bind(server) }
    server.write("category", category("custom-1", "Theirs", 1))
    await syncOnce(pushNothing)
    expect((await db.categories.get("custom-1"))?.name).toBe("Mine")
  })

  it("adopts the server's row when its own change lost", async () => {
    const server = new FakeServer()
    await syncOnce(server)
    await categoryRepository.save({ id: "custom-1", name: "Mine", kind: "expense", isRenamed: false })
    server.write("category", category("custom-1", "Newer elsewhere", 59))
    // Server rows stamped in the far future so the local change is older.
    server.rows.set("category:custom-1", { ...server.rows.get("category:custom-1")!, updated_at: "2999-01-01T00:00:00.000Z" })
    await syncOnce(server)
    expect((await db.categories.get("custom-1"))?.name).toBe("Newer elsewhere")
  })

  it("drops a rejected event from the outbox and lists it with the reason", async () => {
    const server = new FakeServer()
    server.reject.add("custom-1")
    await categoryRepository.save({ id: "custom-1", name: "Bad", kind: "expense", isRenamed: false })
    await syncOnce(server)
    expect(await db.sync_outbox.count()).toBe(0)
    expect(await rejectedEvents()).toMatchObject([{ entity: "category", entity_id: "custom-1", reason: "amount: Not an exact decimal" }])
    expect((await db.categories.get("custom-1"))?.name).toBe("Bad")
  })

  it("moves a movement edited here to Other when another device deleted its category meanwhile", async () => {
    const server = new FakeServer()
    await categoryRepository.save({ id: "custom-1", name: "Mascotas", kind: "expense", isRenamed: false })
    const movement = await transactionRepository.save(expense("custom-1"))
    await syncOnce(server)
    // The other device deletes the category, which moves the movement to "Other" there.
    const sent = server.rows.get(`transaction:${movement.id}`)!
    server.write("category", { ...server.rows.get("category:custom-1")!, updated_at: at(10), deleted_at: at(10) })
    server.write("transaction", { ...sent, category_id: OTHER_EXPENSE_ID, updated_at: at(10) })
    // Before pulling that, this browser edits the movement: its later edit wins and brings the id back.
    await transactionRepository.save({ ...movement, note: "Vet" })
    await syncOnce(server)

    const local = (await db.transactions.get(movement.id))!
    expect(local).toMatchObject({ category_id: OTHER_EXPENSE_ID, note: "Vet" })
    // The repair travels like any change, so the account and the other devices get it too.
    await syncOnce(server)
    expect(server.rows.get(`transaction:${movement.id}`)).toMatchObject({ category_id: OTHER_EXPENSE_ID, note: "Vet" })
  })

  it("repairs nothing, and enqueues nothing, when no movement points at a deleted category", async () => {
    const server = new FakeServer()
    await categoryRepository.save({ id: "custom-1", name: "Mascotas", kind: "expense", isRenamed: false })
    await categoryRepository.save({ id: "custom-2", name: "Plantas", kind: "expense", isRenamed: false })
    await transactionRepository.save(expense("custom-1"))
    await syncOnce(server)
    server.write("category", { ...server.rows.get("category:custom-2")!, updated_at: at(10), deleted_at: at(10) })
    await syncOnce(server)
    expect(await db.sync_outbox.count()).toBe(0)
  })

  it("stops on needs_plan and on a lost session, and treats network errors as offline", async () => {
    expect(await statusAfter(new ApiError(403, "needs_plan", "x"))).toEqual({ state: "needs_plan" })
    expect(await statusAfter(new ApiError(401, "unauthorized", "x"))).toEqual({ state: "signed_out" })
    expect((await statusAfter(new TypeError("Failed to fetch"))).state).toBe("offline")
  })
})
