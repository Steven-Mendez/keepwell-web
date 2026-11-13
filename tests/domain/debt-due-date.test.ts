// A personal debt's optional due date (T24): where it stands on a day, how it is saved, removed and
// rejected, the order of the People list, and the row it travels in.
import "fake-indexeddb/auto"

import { Dexie } from "dexie"
import { beforeEach, describe, expect, it } from "vitest"

import { db, personalDebtToRow, rowToPersonalDebt } from "@/lib/db"
import {
  DomainError,
  InMemoryStore,
  debtDueStatus,
  orderedPersonalDebts,
  repayPersonalDebt,
  savePersonalDebt,
  settlePersonalDebt,
  type PersonalDebtDraft,
} from "@/lib/domain"
import { personalDebtRepository } from "@/lib/repositories"
import { applyRemote } from "@/lib/repositories/shared"
import { SYNC_WIRE, type PersonalDebt } from "@/lib/schema"

import { date, sampleStore, ZONE } from "./fixtures"

const ID = "00000000-0000-0000-0000-00000000f201"

function debt(overrides: Partial<PersonalDebt> = {}): PersonalDebt {
  return {
    id: ID,
    person: "Ana",
    direction: "theyOweMe",
    amount: { amount: "12", currency: "USD" },
    date: date(2026, 9, 1).toISOString(),
    repayments: [],
    ...overrides,
  }
}

async function failure(work: () => Promise<unknown>): Promise<unknown> {
  return work().then(
    () => undefined,
    (thrown: unknown) => thrown
  )
}

describe("debtDueStatus", () => {
  const due = debt({ dueDate: date(2026, 11, 15, 0).toISOString() })

  it("counts calendar days to the due date, whatever the hour", () => {
    expect(debtDueStatus(due, date(2026, 11, 12, 23), ZONE)).toEqual({ state: "upcoming", daysLeft: 3 })
    expect(debtDueStatus(due, date(2026, 11, 14, 0), ZONE)).toEqual({ state: "upcoming", daysLeft: 1 })
    expect(debtDueStatus(due, date(2026, 11, 15, 23), ZONE)).toEqual({ state: "today" })
    expect(debtDueStatus(due, date(2026, 11, 18, 1), ZONE)).toEqual({ state: "overdue", daysLate: 3 })
  })

  it("says nothing for a debt without a date, settled, or with nothing left", () => {
    const today = date(2026, 11, 12)
    expect(debtDueStatus(debt(), today, ZONE)).toBeUndefined()
    expect(debtDueStatus({ ...due, settledAt: today.toISOString() }, today, ZONE)).toBeUndefined()
    expect(debtDueStatus({ ...due, repayments: [{ amount: "12", date: today.toISOString() }] }, today, ZONE)).toBeUndefined()
  })

  it("reads the day in the zone it is given (the home zone on the server)", () => {
    // Midnight of Nov 15 in Managua is 06:00 UTC; at 03:00 UTC on Nov 15 it is still the 14th there.
    const dueInManagua = debt({ dueDate: "2026-11-15T06:00:00.000Z" })
    const now = new Date("2026-11-15T03:00:00.000Z")
    expect(debtDueStatus(dueInManagua, now, "America/Managua")).toEqual({ state: "upcoming", daysLeft: 1 })
    // In Madrid the same instant is already Nov 15, and the date is that same day.
    expect(debtDueStatus(dueInManagua, now, "Europe/Madrid")).toEqual({ state: "today" })
  })
})

