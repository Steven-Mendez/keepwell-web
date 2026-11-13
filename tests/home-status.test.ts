// The line under Home's greeting and Home's "Upcoming": both read one `upcomingPayments` list, so the
// line never says "All caught up" while the list below shows something late.
import { describe, expect, it } from "vitest"

import { homeStatus, homeStatusText, homeUpcomingPayments, homeUpcomingShown, ledgerHomeStatus, spentInMonthText } from "@/components/home/home-status"
import { homeOverview, ledgerNotifications, loadLedger, startOfDay, type Ledger, type UpcomingPayment } from "@/lib/domain"
import { makeTranslator } from "@/lib/i18n"
import type { Account, Loan, PersonalDebt, RecurringRule } from "@/lib/schema"

import { date, ledgerWith, sampleStore, single, transaction, ZONE } from "./domain/fixtures"

const en = makeTranslator("en")
const es = makeTranslator("es")
// The sample's drafts are on Oct 24, 25 and 28: on the 26th, two are late and one is still ahead.
const NOW = new Date(2026, 9, 26, 12)

const loan: Loan = {
  id: "00000000-0000-0000-0000-00000000f001",
  name: "Motorbike",
  borrowed: { amount: "1200", currency: "USD" },
  installmentAmount: "100",
  installmentCount: 12,
  frequency: "monthly",
  firstDueDate: new Date(2026, 9, 10).toISOString(),
  payments: [],
}

