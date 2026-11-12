import "fake-indexeddb/auto"

import { Dexie } from "dexie"
import { beforeEach, describe, expect, it } from "vitest"

import { BACKUP_FORMAT, BACKUP_VERSION, backupCounts, parseBackup, serializeBackup, type Backup } from "@/lib/backup/format"
import { db, SYNC_TABLES } from "@/lib/db"
import { restoreBackupFile } from "@/lib/platform/backup-file"
import { homeOverview, loadLedger } from "@/lib/domain/overviews"
import {
  categoryRepository,
  eraseAllData,
  exportBackup,
  importBackup,
  ledgerIsEmpty,
  ledgerStore,
  LedgerNotEmptyError,
  settingsRepository,
  transactionRepository,
} from "@/lib/repositories"
import { DEFAULT_SETTINGS, SYNC_ENTITIES, validateSyncEvent, type SyncEntity } from "@/lib/schema"

import { referenceDate, sampleData } from "./fixtures"

const at = "2026-10-01T18:00:00.000Z"
const loanId = "11111111-1111-4111-8111-111111111111"
const debtId = "22222222-2222-4222-8222-222222222222"

beforeEach(async () => {
  db.close()
  await Dexie.delete("keepwell")
  await db.open()
})

/** A ledger with something of every entity, a created category, a deleted default and a deleted movement. */
async function seedLedger() {
  const sample = sampleData()
  await categoryRepository.ensureDefaults()
  await settingsRepository.save({ ...sample.settings, unlockMethod: "passcode" })
  for (const account of sample.accounts) await ledgerStore.saveAccount(account)
  for (const card of sample.cards) await ledgerStore.saveCard(card)
  for (const transaction of sample.transactions) await ledgerStore.saveTransaction(transaction)
  await transactionRepository.remove(sample.transactions[0]!.id)
  await categoryRepository.save({ id: "custom-pets", name: "Pets", kind: "expense", isRenamed: false, icon: "pawprint", monthlyBudget: { amount: "40", currency: "USD" } })
  await categoryRepository.remove("gifts")
  await ledgerStore.saveRecurringRule({
    id: "33333333-3333-4333-8333-333333333333",
    name: "Gym",
    kind: "expense",
    categoryId: "custom-pets",
    amount: "25",
    currency: "USD",
    accountId: sample.accounts[0]!.id,
    frequency: "monthly",
    interval: 1,
    startDate: at,
    nextDate: at,
    isSubscription: true,
    autoConfirm: false,
    isPaused: false,
    tags: ["health"],
  })
  await ledgerStore.saveSavingsGoal({ id: "44444444-4444-4444-8444-444444444444", name: "Trip", target: { amount: "1500", currency: "USD" }, saved: "300", targetMonth: { month: 12, year: 2026 } })
  await ledgerStore.saveLoan({
    id: loanId,
    name: "Moto",
    borrowed: { amount: "1200", currency: "USD" },
    installmentAmount: "110",
    installmentCount: 12,
    frequency: "monthly",
    firstDueDate: at,
    payments: [{ number: 1, paidAt: at }],
  })
  await ledgerStore.savePersonalDebt({ id: debtId, person: "Ana", direction: "theyOweMe", amount: { amount: "50", currency: "USD" }, date: at, repayments: [{ amount: "20", date: at }] })
  await ledgerStore.saveCategorizationRule({ id: "55555555-5555-4555-8555-555555555555", match: "uber", categoryId: "transport", kind: "expense", tags: ["work"] })
}

/** Every stored row per entity, tombstones included, and the alive ones. */
async function counts() {
  const all: Record<string, [number, number]> = {}
  for (const entity of SYNC_ENTITIES) {
    const rows = (await db.table(SYNC_TABLES[entity]).toArray()) as { deleted_at: string | null }[]
    all[entity] = [rows.length, rows.filter((row) => row.deleted_at === null).length]
  }
  return all
}

async function netWorth() {
  const overview = homeOverview(await loadLedger(ledgerStore), referenceDate)
  return { netWorth: overview.netWorth, second: overview.netWorthInSecond }
}

