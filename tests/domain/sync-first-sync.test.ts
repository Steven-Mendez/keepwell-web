import "fake-indexeddb/auto"

import { Dexie } from "dexie"
import { beforeEach, describe, expect, it } from "vitest"

import { db, SETTINGS_ID, type AccountRow, type SettingsRow } from "@/lib/db"
import { categoryRepository, eraseAllData } from "@/lib/repositories"
import type { SyncEntity } from "@/lib/schema"
import { ChoiceNeeded, keepBrowserData, pendingChoice, statusAfter, syncOnce, takeAccountData } from "@/lib/sync/engine"
import { EMPTY_COUNTS, firstSyncDecision } from "@/lib/sync/first-sync"
import { restoreFromAccount } from "@/lib/sync/restore"
import type { PulledChange, PushResult, SyncTransport } from "@/lib/sync/transport"

type Row = PulledChange["row"]

/** An in-memory account with the API's rules (ADR 0005, `decide` in keepwell-api). */
class FakeServer implements SyncTransport {
  rows = new Map<string, Row>()
  log: (PulledChange & { client: string })[] = []
  calls = { push: 0, pull: 0, snapshot: 0 }

  write(entity: SyncEntity, row: Row, client = "other-device") {
    const key = `${entity}:${row.id}`
    const existing = this.rows.get(key)
    if (existing?.deleted_at) return { status: "stale" as const, current: existing }
    if (existing && !row.deleted_at && row.updated_at < existing.updated_at) return { status: "stale" as const, current: existing }
    this.rows.set(key, row)
    this.log.push({ server_seq: this.log.length + 1, entity, entity_id: row.id, operation: row.deleted_at ? "delete" : "update", row, client })
    return { status: "applied" as const, server_seq: this.log.length, updated_at: row.updated_at }
  }

  live(entity: SyncEntity): Row[] {
    return [...this.rows].filter(([key, row]) => key.startsWith(`${entity}:`) && !row.deleted_at).map(([, row]) => row)
  }

  async push(body: { client_id: string; events: unknown[] }) {
    this.calls.push++
    const results: PushResult[] = (body.events as { event_id: string; entity: SyncEntity; payload: Row }[]).map((event) => ({ event_id: event.event_id, ...this.write(event.entity, event.payload, body.client_id) }))
    return { results, partial: false }
  }

  async pull(clientId: string, cursor: number) {
    this.calls.pull++
    const changes = this.log.filter((change) => change.server_seq > cursor && change.client !== clientId)
    return { changes, next_cursor: this.log.length, has_more: false }
  }

  async snapshot(entity: SyncEntity) {
    this.calls.snapshot++
    const rows = [...this.rows].filter(([key]) => key.startsWith(`${entity}:`)).map(([, row]) => row)
    return { rows, server_seq: this.log.length, next_after: null }
  }
}

const at = (minute: number) => new Date(Date.UTC(2026, 10, 1, 10, minute)).toISOString()

const account = (id: string, name: string, minute = 1): AccountRow & Row => ({
  id, name, bank: null, kind: "cash", opening_balances: [{ amount: "0", currency: "USD" }], opening_date: at(0), debt_mode: null,
  limit_amount: null, limit_currency: null, cutoff_day: null, due_day: null, created_at: at(minute), updated_at: at(minute), deleted_at: null,
})

const settings = (principal: string, minute = 1): SettingsRow & Row => ({
  id: SETTINGS_ID, principal, second: null, rate: "1", unlock_method: "disabled", relock_after_seconds: 60, hides_amounts_in_app_switcher: true,
  is_icloud_backup_enabled: false, payment_reminder_days_before: 3, has_completed_onboarding: true, created_at: at(minute), updated_at: at(minute), deleted_at: null,
})

const category = (id: string, name: string, minute: number): Row => ({
  id, name, kind: "expense", icon: null, color: null, is_renamed: true, sort_index: 0, budget_amount: null, budget_currency: null,
  created_at: at(0), updated_at: at(minute), deleted_at: null,
})

/** This browser after a local-only onboarding: seeded categories, settings and an account. */
async function localLedger(...names: string[]) {
  await categoryRepository.ensureDefaults()
  await db.settings.put(settings("USD"))
  for (const name of names) await db.accounts.put(account(`local-${name}`, name))
}

/** An account whose cloud already has another ledger, written by another device. */
function cloudLedger(server: FakeServer, ...names: string[]) {
  server.write("settings", settings("EUR"))
  server.write("category", category("groceries", "Súper", 2))
  for (const name of names) server.write("account", account(`cloud-${name}`, name))
}

const USER = "user-1"

beforeEach(async () => {
  db.close()
  await Dexie.delete("keepwell")
  await db.open()
})

