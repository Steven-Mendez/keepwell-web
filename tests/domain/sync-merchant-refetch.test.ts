// A browser that synced with the build before merchants, then got this one (Dexie version 8). The API
// shipped merchants first: the older build's snapshot never asked for `merchant` rows, and each save it
// made rewrote a movement or rule without the links the server holds. This build sends both links on
// every save (null for none), so it downloads them once before its first push.
import "fake-indexeddb/auto"

import { Dexie } from "dexie"
import { beforeEach, describe, expect, it } from "vitest"

import { db, MERCHANT_REFETCH_KEY } from "@/lib/db"
import { KeepwellDatabase } from "@/lib/db/database"
import { saveCategorizationRule } from "@/lib/domain"
import { categoryRepository, ledgerStore, transactionRepository } from "@/lib/repositories"
import type { SyncEntity } from "@/lib/schema"
import { syncOnce } from "@/lib/sync/engine"
import type { PulledChange, PushResult, SyncTransport } from "@/lib/sync/transport"

type Row = PulledChange["row"]

/** The API's rules (ADR 0005) in memory, plus "another device" (MCP) writing and a snapshot counter. */
class FakeServer implements SyncTransport {
  rows = new Map<string, Row>()
  log: PulledChange[] = []
  snapshots: SyncEntity[] = []

  write(entity: SyncEntity, row: Row) {
    const key = `${entity}:${row.id}`
    const existing = this.rows.get(key)
    if (existing?.deleted_at) return { status: "stale" as const, current: existing }
    if (existing && !row.deleted_at && row.updated_at < existing.updated_at) return { status: "stale" as const, current: existing }
    // Like keepwell-api's `decide`: an optional link column a client leaves out keeps the stored one.
    const kept = Object.fromEntries(["merchant_id", "via_merchant_id"].filter((column) => existing && !(column in row) && column in existing).map((column) => [column, existing![column]]))
    const stored = { ...row, ...kept }
    this.rows.set(key, stored)
    this.log.push({ server_seq: this.log.length + 1, entity, entity_id: row.id, operation: row.deleted_at ? "delete" : "update", row: stored })
    return { status: "applied" as const, server_seq: this.log.length, updated_at: row.updated_at }
  }

  async push(body: { events: unknown[] }) {
    const results: PushResult[] = (body.events as { event_id: string; entity: SyncEntity; payload: Row }[]).map((event) => ({ event_id: event.event_id, ...this.write(event.entity, event.payload) }))
    return { results, partial: false }
  }

  async pull(_client: string, cursor: number) {
    return { changes: this.log.filter((change) => change.server_seq > cursor), next_cursor: this.log.length, has_more: false }
  }

  async snapshot(entity: SyncEntity) {
    this.snapshots.push(entity)
    const rows = [...this.rows].filter(([key]) => key.startsWith(`${entity}:`)).map(([, row]) => row)
    return { rows, server_seq: this.log.length, next_after: null }
  }
}

const at = (minute: number) => new Date(Date.UTC(2026, 10, 1, 10, minute)).toISOString()
/** After anything this browser stamped (the repositories stamp with the clock). */
const later = (minute: number) => new Date(Date.now() + minute * 60_000).toISOString()
const MERCHANT = "00000000-0000-4000-8000-0000000000aa"
const PLATFORM = "00000000-0000-4000-8000-0000000000bb"
const merchant = (id: string, name: string, isPlatform = false): Row => ({
  id, name, domain: null, brand_id: null, default_category_id: null, is_platform: isPlatform, created_at: at(2), updated_at: at(2), deleted_at: null,
})

const expense = {
  date: at(1), status: "confirmed" as const, description: "Croquetas", kind: "expense" as const, categoryId: "other-expense", amount: "12.50", currency: "USD",
  accountId: "00000000-0000-4000-8000-000000000001", exchangeRate: { principal: "USD", second: "NIO", rate: "36.6" }, isShared: false,
}

/**
 * A movement synced before merchants, which MCP then linked on the server, while this browser still
 * ran the older build: its row lacks the link columns (the older build rewrote it, or never got the
 * merchant), its cursor is past the links, and the version 8 upgrade listed it.
 */
async function olderBuildState(server: FakeServer) {
  const movement = await transactionRepository.save(expense)
  await syncOnce(server)
  server.write("merchant", merchant(MERCHANT, "Uber Eats"))
  server.write("merchant", merchant(PLATFORM, "App Store", true))
  server.write("transaction", { ...server.rows.get(`transaction:${movement.id}`)!, merchant_id: MERCHANT, via_merchant_id: PLATFORM, updated_at: later(3) })
  const { merchant_id: _m, via_merchant_id: _v, ...withoutLinks } = (await db.transactions.get(movement.id))!
  await db.transactions.put({ ...withoutLinks, updated_at: later(3) })
  await db.meta.put({ key: "sync_cursor", value: String(server.log.length) })
  await db.meta.put({ key: MERCHANT_REFETCH_KEY, value: JSON.stringify({ transaction: [movement.id], recurringRule: [], categorizationRule: [] }) })
  return movement
}

