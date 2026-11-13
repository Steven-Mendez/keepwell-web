// upcomingPayments: the one list of what's pending (shared contract with keepwell-api and keepwell-ios).
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { compareUpcomingPayments, dayKey, upcomingPayments, type Ledger, type UpcomingPayment } from "@/lib/domain"
import type { UpcomingFixtures } from "@/lib/fixtures"
import { Account, CurrencySettings, DEFAULT_SETTINGS, Loan, PersonalDebt, RecurringRule, Transaction, type Loan as LoanType, type PersonalDebt as PersonalDebtType } from "@/lib/schema"

import { date, ledgerWith, single, transaction, ZONE } from "./fixtures"

const fixtures = JSON.parse(readFileSync(join(__dirname, "../../src/lib/fixtures/upcoming.json"), "utf8")) as UpcomingFixtures

/** A fixture case as the domain reads it: every entity through its schema, like a synced row. */
export function fixtureLedger(entry: UpcomingFixtures["cases"][number]): Ledger {
  return ledgerWith({
    settings: { ...DEFAULT_SETTINGS, currencies: CurrencySettings.parse(entry.ledger.currencies) },
    accounts: entry.ledger.accounts.map((value) => Account.parse(value)),
    transactions: entry.ledger.transactions.map((value) => Transaction.parse(value)),
    recurringRules: entry.ledger.recurringRules.map((value) => RecurringRule.parse(value)),
    loans: entry.ledger.loans.map((value) => Loan.parse(value)),
    personalDebts: (entry.ledger.personalDebts ?? []).map((value) => PersonalDebt.parse(value)),
    timeZone: entry.timeZone,
  })
}

describe("shared upcoming fixtures", () => {
  for (const entry of fixtures.cases) {
    for (const window of entry.windows) {
      it(`${entry.name}, ${window.days} days`, () => {
        const payments = upcomingPayments(fixtureLedger(entry), new Date(entry.now), window.days)
        expect(payments.map(({ id, status }) => ({ id, status }))).toEqual(window.expected)
      })
    }
  }
})

const LOAN = "00000000-0000-4000-8000-0000000000f1"
const RULE = "00000000-0000-4000-8000-0000000000e1"
const BANK = "00000000-0000-0000-0000-000000000001"
const NOW = date(2026, 11, 12, 15)

const loan = (overrides: Partial<LoanType> = {}): LoanType => ({
  id: LOAN,
  name: "Motorbike",
  borrowed: { amount: "1200", currency: "USD" },
  installmentAmount: "100",
  installmentCount: 12,
  frequency: "monthly",
  firstDueDate: date(2026, 9, 10, 0).toISOString(),
  payments: [],
  ...overrides,
})

const rule = (overrides: Partial<RecurringRule> = {}): RecurringRule => ({
  id: RULE,
  name: "Gym",
  kind: "expense",
  amount: "25",
  currency: "USD",
  accountId: BANK,
  frequency: "monthly",
  interval: 1,
  startDate: date(2026, 1, 12).toISOString(),
  nextDate: date(2026, 11, 12).toISOString(),
  isSubscription: false,
  autoConfirm: false,
  isPaused: false,
  ...overrides,
})

const credit = (dueDay: number, id = "00000000-0000-4000-8000-0000000000c1"): Account => ({
  id,
  name: "Visa",
  kind: "credit",
  openingBalances: [{ amount: "0", currency: "USD" }],
  openingDate: date(2026, 1, 1).toISOString(),
  creditTerms: { debtMode: "principal", dueDay },
})

const ids = (payments: UpcomingPayment[]) => payments.map((payment) => payment.id)