describe("homeStatus", () => {
  it("counts exactly the drafts Home lists as late or for today", async () => {
    const ledger = await loadLedger(sampleStore())
    const today = startOfDay(NOW, ZONE).getTime()
    const lateDrafts = homeOverview(ledger, NOW).planned.filter((draft) => startOfDay(new Date(draft.date), ZONE).getTime() <= today)
    const payments = homeUpcomingPayments(ledger, NOW)
    const status = homeStatus(payments)

    expect(lateDrafts).toHaveLength(2)
    expect(status.toConfirm).toBe(lateDrafts.length)
    expect(homeUpcomingShown(payments).filter((payment) => payment.kind === "draft" && payment.status !== "upcoming")).toHaveLength(2)
    expect(status.toConfirm).toBe(ledgerNotifications(ledger, NOW).filter((n) => n.kind === "planned").length)
    expect(homeStatusText(en, status)).toBe("2 payments to confirm")
  })

  it("never says all caught up while a draft or an installment is late, and counts each installment", async () => {
    const ledger = await loadLedger(sampleStore())
    const noDrafts: Ledger = { ...ledger, transactions: ledger.transactions.filter((tx) => tx.status !== "planned") }
    expect(homeStatusText(en, ledgerHomeStatus(noDrafts, NOW))).toBe("All caught up")
    expect(homeStatusText(es, ledgerHomeStatus(noDrafts, NOW))).toBe("Todo al día")

    // The installment of Oct 10 is unpaid: "Upcoming" shows it overdue, and so does the line.
    const withLoan: Ledger = { ...noDrafts, loans: [loan] }
    const payments = homeUpcomingPayments(withLoan, NOW)
    expect(homeUpcomingShown(payments).map((payment) => [payment.kind, payment.status])).toContainEqual(["installment", "overdue"])
    expect(ledgerHomeStatus(withLoan, NOW).overdue).toBe(1)
    expect(homeStatusText(en, ledgerHomeStatus(withLoan, NOW))).toBe("1 installment overdue")

    // Two months later two installments are late: the line counts installments, as it says.
    const later = new Date(2026, 10, 26, 12)
    expect(ledgerHomeStatus(withLoan, later).overdue).toBe(2)
  })

  it("joins what is due with plurals in English and Spanish", () => {
    const status = { toConfirm: 1, overdue: 2, overdueDebts: 1, dueToday: 1, dueTomorrow: 2 }
    expect(homeStatusText(en, status)).toBe("1 payment to confirm · 2 installments overdue · 1 debt overdue · 1 due today · 2 due tomorrow")
    expect(homeStatusText(es, status)).toBe("1 pago por confirmar · 2 cuotas atrasadas · 1 deuda atrasada · 1 vence hoy · 2 vencen mañana")
    expect(homeStatusText(es, { toConfirm: 2, overdue: 1, overdueDebts: 2, dueToday: 2, dueTomorrow: 1 })).toBe(
      "2 pagos por confirmar · 1 cuota atrasada · 2 deudas atrasadas · 2 vencen hoy · 1 vence mañana",
    )
    expect(homeStatusText(en, { toConfirm: 0, overdue: 0, overdueDebts: 2, dueToday: 0, dueTomorrow: 0 })).toBe("2 debts overdue")
  })

  it("counts personal debts as Upcoming lists them, never all caught up while one is late", () => {
    const now = date(2026, 11, 12, 15)
    const debt = (n: number, overrides: Partial<PersonalDebt>): PersonalDebt => ({
      id: `00000000-0000-4000-8000-0000000000d${n}`,
      person: "Ana",
      direction: "theyOweMe",
      amount: { amount: "50", currency: "USD" },
      date: date(2026, 10, 1).toISOString(),
      repayments: [],
      ...overrides,
    })
    const owedLate = debt(1, { dueDate: date(2026, 11, 5, 0).toISOString() })
    const oweLate = debt(2, { direction: "iOwe", dueDate: date(2026, 11, 10, 0).toISOString() })
    const today = debt(3, { direction: "iOwe", dueDate: date(2026, 11, 12, 0).toISOString() })
    const tomorrow = debt(4, { dueDate: date(2026, 11, 13, 0).toISOString() })
    const settled = debt(5, { dueDate: date(2026, 11, 1, 0).toISOString(), settledAt: date(2026, 11, 2).toISOString() })
    const undated = debt(6, {})

    // One late debt, whichever way it goes, is enough to drop "All caught up".
    for (const late of [owedLate, oweLate]) {
      const ledger = ledgerWith({ personalDebts: [late, settled, undated] })
      expect(homeUpcomingShown(homeUpcomingPayments(ledger, now)).map((payment) => [payment.kind, payment.status])).toEqual([["debt", "overdue"]])
      expect(homeStatusText(en, ledgerHomeStatus(ledger, now))).toBe("1 debt overdue")
      expect(homeStatusText(es, ledgerHomeStatus(ledger, now))).toBe("1 deuda atrasada")
    }
    expect(homeStatusText(en, ledgerHomeStatus(ledgerWith({ personalDebts: [settled, undated] }), now))).toBe("All caught up")

    const ledger = ledgerWith({ personalDebts: [owedLate, oweLate, today, tomorrow, settled, undated] })
    const payments = homeUpcomingPayments(ledger, now)
    const status = homeStatus(payments)
    expect(status).toEqual({ toConfirm: 0, overdue: 0, overdueDebts: 2, dueToday: 1, dueTomorrow: 1 })
    expect(status.overdueDebts).toBe(homeUpcomingShown(payments).filter((payment) => payment.kind === "debt" && payment.status === "overdue").length)
    expect(homeStatusText(en, status)).toBe("2 debts overdue · 1 due today · 1 due tomorrow")
    expect(homeStatusText(es, status)).toBe("2 deudas atrasadas · 1 vence hoy · 1 vence mañana")
  })

  it("counts today and tomorrow the same as the notifications do", () => {
    const now = date(2026, 11, 12, 15)
    const bank = "00000000-0000-0000-0000-000000000001"
    const card = (id: string, dueDay: number): Account => ({
      id,
      name: "Visa",
      kind: "credit",
      openingBalances: [{ amount: "0", currency: "USD" }],
      openingDate: date(2026, 1, 1).toISOString(),
      creditTerms: { debtMode: "principal", dueDay },
    })
    const today = card("00000000-0000-4000-8000-0000000000c1", 12)
    const tomorrow = card("00000000-0000-4000-8000-0000000000c2", 13)
    const charges = [today, tomorrow].map((account) => transaction({ amount: "50", account: account.id, rate: single("USD"), date: date(2026, 11, 2) }))
    const rule = (id: string, overrides: Partial<RecurringRule>): RecurringRule => ({
      id,
      name: "Rule",
      kind: "expense",
      amount: "10",
      currency: "USD",
      accountId: bank,
      frequency: "monthly",
      interval: 1,
      startDate: date(2026, 1, 13).toISOString(),
      nextDate: date(2026, 11, 13).toISOString(),
      isSubscription: false,
      autoConfirm: false,
      isPaused: false,
      ...overrides,
    })
    const ledger = ledgerWith({
      accounts: [today, tomorrow],
      transactions: charges,
      loans: [{ ...loan, firstDueDate: date(2026, 11, 13, 0).toISOString() }],
      personalDebts: [
        { id: "00000000-0000-4000-8000-0000000000d1", person: "Ana", direction: "theyOweMe", amount: { amount: "20", currency: "USD" }, date: date(2026, 10, 1).toISOString(), repayments: [], dueDate: date(2026, 11, 12, 0).toISOString() },
        { id: "00000000-0000-4000-8000-0000000000d2", person: "Luis", direction: "iOwe", amount: { amount: "20", currency: "USD" }, date: date(2026, 10, 1).toISOString(), repayments: [], dueDate: date(2026, 11, 13, 0).toISOString() },
      ],
      recurringRules: [
        rule("00000000-0000-4000-8000-0000000000e1", { isSubscription: true }), // renewal
        rule("00000000-0000-4000-8000-0000000000e2", {}), // bill
        rule("00000000-0000-4000-8000-0000000000e3", { autoConfirm: true }), // recorded on its own
        rule("00000000-0000-4000-8000-0000000000e4", { kind: "income" }),
      ],
    })
    const fromNotifications = homeStatus(
      ledgerNotifications(ledger, now).flatMap((notification): UpcomingPayment[] => {
        const base = { id: notification.id, date: notification.date, amount: { amount: null, currency: "USD" } } as never
        switch (notification.kind) {
          case "payment":
            return [{ ...(base as object), kind: "card", status: notification.params.daysLeft === 0 ? "today" : "upcoming", daysFromToday: notification.params.daysLeft } as UpcomingPayment]
          case "installment":
            return [{ ...(base as object), kind: "installment", status: notification.params.daysLeft === 0 ? "today" : "upcoming", daysFromToday: notification.params.daysLeft } as UpcomingPayment]
          case "debt":
            return [{ ...(base as object), kind: "debt", status: notification.params.daysLeft === 0 ? "today" : "upcoming", daysFromToday: notification.params.daysLeft } as UpcomingPayment]
          case "renewal":
          case "bill":
            return [{ ...(base as object), kind: "recurring", status: "upcoming", daysFromToday: 1, rule: { isSubscription: true } } as UpcomingPayment]
          default:
            return []
        }
      }),
    )
    const status = ledgerHomeStatus(ledger, now)
    expect(status).toEqual({ toConfirm: 0, overdue: 0, overdueDebts: 0, dueToday: 2, dueTomorrow: 5 })
    expect(status.dueToday).toBe(fromNotifications.dueToday)
    expect(status.dueTomorrow).toBe(fromNotifications.dueTomorrow)
  })

  it("shows everything overdue and then the next three", () => {
    const at = (id: string, status: UpcomingPayment["status"]) => ({ id, status }) as UpcomingPayment
    const payments = [at("a", "overdue"), at("b", "overdue"), at("c", "overdue"), at("d", "overdue"), at("e", "today"), at("f", "upcoming"), at("g", "upcoming"), at("h", "upcoming")]
    expect(homeUpcomingShown(payments).map((payment) => payment.id)).toEqual(["a", "b", "c", "d", "e", "f", "g"])
  })
})

describe("Home's spending label", () => {
  it("keeps the month in its language's case mid-sentence", () => {
    expect(spentInMonthText(en, { year: 2026, month: 11 })).toBe("Spent in November")
    expect(spentInMonthText(es, { year: 2026, month: 11 })).toBe("Gastado en noviembre")
  })
})
