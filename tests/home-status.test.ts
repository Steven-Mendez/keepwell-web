// The line under Home's greeting and Home's "Upcoming": both read one `upcomingPayments` list, so the
// line never says "All caught up" while the list below shows something late.
import { describe, expect, it } from "vitest"

import { homeStatus, homeStatusText, homeUpcomingPayments, homeUpcomingShown, ledgerHomeStatus } from "@/components/home/home-status"
import { homeOverview, ledgerNotifications, loadLedger, startOfDay, type Ledger, type UpcomingPayment } from "@/lib/domain"
import { makeTranslator } from "@/lib/i18n"
import type { Account, Loan, RecurringRule } from "@/lib/schema"

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
    const status = { toConfirm: 1, overdue: 2, dueToday: 1, dueTomorrow: 2 }
    expect(homeStatusText(en, status)).toBe("1 payment to confirm · 2 installments overdue · 1 due today · 2 due tomorrow")
    expect(homeStatusText(es, status)).toBe("1 pago por confirmar · 2 cuotas atrasadas · 1 vence hoy · 2 vencen mañana")
    expect(homeStatusText(es, { toConfirm: 2, overdue: 1, dueToday: 2, dueTomorrow: 1 })).toBe(
      "2 pagos por confirmar · 1 cuota atrasada · 2 vencen hoy · 1 vence mañana",
    )
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
          case "renewal":
          case "bill":
            return [{ ...(base as object), kind: "recurring", status: "upcoming", daysFromToday: 1, rule: { isSubscription: true } } as UpcomingPayment]
          default:
            return []
        }
      }),
    )
    const status = ledgerHomeStatus(ledger, now)
    expect(status).toEqual({ toConfirm: 0, overdue: 0, dueToday: 1, dueTomorrow: 4 })
    expect(status.dueToday).toBe(fromNotifications.dueToday)
    expect(status.dueTomorrow).toBe(fromNotifications.dueTomorrow)
  })

  it("shows everything overdue and then the next three", () => {
    const at = (id: string, status: UpcomingPayment["status"]) => ({ id, status }) as UpcomingPayment
    const payments = [at("a", "overdue"), at("b", "overdue"), at("c", "overdue"), at("d", "overdue"), at("e", "today"), at("f", "upcoming"), at("g", "upcoming"), at("h", "upcoming")]
    expect(homeUpcomingShown(payments).map((payment) => payment.id)).toEqual(["a", "b", "c", "d", "e", "f", "g"])
  })
})