describe("first sync decision", () => {
  const some = { ...EMPTY_COUNTS, transaction: 3 }
  const categoriesOnly = { ...EMPTY_COUNTS }

  it("asks only when both sides hold the person's data", () => {
    expect(firstSyncDecision(some, { ...EMPTY_COUNTS, account: 1 })).toBe("choose")
    expect(firstSyncDecision(some, categoriesOnly)).toBe("upload")
    expect(firstSyncDecision(categoriesOnly, { ...EMPTY_COUNTS, loanPayment: 1 })).toBe("download")
    expect(firstSyncDecision(categoriesOnly, categoriesOnly)).toBe("merge")
  })

  it("uploads a local-only ledger to an account without data, as before", async () => {
    const server = new FakeServer()
    server.write("category", category("rent", "Alquiler", 1))
    await localLedger("Wallet")
    await syncOnce(server, { userId: USER })
    expect(server.live("account").map((row) => row.name)).toEqual(["Wallet"])
    expect((await db.categories.get("rent"))?.name).toBe("Alquiler")
    expect(await pendingChoice()).toBeUndefined()
  })

  it("downloads an account's data into a browser without any, without pushing the browser's seeded rows", async () => {
    const server = new FakeServer()
    cloudLedger(server, "Bank")
    await categoryRepository.ensureDefaults()
    const pushedBefore = server.log.length
    await syncOnce(server, { userId: USER })
    expect((await db.accounts.toArray()).map((row) => row.name)).toEqual(["Bank"])
    expect((await db.categories.get("groceries"))?.name).toBe("Súper")
    expect(server.log.length).toBe(pushedBefore)
    expect((await db.settings.get(SETTINGS_ID))?.principal).toBe("EUR")
  })

  it("pauses when both sides have data: nothing pushed or pulled, and it asks again without the network", async () => {
    const server = new FakeServer()
    cloudLedger(server, "Bank", "Savings")
    await localLedger("Wallet")
    const logBefore = server.log.length
    const error = await syncOnce(server, { userId: USER }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ChoiceNeeded)
    expect((error as ChoiceNeeded).choice).toMatchObject({ userId: USER, local: { account: 1 }, cloud: { account: 2 } })
    expect(server.log.length).toBe(logBefore)
    expect(server.calls.push + server.calls.pull).toBe(0)
    expect((await db.accounts.toArray()).map((row) => row.name)).toEqual(["Wallet"])

    const calls = { ...server.calls }
    await expect(syncOnce(server, { userId: USER })).rejects.toBeInstanceOf(ChoiceNeeded)
    expect(server.calls).toEqual(calls)
    expect(await statusAfter(error)).toMatchObject({ state: "needs_choice" })
  })

  it("two syncs at once never mistake a half-done download for this browser's data", async () => {
    const server = new FakeServer()
    cloudLedger(server, "Bank")
    for (let i = 0; i < 5; i++) server.write("transaction", { ...category(`t${i}`, "x", 3), kind: "expense" } as Row)
    await categoryRepository.ensureDefaults()
    await Promise.all([syncOnce(server, { userId: USER }), syncOnce(server, { userId: USER })])
    expect(await pendingChoice()).toBeUndefined()
    expect(await db.transactions.count()).toBe(5)
  })

  it("starts a download that stopped halfway again instead of asking", async () => {
    const server = new FakeServer()
    cloudLedger(server, "Bank")
    for (let i = 0; i < 3; i++) server.write("transaction", { ...category(`t${i}`, "x", 3), kind: "expense" } as Row)
    let failed = false
    const flaky: SyncTransport = {
      push: server.push.bind(server),
      pull: server.pull.bind(server),
      // Fails once, after the accounts came down: the probe passes, the download stops halfway.
      snapshot: (entity) => {
        if (entity === "transaction" && server.calls.snapshot > 12 && !failed) {
          failed = true
          return Promise.reject(new TypeError("offline"))
        }
        return server.snapshot(entity)
      },
    }
    await expect(syncOnce(flaky, { userId: USER })).rejects.toThrow("offline")
    expect(await db.accounts.count()).toBe(1)
    await syncOnce(flaky, { userId: USER })
    expect(await pendingChoice()).toBeUndefined()
    expect(await db.transactions.count()).toBe(3)
  })

  it("never asks on later syncs", async () => {
    const server = new FakeServer()
    await localLedger("Wallet")
    await syncOnce(server, { userId: USER })
    server.write("account", account("cloud-Bank", "Bank", 30))
    await syncOnce(server, { userId: USER })
    expect((await db.accounts.toArray()).map((row) => row.name).sort()).toEqual(["Bank", "Wallet"])
  })

  it("starts over with another account", async () => {
    const first = new FakeServer()
    await localLedger("Wallet")
    await syncOnce(first, { userId: USER })
    const second = new FakeServer()
    cloudLedger(second, "Bank")
    await expect(syncOnce(second, { userId: "user-2" })).rejects.toBeInstanceOf(ChoiceNeeded)
  })
})