beforeEach(async () => {
  db.close()
  await Dexie.delete("keepwell")
  await db.open()
})

describe("re-downloading merchants after the upgrade to version 8", () => {
  it("keeps the server's links when this build saves a movement it got from the older build", async () => {
    const server = new FakeServer()
    const movement = await olderBuildState(server)
    // Saved here before the first sync: the row had no links, so this build writes null for both.
    await transactionRepository.save({ ...(await transactionRepository.list()).find((row) => row.id === movement.id)!, note: "Martes" })
    expect((await db.sync_outbox.toArray())[0]?.payload).toMatchObject({ merchant_id: null, via_merchant_id: null })

    await syncOnce(server)

    expect(server.rows.get(`transaction:${movement.id}`)).toMatchObject({ note: "Martes", merchant_id: MERCHANT, via_merchant_id: PLATFORM })
    expect(await db.transactions.get(movement.id)).toMatchObject({ note: "Martes", merchant_id: MERCHANT, via_merchant_id: PLATFORM })
    expect((await db.merchants.toArray()).map((row) => row.name).sort()).toEqual(["App Store", "Uber Eats"])
    expect(await db.meta.get(MERCHANT_REFETCH_KEY)).toBeUndefined()
  })

  it("gives a movement without a pending change the server's links and pushes nothing for it", async () => {
    const server = new FakeServer()
    const movement = await olderBuildState(server)
    const before = server.log.length

    expect(await syncOnce(server)).toMatchObject({ pushed: 0 })

    expect(await db.transactions.get(movement.id)).toMatchObject({ merchant_id: MERCHANT, via_merchant_id: PLATFORM, note: null })
    expect(server.log.length).toBe(before)
    // A later save here sends the links it now knows.
    await transactionRepository.save({ ...(await transactionRepository.list()).find((row) => row.id === movement.id)!, note: "Jueves" })
    await syncOnce(server)
    expect(server.rows.get(`transaction:${movement.id}`)).toMatchObject({ note: "Jueves", merchant_id: MERCHANT, via_merchant_id: PLATFORM })
  })

  it("keeps a pending change's own links: one chosen here, or a removal of a link this browser had", async () => {
    const server = new FakeServer()
    const movement = await olderBuildState(server)
    // The upgrade found the link columns on this row (the older build stored the pulled row as is),
    // so the null the person saves now is theirs.
    await db.meta.put({ key: MERCHANT_REFETCH_KEY, value: JSON.stringify({ transaction: [], recurringRule: [], categorizationRule: [] }) })
    await db.transactions.put({ ...(await db.transactions.get(movement.id))!, merchant_id: MERCHANT, via_merchant_id: PLATFORM })
    const { merchantId: _m, viaMerchantId: _v, ...unlinked } = (await transactionRepository.list()).find((row) => row.id === movement.id)!
    await transactionRepository.save(unlinked)

    await syncOnce(server)

    expect(server.rows.get(`transaction:${movement.id}`)).toMatchObject({ merchant_id: null, via_merchant_id: null })
    expect(await db.transactions.get(movement.id)).toMatchObject({ merchant_id: null, via_merchant_id: null })
  })

  it("never puts links on a movement this build turned into a transfer", async () => {
    const server = new FakeServer()
    const movement = await olderBuildState(server)
    const row = (await db.transactions.get(movement.id))!
    await db.transaction("rw", db.transactions, db.sync_outbox, async () => {
      const transfer = { ...row, kind: "transfer" as const, merchant_id: null, via_merchant_id: null, updated_at: later(4) }
      await db.transactions.put(transfer)
      await db.sync_outbox.add({ id: "e1", entity: "transaction", entity_id: row.id, operation: "update", payload: transfer, created_at: at(4) })
    })

    await syncOnce(server)

    expect(server.rows.get(`transaction:${movement.id}`)).toMatchObject({ kind: "transfer", merchant_id: null, via_merchant_id: null })
  })

  it("brings a categorization rule's business back when this build saves the rule", async () => {
    const server = new FakeServer()
    await olderBuildState(server)
    await categoryRepository.save({ id: "other-expense", name: "Other", kind: "expense", isRenamed: false })
    const rule = await saveCategorizationRule(ledgerStore, { match: "uber", categoryId: "other-expense", kind: "expense" })
    await syncOnce(server)
    server.write("categorizationRule", { ...server.rows.get(`categorizationRule:${rule.id}`)!, merchant_id: MERCHANT, updated_at: later(5) })
    const { merchant_id: _m, ...withoutLink } = (await db.categorization_rules.get(rule.id))!
    await db.categorization_rules.put({ ...withoutLink, updated_at: later(5) })
    await db.merchants.clear()
    await db.meta.put({ key: "sync_cursor", value: String(server.log.length) })
    await db.meta.put({ key: MERCHANT_REFETCH_KEY, value: JSON.stringify({ categorizationRule: [rule.id] }) })
    await saveCategorizationRule(ledgerStore, { id: rule.id, match: "uber eats", categoryId: "other-expense", kind: "expense" })

    await syncOnce(server)

    expect(server.rows.get(`categorizationRule:${rule.id}`)).toMatchObject({ match: "uber eats", merchant_id: MERCHANT })
    expect(await db.categorization_rules.get(rule.id)).toMatchObject({ match: "uber eats", merchant_id: MERCHANT })
  })

  it("happens once: later syncs read no snapshot", async () => {
    const server = new FakeServer()
    await olderBuildState(server)
    server.snapshots = []
    await syncOnce(server)
    expect(server.snapshots.sort()).toEqual(["categorizationRule", "merchant", "recurringRule", "transaction"])
    server.snapshots = []
    await syncOnce(server)
    expect(server.snapshots).toEqual([])
  })

  it("pushes nothing while the download fails, and changes nothing", async () => {
    const server = new FakeServer()
    const movement = await olderBuildState(server)
    await transactionRepository.save({ ...(await transactionRepository.list()).find((row) => row.id === movement.id)!, note: "Martes" })
    const offline: SyncTransport = { push: server.push.bind(server), pull: server.pull.bind(server), snapshot: async () => Promise.reject(new TypeError("Failed to fetch")) }

    await expect(syncOnce(offline)).rejects.toThrow("Failed to fetch")

    expect(server.rows.get(`transaction:${movement.id}`)).toMatchObject({ merchant_id: MERCHANT })
    expect(await db.sync_outbox.count()).toBe(1)
    expect(await db.meta.get(MERCHANT_REFETCH_KEY)).toBeDefined()
  })
})