describe("savePersonalDebt with a due date", () => {
  const draft = (overrides: Partial<PersonalDebtDraft> = {}): PersonalDebtDraft => ({
    person: "Ana",
    direction: "theyOweMe",
    amount: "12",
    currency: "USD",
    date: date(2026, 9, 1),
    note: "",
    ...overrides,
  })

  it("saves it as the start of the day, removes it when the edit leaves it out, and rejects one before the debt", async () => {
    const store: InMemoryStore = sampleStore()
    const saved = await savePersonalDebt(store, draft({ dueDate: date(2026, 11, 15, 17) }))
    expect(saved.dueDate).toBe(date(2026, 11, 15, 0).toISOString())

    const sameDay = await savePersonalDebt(store, draft({ id: saved.id, dueDate: date(2026, 9, 1, 8) }))
    expect(sameDay.dueDate).toBe(date(2026, 9, 1, 0).toISOString())

    const removed = await savePersonalDebt(store, draft({ id: saved.id }))
    expect(removed).not.toHaveProperty("dueDate")
    expect(store.personalDebts.find((row) => row.id === saved.id)).not.toHaveProperty("dueDate")

    const error = await failure(() => savePersonalDebt(store, draft({ dueDate: date(2026, 8, 31) })))
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe("invalidDueDate")
  })

  it("keeps it through a repayment and settling", async () => {
    const store = sampleStore()
    const saved = await savePersonalDebt(store, draft({ dueDate: date(2026, 11, 15) }))
    const repaid = await repayPersonalDebt(store, saved.id, "5", date(2026, 11, 2))
    expect(repaid.dueDate).toBe(saved.dueDate)
    expect((await settlePersonalDebt(store, saved.id, date(2026, 11, 3))).dueDate).toBe(saved.dueDate)
  })
})

describe("orderedPersonalDebts with due dates", () => {
  it("lists open debts with a date first, soonest (and overdue) first, then open ones newest first, then settled", () => {
    const ordered = orderedPersonalDebts([
      debt({ id: "a", person: "No date, old", date: date(2026, 9, 1).toISOString() }),
      debt({ id: "b", person: "Due later", dueDate: date(2026, 12, 1, 0).toISOString() }),
      debt({ id: "c", person: "Settled", dueDate: date(2026, 10, 1, 0).toISOString(), settledAt: date(2026, 10, 2).toISOString() }),
      debt({ id: "d", person: "Overdue", dueDate: date(2026, 10, 1, 0).toISOString() }),
      debt({ id: "e", person: "No date, new", date: date(2026, 11, 1).toISOString() }),
    ])
    expect(ordered.map((row) => row.person)).toEqual(["Overdue", "Due later", "No date, new", "No date, old", "Settled"])
  })
})

describe("the due date on the wire", () => {
  beforeEach(async () => {
    db.close()
    await Dexie.delete("keepwell")
    await db.open()
  })

  const at = "2026-11-01T18:00:00.000Z"
  const audit = { created_at: at, updated_at: at, deleted_at: null }

  it("always sends due_date, null for none, so removing it clears it on the other devices", () => {
    expect(personalDebtToRow(debt())).toHaveProperty("due_date", null)
    expect(personalDebtToRow(debt({ dueDate: "2026-11-15T06:00:00.000Z" })).due_date).toBe("2026-11-15T06:00:00.000Z")
  })

  it("reads a row from before the column, without it, as a debt without a date", () => {
    const { due_date: _, ...older } = { ...personalDebtToRow(debt()), ...audit }
    expect(SYNC_WIRE.personalDebt.safeParse(older).success).toBe(true)
    expect(rowToPersonalDebt(older, [])).not.toHaveProperty("dueDate")
  })

  it("applies a pulled row with a column this app doesn't know yet, without failing, and keeps the date", async () => {
    const row = { ...personalDebtToRow(debt({ dueDate: "2026-11-15T06:00:00.000Z" })), ...audit, a_later_column: "x" }
    const parsed = SYNC_WIRE.personalDebt.safeParse(row)
    expect(parsed.success).toBe(true)
    expect(parsed.data).not.toHaveProperty("a_later_column")
    expect(await applyRemote("personalDebt", parsed.data as never)).toBe("applied")
    const [loaded] = await personalDebtRepository.list()
    expect(loaded?.dueDate).toBe("2026-11-15T06:00:00.000Z")
  })
})