describe("resolving the first sync", () => {
  it("“Use your account's data” replaces this browser's data with the account's", async () => {
    const server = new FakeServer()
    cloudLedger(server, "Bank")
    await localLedger("Wallet")
    await syncOnce(server, { userId: USER }).catch(() => undefined)
    await db.meta.put({ key: "client_id", value: "browser" })

    await takeAccountData()
    await syncOnce(server, { userId: USER })

    expect((await db.accounts.toArray()).map((row) => row.name)).toEqual(["Bank"])
    expect((await db.settings.get(SETTINGS_ID))?.principal).toBe("EUR")
    // Device-only settings and the client id stay.
    expect((await db.settings.get(SETTINGS_ID))?.unlock_method).toBe("disabled")
    expect((await db.meta.get("client_id"))?.value).toBe("browser")
    expect(server.live("account").map((row) => row.name)).toEqual(["Bank"])
    expect(await db.sync_outbox.count()).toBe(0)
    expect(await pendingChoice()).toBeUndefined()
  })

  it("“Keep this browser's data” deletes the account's rows through the push and makes this browser's win", async () => {
    const server = new FakeServer()
    cloudLedger(server, "Bank", "Savings")
    // A row both sides have, newer in the account: this browser's must still win.
    server.write("category", category("housing", "Rent (cloud)", 50))
    await localLedger("Wallet")
    await db.categories.update("housing", { name: "Rent (here)", updated_at: at(5) })
    await syncOnce(server, { userId: USER }).catch(() => undefined)

    await keepBrowserData(server)
    await syncOnce(server, { userId: USER })

    expect(server.live("account").map((row) => row.name)).toEqual(["Wallet"])
    expect(server.rows.get("account:cloud-Bank")?.deleted_at).not.toBeNull()
    expect(server.rows.get("category:housing")?.name).toBe("Rent (here)")
    expect(server.rows.get("settings:settings")?.principal).toBe("USD")
    expect(server.live("category").length).toBe(await db.categories.filter((row) => row.deleted_at === null).count())
    expect(await db.sync_outbox.count()).toBe(0)
    expect((await db.accounts.toArray()).map((row) => row.name)).toEqual(["Wallet"])

    // Another device following the account gets the deletions in its normal pull.
    const deletes = (await server.pull("other-phone", 0)).changes.filter((change) => change.operation === "delete").map((change) => change.entity_id)
    expect(deletes).toEqual(expect.arrayContaining(["cloud-Bank", "cloud-Savings"]))
  })
})

describe("Delete all my data", () => {
  it("forgets the sync cursor so a signed-in browser starts over, keeping its client id", async () => {
    const server = new FakeServer()
    cloudLedger(server, "Bank")
    await db.meta.put({ key: "client_id", value: "browser" })
    await syncOnce(server, { userId: USER })
    await eraseAllData()
    expect(await db.meta.get("sync_cursor")).toBeUndefined()
    expect((await db.meta.get("client_id"))?.value).toBe("browser")
    await syncOnce(server, { userId: USER })
    expect((await db.accounts.toArray()).map((row) => row.name)).toEqual(["Bank"])
  })
})

describe("signing in on the welcome", () => {
  const me = { user: { id: USER, name: "Ana", email: "ana@example.com" }, capabilities: ["cloud_sync" as const] }

  it("restores an account with data and ends onboarding", async () => {
    const server = new FakeServer()
    cloudLedger(server, "Bank")
    await categoryRepository.ensureDefaults()
    expect(await restoreFromAccount(me, server)).toBe(true)
    expect((await db.accounts.toArray()).map((row) => row.name)).toEqual(["Bank"])
  })

  it("keeps onboarding for an account without data, even with finished settings from another device", async () => {
    const server = new FakeServer()
    server.write("settings", settings("EUR"))
    await categoryRepository.ensureDefaults()
    expect(await restoreFromAccount(me, server)).toBe(false)
    // Nothing synced yet: the account's settings would end the setup halfway.
    expect(await db.settings.get(SETTINGS_ID)).toBeUndefined()
    expect(server.calls.push + server.calls.pull).toBe(0)
  })

  it("keeps onboarding without cloud sync or when the account can't be reached", async () => {
    expect(await restoreFromAccount({ ...me, capabilities: [] }, new FakeServer())).toBe(false)
    const offline: SyncTransport = { push: () => Promise.reject(new TypeError("offline")), pull: () => Promise.reject(new TypeError("offline")), snapshot: () => Promise.reject(new TypeError("offline")) }
    expect(await restoreFromAccount(me, offline)).toBe(false)
  })
})