describe("IndexedDB upgrade from version 7 (merchants)", () => {
  const V7_STORES = {
    accounts: "id, kind, created_at, updated_at, deleted_at",
    cards: "id, account_id, created_at, updated_at, deleted_at",
    categories: "id, kind, sort_index, updated_at, deleted_at",
    transactions: "id, date, account_id, card_id, category_id, recurring_id, [account_id+date], updated_at, deleted_at",
    recurring_rules: "id, account_id, next_date, updated_at, deleted_at",
    savings_goals: "id, updated_at, deleted_at",
    loans: "id, updated_at, deleted_at",
    personal_debts: "id, transaction_id, updated_at, deleted_at",
    categorization_rules: "id, sort_index, updated_at, deleted_at",
    loan_payments: "id, loan_id, updated_at, deleted_at",
    personal_debt_repayments: "id, debt_id, updated_at, deleted_at",
    meta: "key",
    notification_states: "id, updated_at, deleted_at",
    settings: "id",
    sync_outbox: "id, created_at, entity, entity_id",
  }

  async function openV7(seed: (v7: Dexie) => Promise<void>) {
    db.close()
    await Dexie.delete("keepwell")
    const v7 = new Dexie("keepwell")
    v7.version(7).stores(V7_STORES)
    await v7.open()
    await seed(v7)
    v7.close()
    const upgraded = new KeepwellDatabase()
    await upgraded.open()
    return upgraded
  }

  it("lists the rows without link columns on a browser that synced", async () => {
    const upgraded = await openV7(async (v7) => {
      await v7.table("meta").put({ key: "sync_cursor", value: "42" })
      await v7.table("transactions").bulkPut([
        { id: "t-old", deleted_at: null },
        { id: "t-pulled", merchant_id: "m1", via_merchant_id: null, deleted_at: null },
        { id: "t-gone", deleted_at: at(1) },
      ])
      await v7.table("recurring_rules").put({ id: "r-old", deleted_at: null })
      await v7.table("categorization_rules").bulkPut([{ id: "c-old", deleted_at: null }, { id: "c-pulled", merchant_id: null, deleted_at: null }])
    })
    expect(upgraded.verno).toBe(8)
    expect(JSON.parse((await upgraded.meta.get(MERCHANT_REFETCH_KEY))!.value)).toEqual({ transaction: ["t-old"], recurringRule: ["r-old"], categorizationRule: ["c-old"] })
    upgraded.close()
  })

  it("asks for nothing on a browser that never synced (its first sync downloads merchants)", async () => {
    const upgraded = await openV7(async (v7) => {
      await v7.table("transactions").put({ id: "t-old", deleted_at: null })
    })
    expect(await upgraded.meta.get(MERCHANT_REFETCH_KEY)).toBeUndefined()
    upgraded.close()
  })
})
