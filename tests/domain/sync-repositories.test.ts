import "fake-indexeddb/auto"

import { Dexie } from "dexie"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import { categorizationRuleRepository, loanRepository, personalDebtRepository, settingsRepository } from "@/lib/repositories"
import { applyRemote, NotFoundError, softDelete, stampAfter, upsert, nextEventStamp } from "@/lib/repositories/shared"
import { DEFAULT_SETTINGS, loanPaymentId, parseSyncPayload, SYNC_WIRE, type Loan } from "@/lib/schema"
import { getClientId } from "@/lib/sync/client-id"

const at = "2026-11-01T18:00:00.000Z"
const loan: Loan = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Moto",
  borrowed: { amount: "1200", currency: "USD" },
  installmentAmount: "110",
  installmentCount: 12,
  frequency: "monthly",
  firstDueDate: at,
  payments: [],
}

beforeEach(async () => {
  db.close()
  await Dexie.delete("keepwell")
  await db.open()
})

const outbox = () => db.sync_outbox.orderBy("created_at").toArray()

describe("sync-ready repositories", () => {
  it("records a loan payment as its own row and event, without re-sending the unchanged loan", async () => {
    await loanRepository.save(loan)
    await db.sync_outbox.clear()
    await loanRepository.save({ ...loan, payments: [{ number: 1, paidAt: at }] })
    const events = await outbox()
    expect(events.map((e) => [e.entity, e.operation, e.entity_id])).toEqual([["loanPayment", "create", loanPaymentId(loan.id, 1)]])
    expect(parseSyncPayload(events[0]!).success).toBe(true)
    expect((await loanRepository.list())[0]!.payments.map((p) => p.number)).toEqual([1])
  })

  it("undoing a payment deletes its row; the loan's other payments are untouched", async () => {
    await loanRepository.save({ ...loan, payments: [{ number: 1, paidAt: at }, { number: 2, paidAt: at }] })
    await db.sync_outbox.clear()
    await loanRepository.save({ ...loan, payments: [{ number: 1, paidAt: at }] })
    expect((await outbox()).map((e) => [e.entity, e.operation])).toEqual([["loanPayment", "delete"]])
  })

  it("keeps a debt's repayments as rows, each with an id", async () => {
    const debt = { id: "22222222-2222-4222-8222-222222222222", person: "Ana", direction: "theyOweMe" as const, amount: { amount: "50", currency: "USD" }, date: at, repayments: [{ amount: "20", date: at }] }
    await personalDebtRepository.save(debt)
    const [saved] = await personalDebtRepository.list()
    expect(saved!.repayments[0]!.id).toMatch(/^[0-9a-f-]{36}$/)
    expect((await outbox()).map((e) => e.entity)).toEqual(["personalDebt", "personalDebtRepayment"])
  })

  it("sends a repayment's deposit link, null for none, and doesn't re-send rows stored before the column", async () => {
    const movementId = "33333333-3333-4333-8333-333333333333"
    const debt = {
      id: "22222222-2222-4222-8222-222222222222",
      person: "Ana",
      direction: "theyOweMe" as const,
      amount: { amount: "50", currency: "USD" },
      date: at,
      repayments: [
        { id: "44444444-4444-4444-8444-444444444444", amount: "20", date: at, transactionId: movementId },
        { id: "55555555-5555-4555-8555-555555555555", amount: "10", date: at },
      ],
    }
    await personalDebtRepository.save(debt)
    const payloads = (await outbox()).filter((e) => e.entity === "personalDebtRepayment").map((e) => e.payload as Record<string, unknown>)
    expect(payloads.map((p) => p.transaction_id)).toEqual([movementId, null])
    for (const event of await outbox()) expect(parseSyncPayload(event).success).toBe(true)
    expect((await personalDebtRepository.list())[0]!.repayments.map((r) => r.transactionId)).toEqual([movementId, undefined])
    // A row stored before the column lacks it: saving the debt again doesn't count that as a change.
    const { transaction_id: _, ...older } = (await db.personal_debt_repayments.get("55555555-5555-4555-8555-555555555555"))!
    await db.personal_debt_repayments.put(older)
    expect("transaction_id" in (await db.personal_debt_repayments.get(older.id))!).toBe(false)
    await db.sync_outbox.clear()
    await personalDebtRepository.save(debt)
    expect(await outbox()).toEqual([])
  })

  it("never brings a deleted row back with a local save (delete wins)", async () => {
    await loanRepository.save(loan)
    await softDelete(db.loans, "loan", loan.id)
    const { loanToRow } = await import("@/lib/db")
    const error = await upsert(db.loans, "loan", loanToRow(loan)).catch((e: unknown) => e)
    // Dexie rethrows errors from inside a transaction as its own type, keeping the name.
    expect((error as Error).name).toBe(new NotFoundError("x").name)
  })

  it("orders events saved in the same millisecond as they were enqueued, parents first", () => {
    const at = "2026-11-09T12:00:00.000Z"
    const first = nextEventStamp(at)
    const second = nextEventStamp(at)
    expect(second > first).toBe(true)
    expect(nextEventStamp("2030-01-01T00:00:00.000Z")).toBe("2030-01-01T00:00:00.000Z")
  })

  it("applies remote rows without writing the outbox, the server's row wins, tombstones are final", async () => {
    const row = { id: loan.id, name: "Moto", lender: null, borrowed_amount: "1200", borrowed_currency: "USD", installment_amount: "110", installment_count: 12, frequency: "monthly", first_due_date: at, created_at: at, updated_at: at, deleted_at: null }
    expect(SYNC_WIRE.loan.safeParse(row).success).toBe(true)
    expect(await applyRemote("loan", row)).toBe("applied")
    // The server arbitrated: even an older timestamp is what it keeps (a clock-ahead device adopts it).
    expect(await applyRemote("loan", { ...row, name: "Server's", updated_at: "2026-10-01T00:00:00.000Z" })).toBe("applied")
    expect((await db.loans.get(loan.id))?.name).toBe("Server's")
    expect(await applyRemote("loan", { ...row, name: "Newer", updated_at: "2026-11-02T00:00:00.000Z" })).toBe("applied")
    expect(await applyRemote("loan", { ...row, updated_at: "2026-11-03T00:00:00.000Z", deleted_at: "2026-11-03T00:00:00.000Z" })).toBe("applied")
    expect(await applyRemote("loan", { ...row, name: "Resurrected", updated_at: "2026-12-01T00:00:00.000Z" })).toBe("ignored")
    expect((await db.loans.get(loan.id))?.deleted_at).not.toBeNull()
    expect(await db.sync_outbox.count()).toBe(0)
  })

  it("syncs settings without this device's preferences, and a preference change sends nothing", async () => {
    await settingsRepository.save(DEFAULT_SETTINGS)
    const [first] = await outbox()
    expect(first!.payload).not.toHaveProperty("unlock_method")
    expect(parseSyncPayload(first!).success).toBe(true)
    await settingsRepository.save({ ...DEFAULT_SETTINGS, unlockMethod: "passcode" })
    expect(await db.sync_outbox.count()).toBe(1)

    const remote = { ...(first!.payload as Record<string, unknown>), payment_reminder_days_before: 7, updated_at: "2027-01-01T00:00:00.000Z" } as never
    await applyRemote("settings", remote)
    const loaded = await settingsRepository.load()
    expect(loaded?.paymentReminderDaysBefore).toBe(7)
    expect(loaded?.unlockMethod).toBe("passcode")
  })

  describe("with this device's clock three minutes behind the stored row", () => {
    const clock = "2026-11-10T12:00:00.000Z"
    const stored = "2026-11-10T12:03:00.000Z"
    // Only Date: Dexie and fake-indexeddb need real timers.
    beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: new Date(clock) }))
    afterEach(() => vi.useRealTimers())

    it("a new row gets the current time", async () => {
      await loanRepository.save(loan)
      expect((await db.loans.get(loan.id))?.updated_at).toBe(clock)
      expect(stampAfter(undefined)).toBe(clock)
    })

    it("saving and deleting stamp after the stored row, so the server keeps the edit", async () => {
      await loanRepository.save(loan)
      await db.loans.update(loan.id, { updated_at: stored })
      await loanRepository.save({ ...loan, name: "Moto roja" })
      const saved = (await db.loans.get(loan.id))!.updated_at
      expect(saved > stored).toBe(true)
      const [, event] = await outbox()
      expect((event!.payload as { updated_at: string }).updated_at).toBe(saved)

      await db.loans.update(loan.id, { updated_at: stored })
      await softDelete(db.loans, "loan", loan.id)
      expect((await db.loans.get(loan.id))!.updated_at > stored).toBe(true)
    })

    it("repositories that stamp on their own follow the same rule", async () => {
      const rule = { id: "33333333-3333-4333-8333-333333333333", match: "uber", categoryId: "transport", kind: "expense" as const }
      await categorizationRuleRepository.save(rule)
      expect((await db.categorization_rules.get(rule.id))?.updated_at).toBe(clock)
      await db.categorization_rules.update(rule.id, { updated_at: stored })
      await categorizationRuleRepository.save({ ...rule, match: "taxi" })
      expect((await db.categorization_rules.get(rule.id))!.updated_at > stored).toBe(true)

      await settingsRepository.save(DEFAULT_SETTINGS)
      await db.settings.toCollection().modify({ updated_at: stored })
      await settingsRepository.save({ ...DEFAULT_SETTINGS, paymentReminderDaysBefore: 5 })
      expect((await db.settings.toArray())[0]!.updated_at > stored).toBe(true)
    })
  })

  it("keeps one client id per installation", async () => {
    const id = await getClientId()
    expect(await getClientId()).toBe(id)
  })

  it("lists categorization rules with the same sort_index by id, whatever order they arrived in", async () => {
    const rule = (id: string, sort_index: number) => ({
      id,
      match: id.slice(0, 4),
      category_id: "food",
      kind: "expense" as const,
      tags: [],
      sort_index,
      created_at: at,
      updated_at: at,
      deleted_at: null,
    })
    const first = "aaaaaaaa-0000-4000-8000-000000000000"
    const tiedLow = "bbbbbbbb-0000-4000-8000-000000000000"
    const tiedHigh = "cccccccc-0000-4000-8000-000000000000"
    await db.categorization_rules.bulkAdd([rule(tiedHigh, 1), rule(first, 0), rule(tiedLow, 1)])
    expect((await categorizationRuleRepository.list()).map((r) => r.id)).toEqual([first, tiedLow, tiedHigh])
  })
})
