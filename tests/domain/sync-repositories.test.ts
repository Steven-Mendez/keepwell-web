import "fake-indexeddb/auto"

import { Dexie } from "dexie"
import { beforeEach, describe, expect, it } from "vitest"

import { db } from "@/lib/db"
import { loanRepository, personalDebtRepository, settingsRepository } from "@/lib/repositories"
import { applyRemote, NotFoundError, softDelete, upsert } from "@/lib/repositories/shared"
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

  it("never brings a deleted row back with a local save (delete wins)", async () => {
    await loanRepository.save(loan)
    await softDelete(db.loans, "loan", loan.id)
    const { loanToRow } = await import("@/lib/db")
    const error = await upsert(db.loans, "loan", loanToRow(loan)).catch((e: unknown) => e)
    // Dexie rethrows errors from inside a transaction as its own type, keeping the name.
    expect((error as Error).name).toBe(new NotFoundError("x").name)
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

  it("keeps one client id per installation", async () => {
    const id = await getClientId()
    expect(await getClientId()).toBe(id)
  })
})