/** "Delete all my data", then an onboarding that skips adding accounts. */
async function emptyAndOnboard() {
  await eraseAllData()
  await settingsRepository.save({ ...DEFAULT_SETTINGS, currencies: { principal: "EUR", second: "EUR", rate: "1" }, hasCompletedOnboarding: true })
}

describe("backup", () => {
  it("export, empty and import leaves the same ledger: net worth, rows per entity, settings", async () => {
    await seedLedger()
    const before = { counts: await counts(), netWorth: await netWorth(), categories: await categoryRepository.list(), rules: await ledgerStore.fetchRecurringRules() }
    const text = serializeBackup(await exportBackup())

    await emptyAndOnboard()
    expect(await ledgerIsEmpty()).toBe(true)
    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    await importBackup(parsed.backup)

    expect(await counts()).toEqual(before.counts)
    expect(await netWorth()).toEqual(before.netWorth)
    expect(await categoryRepository.list()).toEqual(before.categories)
    expect(await ledgerStore.fetchRecurringRules()).toEqual(before.rules)
    expect((await ledgerStore.fetchLoans())[0]!.payments.map((payment) => payment.number)).toEqual([1])
    expect((await ledgerStore.fetchPersonalDebts())[0]!.repayments.map((repayment) => repayment.amount)).toEqual(["20"])
    const settings = await settingsRepository.load()
    expect(settings?.currencies).toEqual(sampleData().settings.currencies)
    // This device's own choices never travel in a backup.
    expect(settings?.unlockMethod).toBe(DEFAULT_SETTINGS.unlockMethod)
    expect(settings?.hasCompletedOnboarding).toBe(true)
  })

  it("restores through the outbox: one valid event per row, parents first, stamped after the backup", async () => {
    await seedLedger()
    const backup = await exportBackup()
    await emptyAndOnboard()
    await db.sync_outbox.clear()
    const now = Date.parse("2027-01-01T00:00:00.000Z")
    await importBackup(backup, now)

    const events = await db.sync_outbox.orderBy("created_at").toArray()
    const rows = Object.values(backupCounts(backup)).reduce((sum, count) => sum + count, 0)
    expect(events).toHaveLength(rows)
    for (const event of events) {
      const result = validateSyncEvent({ event_id: event.id, entity: event.entity, entity_id: event.entity_id, operation: event.operation, payload: event.payload, created_at: event.created_at })
      expect(result.ok, JSON.stringify(result)).toBe(true)
      expect((event.payload as { updated_at: string }).updated_at >= new Date(now).toISOString()).toBe(true)
    }
    const order = events.map((event) => event.entity)
    expect(order[0]).toBe("settings")
    expect(order.lastIndexOf("account")).toBeLessThan(order.indexOf("card"))
    expect(order.lastIndexOf("loan")).toBeLessThan(order.indexOf("loanPayment"))
    expect(events.filter((event) => event.operation === "delete").map((event) => event.entity_id).sort()).toEqual(
      [sampleData().transactions[0]!.id, "gifts"].sort()
    )
    // The device-only settings columns stay out of the pushed row too.
    expect(events.find((event) => event.entity === "settings")!.payload).not.toHaveProperty("unlock_method")
  })

  it("only restores into an empty ledger, and writes nothing otherwise", async () => {
    await seedLedger()
    const backup = await exportBackup()
    const before = await counts()
    const outbox = await db.sync_outbox.count()
    expect(await ledgerIsEmpty()).toBe(false)
    await expect(importBackup(backup)).rejects.toBeInstanceOf(LedgerNotEmptyError)
    expect(await restoreBackupFile(new Blob([serializeBackup(backup)]))).toEqual({ ok: false, error: { code: "not_empty" } })
    expect(await counts()).toEqual(before)
    expect(await db.sync_outbox.count()).toBe(outbox)
  })

  it("counts as empty: shipped categories (even edited or deleted), settings; not: any data row, deleted ones too, or a created category", async () => {
    await categoryRepository.ensureDefaults()
    await settingsRepository.save({ ...DEFAULT_SETTINGS, hasCompletedOnboarding: true })
    await categoryRepository.save({ id: "groceries", name: "Food", kind: "expense", isRenamed: true })
    await categoryRepository.remove("gifts")
    expect(await ledgerIsEmpty()).toBe(true)

    await categoryRepository.save({ id: "custom-pets", name: "Pets", kind: "expense", isRenamed: false })
    await categoryRepository.remove("custom-pets")
    expect(await ledgerIsEmpty()).toBe(false)

    await eraseAllData()
    expect(await ledgerIsEmpty()).toBe(true)
    await ledgerStore.saveSavingsGoal({ id: "44444444-4444-4444-8444-444444444444", name: "Trip", target: { amount: "10", currency: "USD" }, saved: "0" })
    await ledgerStore.deleteSavingsGoal("44444444-4444-4444-8444-444444444444")
    expect(await ledgerIsEmpty()).toBe(false)
  })
})

