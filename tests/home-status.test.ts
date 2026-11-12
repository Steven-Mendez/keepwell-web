// The line under Home's greeting: counted from the notifications and loans that Home's lists show,
// so it never says "All caught up" while a list below shows something late.
import { describe, expect, it } from "vitest"

import { homeStatus, homeStatusText, ledgerHomeStatus } from "@/components/home/home-status"
import { homeOverview, ledgerNotifications, loadLedger, startOfDay, type Ledger, type LoanProgress } from "@/lib/domain"
import { makeTranslator } from "@/lib/i18n"
import type { Loan } from "@/lib/schema"

import { sampleStore } from "./domain/fixtures"

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
  it("counts exactly the drafts Home lists as late or for today, from the same notifications", async () => {
    const ledger = await loadLedger(sampleStore())
    const today = startOfDay(NOW).getTime()
    const lateDrafts = homeOverview(ledger, NOW).planned.filter((draft) => startOfDay(new Date(draft.date)).getTime() <= today)
    const status = ledgerHomeStatus(ledger, NOW)

    expect(lateDrafts).toHaveLength(2)
    expect(status.toConfirm).toBe(lateDrafts.length)
    expect(status.toConfirm).toBe(ledgerNotifications(ledger, NOW).filter((n) => n.kind === "planned").length)
    expect(homeStatusText(en, status)).toBe("2 payments to confirm")
  })

  it("never says all caught up while a draft or an installment is late", async () => {
    const ledger = await loadLedger(sampleStore())
    const noDrafts: Ledger = { ...ledger, transactions: ledger.transactions.filter((tx) => tx.status !== "planned") }
    expect(homeStatusText(en, ledgerHomeStatus(noDrafts, NOW))).toBe("All caught up")
    expect(homeStatusText(es, ledgerHomeStatus(noDrafts, NOW))).toBe("Todo al día")

    // The installment of Oct 10 is unpaid: Home's Debts card marks it overdue, and so does the line.
    const withLoan: Ledger = { ...noDrafts, loans: [loan] }
    expect(ledgerHomeStatus(withLoan, NOW).overdue).toBe(1)
    expect(homeStatusText(en, ledgerHomeStatus(withLoan, NOW))).toBe("1 installment overdue")
  })

  it("joins what is due with plurals in English and Spanish", () => {
    const status = { toConfirm: 1, overdue: 2, dueToday: 1, dueTomorrow: 2 }
    expect(homeStatusText(en, status)).toBe("1 payment to confirm · 2 installments overdue · 1 due today · 2 due tomorrow")
    expect(homeStatusText(es, status)).toBe("1 pago por confirmar · 2 cuotas atrasadas · 1 vence hoy · 2 vencen mañana")
    expect(homeStatusText(es, { toConfirm: 2, overdue: 1, dueToday: 2, dueTomorrow: 1 })).toBe(
      "2 pagos por confirmar · 1 cuota atrasada · 2 vencen hoy · 1 vence mañana",
    )
  })

  it("sorts payments, installments and renewals by the day they are due", () => {
    const base = { date: NOW, target: { screen: "debts" as const } }
    const amount = { amount: "1", currency: "USD" } as never
    const status = homeStatus(
      [
        { ...base, id: "a", kind: "payment", params: { accountId: "x", dueDay: 26, dueDate: NOW, daysLeft: 0 } },
        { ...base, id: "b", kind: "installment", params: { loanId: "l", name: "L", number: 1, count: 2, amount, daysLeft: 1 } },
        { ...base, id: "c", kind: "renewal", params: { ruleId: "r", name: "R", amount, accountId: "x" } },
        { ...base, id: "d", kind: "payment", params: { accountId: "y", dueDay: 29, dueDate: NOW, daysLeft: 3 } },
        { ...base, id: "e", kind: "cutoff", params: { accountId: "x" } },
      ],
      [] as LoanProgress[],
    )
    expect(status).toEqual({ toConfirm: 0, overdue: 0, dueToday: 1, dueTomorrow: 2 })
  })
})