describe("upcomingPayments", () => {
  it("lists every overdue installment of a loan, each with its own row and days", () => {
    const payments = upcomingPayments(ledgerWith({ loans: [loan()] }), NOW, 0)
    expect(payments.map((payment) => [payment.id, payment.status, payment.daysFromToday])).toEqual([
      [`installment:${LOAN}:1`, "overdue", -63],
      [`installment:${LOAN}:2`, "overdue", -33],
      [`installment:${LOAN}:3`, "overdue", -2],
    ])
    expect(payments[0]).toMatchObject({ kind: "installment", number: 1, count: 12 })
    expect(payments[0]?.amount.amount.toString()).toBe("100")
  })

  it("lists several installments of a weekly loan in the window", () => {
    const weekly = loan({ frequency: "weekly", firstDueDate: date(2026, 11, 13, 0).toISOString(), installmentCount: 4 })
    expect(ids(upcomingPayments(ledgerWith({ loans: [weekly] }), NOW, 14))).toEqual([`installment:${LOAN}:1`, `installment:${LOAN}:2`])
  })

  it("shows a draft dated ahead by hand as upcoming, and none past the window", () => {
    const ahead = { ...transaction({ amount: "10", status: "planned", date: date(2026, 11, 15) }), id: "00000000-0000-4000-8000-0000000000a1" }
    const far = { ...transaction({ amount: "10", status: "planned", date: date(2026, 11, 30) }), id: "00000000-0000-4000-8000-0000000000a2" }
    const payments = upcomingPayments(ledgerWith({ transactions: [ahead, far] }), NOW, 7)
    expect(payments.map(({ id, status }) => [id, status])).toEqual([[`draft:${ahead.id}`, "upcoming"]])
  })

  it("shows today's occurrence not produced yet as today, and nothing from an ended or paused rule", () => {
    const ended = rule({ id: "00000000-0000-4000-8000-0000000000e2", endDate: date(2026, 11, 1).toISOString() })
    const paused = rule({ id: "00000000-0000-4000-8000-0000000000e3", isPaused: true })
    const payments = upcomingPayments(ledgerWith({ recurringRules: [rule(), ended, paused] }), NOW, 3)
    expect(payments.map(({ id, status }) => [id, status])).toEqual([[`recurring:${RULE}:2026-11-12`, "today"]])
  })

  it("leaves out a card with nothing to pay and charges the one that owes, in the principal currency", () => {
    const owes = credit(14)
    const paid = credit(13, "00000000-0000-4000-8000-0000000000c2")
    const charge = { ...transaction({ amount: "80", account: owes.id, rate: single("USD"), date: date(2026, 11, 2) }) }
    const payments = upcomingPayments(ledgerWith({ accounts: [owes, paid], transactions: [charge] }), NOW, 7)
    expect(payments.map(({ id, status }) => [id, status])).toEqual([[`card:${owes.id}:2026-11-14`, "upcoming"]])
    const card = payments[0]
    expect(card?.kind === "card" && card.amount.currency).toBe("USD")
    expect(card?.amount.amount.toString()).toBe("80")
  })

  it("lists an open debt with a due date, either direction, for what's left of it in its currency", () => {
    const debt = (id: string, overrides: Partial<PersonalDebtType>): PersonalDebtType => ({
      id,
      person: "Ana",
      direction: "theyOweMe",
      amount: { amount: "100", currency: "NIO" },
      date: date(2026, 10, 1).toISOString(),
      repayments: [],
      ...overrides,
    })
    const late = debt("00000000-0000-4000-8000-0000000000d1", {
      dueDate: date(2026, 11, 9, 0).toISOString(),
      repayments: [{ amount: "30", date: date(2026, 10, 20).toISOString() }],
    })
    const mine = debt("00000000-0000-4000-8000-0000000000d2", { direction: "iOwe", person: "Luis", dueDate: date(2026, 11, 14, 0).toISOString() })
    const undated = debt("00000000-0000-4000-8000-0000000000d3", {})
    const settled = debt("00000000-0000-4000-8000-0000000000d4", { dueDate: date(2026, 11, 10, 0).toISOString(), settledAt: date(2026, 11, 10).toISOString() })
    const far = debt("00000000-0000-4000-8000-0000000000d5", { dueDate: date(2026, 11, 30, 0).toISOString() })
    const payments = upcomingPayments(ledgerWith({ personalDebts: [far, settled, undated, mine, late] }), NOW, 7)
    expect(payments.map((payment) => [payment.id, payment.status, payment.daysFromToday])).toEqual([
      [`debt:${late.id}`, "overdue", -3],
      [`debt:${mine.id}`, "upcoming", 2],
    ])
    expect(payments[0]).toMatchObject({ kind: "debt", debtId: late.id, person: "Ana", direction: "theyOweMe" })
    expect([payments[0]?.amount.amount.toString(), payments[0]?.amount.currency]).toEqual(["70", "NIO"])
    expect(payments[1]).toMatchObject({ kind: "debt", direction: "iOwe" })
  })

  it("leaves out a closed account's card, even owing, and its rules, from or to it", () => {
    const closedAt = date(2026, 11, 1).toISOString()
    const card = { ...credit(14), closedAt }
    const savings: Account = { id: "00000000-0000-4000-8000-0000000000b9", name: "Old", kind: "deposit", openingBalances: [{ amount: "0", currency: "USD" }], openingDate: date(2026, 1, 1).toISOString(), closedAt }
    const charge = transaction({ amount: "80", account: card.id, rate: single("USD"), date: date(2026, 11, 2) })
    const onCard = rule({ id: "00000000-0000-4000-8000-0000000000e4", accountId: card.id })
    const intoClosed = rule({ id: "00000000-0000-4000-8000-0000000000e5", kind: "transfer", destinationAccountId: savings.id })
    const ledger = ledgerWith({ accounts: [card, savings], transactions: [charge], recurringRules: [onCard, intoClosed, rule()] })
    expect(ids(upcomingPayments(ledger, NOW, 7))).toEqual([`recurring:${RULE}:2026-11-12`])
    // Reopened, both come back.
    const reopened = ledgerWith({ ...ledger, accounts: [credit(14), { ...savings, closedAt: undefined }] })
    expect(ids(upcomingPayments(reopened, NOW, 7))).toEqual([
      `recurring:${RULE}:2026-11-12`,
      `recurring:${onCard.id}:2026-11-12`,
      `recurring:${intoClosed.id}:2026-11-12`,
      `card:${card.id}:2026-11-14`,
    ])
  })

  it("orders by day, then drafts, installments, cards, recurring and debts, then by id bytes", () => {
    const at = (id: string, kind: UpcomingPayment["kind"], daysFromToday: number) => ({ id, kind, daysFromToday }) as UpcomingPayment
    const sorted = [
      at("recurring:b", "recurring", 0),
      at("debt:a", "debt", 0),
      at("card:a", "card", 0),
      at("draft:b", "draft", 0),
      at("draft:B", "draft", 0),
      at("installment:a", "installment", 0),
      at("recurring:a", "recurring", -1),
    ].sort(compareUpcomingPayments)
    expect(ids(sorted)).toEqual(["recurring:a", "draft:B", "draft:b", "installment:a", "card:a", "recurring:b", "debt:a"])
  })

  it("counts calendar days in the ledger's zone", () => {
    // 11pm in Managua on the 12th is already the 13th in UTC: today stays the 12th.
    const late = new Date(Date.UTC(2026, 10, 13, 5))
    const payments = upcomingPayments(ledgerWith({ recurringRules: [rule({ startDate: date(2026, 1, 13).toISOString(), nextDate: date(2026, 11, 13).toISOString() })] }), late, 1)
    expect(payments.map((payment) => [dayKey(payment.date, ZONE), payment.daysFromToday, payment.status])).toEqual([["2026-11-13", 1, "upcoming"]])
  })
})