describe("backup file", () => {
  const valid = async () => {
    await seedLedger()
    return JSON.parse(serializeBackup(await exportBackup())) as Backup & Record<string, unknown>
  }

  it("is versioned and holds every entity", async () => {
    const backup = await valid()
    expect(backup.format).toBe(BACKUP_FORMAT)
    expect(backup.version).toBe(BACKUP_VERSION)
    expect(Object.keys(backup.entities).sort()).toEqual([...SYNC_ENTITIES].sort())
  })

  it("rejects a damaged file whole and writes nothing", async () => {
    const backup = await valid()
    const transaction = backup.entities.transaction[3] as unknown as Record<string, unknown>
    transaction.amount = "12,50"
    await emptyAndOnboard()
    const before = await counts()
    const outbox = await db.sync_outbox.count()
    const text = JSON.stringify(backup)
    expect(parseBackup(text)).toEqual({ ok: false, error: { code: "invalid", reason: "transaction[3]: amount" } })
    expect(await restoreBackupFile(new Blob([text]))).toEqual({ ok: false, error: { code: "invalid", reason: "transaction[3]: amount" } })
    expect(await counts()).toEqual(before)
    expect(await db.sync_outbox.count()).toBe(outbox)
  })

  it.each<[string, (backup: Record<string, unknown> & { entities: Record<"account" | "settings" | "loan" | "card", unknown[]> }) => unknown, string]>([
    ["not JSON", () => "{ not json", "not_backup"],
    ["JSON of something else", () => ({ accounts: [] }), "not_backup"],
    ["a newer version", (backup) => ({ ...backup, version: BACKUP_VERSION + 1 }), "newer_version"],
    ["an unknown entity", (backup) => ({ ...backup, entities: { ...backup.entities, budget: [] } }), "invalid"],
    ["an entity that isn't a list", (backup) => ({ ...backup, entities: { ...backup.entities, card: {} } }), "invalid"],
    ["two rows with one id", (backup) => ({ ...backup, entities: { ...backup.entities, account: [backup.entities.account[0], backup.entities.account[0]] } }), "invalid"],
    ["two settings rows", (backup) => ({ ...backup, entities: { ...backup.entities, settings: [backup.entities.settings[0], backup.entities.settings[0]] } }), "invalid"],
    ["a row missing a column", (backup) => ({ ...backup, entities: { ...backup.entities, loan: [{ ...(backup.entities.loan[0] as object), name: undefined }] } }), "invalid"],
  ])("rejects %s", async (_, damage, code) => {
    const backup = (await valid()) as never
    const changed = damage(backup)
    const parsed = parseBackup(typeof changed === "string" ? changed : JSON.stringify(changed))
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error.code).toBe(code)
  })

  it("reads a file without an entity as having none of it", async () => {
    const backup = await valid()
    const entities: Partial<Record<SyncEntity, unknown[]>> = { ...backup.entities }
    delete entities.notificationState
    const parsed = parseBackup(JSON.stringify({ ...backup, entities }))
    expect(parsed.ok && parsed.backup.entities.notificationState).toEqual([])
  })
})
