// The Plan hub's three cards: what recurring comes next, the first goal and the debts line.
import { describe, expect, it } from "vitest"

import { nextRecurring, planSummary } from "@/components/plan/plan-summary"
import type { Ledger } from "@/lib/domain"
import { makeTranslator } from "@/lib/i18n"
import { DEFAULT_SETTINGS, type Loan, type PersonalDebt, type RecurringRule, type SavingsGoal } from "@/lib/schema"

const NOW = new Date(2026, 10, 6, 12)

function rule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  const start = new Date(2026, 10, 10, 9).toISOString()
  return {
    id: "00000000-0000-0000-0000-00000000e001",
    name: "Streaming",
    kind: "expense",
    categoryId: "subscriptions",
    amount: "10",
    currency: "USD",
    accountId: "00000000-0000-0000-0000-00000000a004",
    frequency: "monthly",
    interval: 1,
    startDate: start,
    nextDate: start,
    isSubscription: true,
    autoConfirm: false,
    isPaused: false,
    ...overrides,
  }
}

const goal: SavingsGoal = {
  id: "00000000-0000-0000-0000-00000000a001",
  name: "Trip",
  target: { amount: "100", currency: "USD" },
  saved: "25",
}

const loan: Loan = {
  id: "00000000-0000-0000-0000-00000000f001",
  name: "Motorbike",
  borrowed: { amount: "1200", currency: "USD" },
  installmentAmount: "100",
  installmentCount: 12,
  frequency: "monthly",
  firstDueDate: new Date(2026, 10, 20).toISOString(),
  payments: [],
}

const ledger = (parts: Partial<Ledger>) =>
  ({
    settings: DEFAULT_SETTINGS,
    recurringRules: [],
    savingsGoals: [],
    loans: [],
    personalDebts: [],
    ...parts,
  }) as unknown as Ledger

describe("nextRecurring", () => {
  it("is the soonest active rule, skipping paused ones", () => {
    const soon = rule({ id: "00000000-0000-0000-0000-00000000e002", name: "Gym", nextDate: new Date(2026, 10, 8).toISOString(), isPaused: true })
    const later = rule({ id: "00000000-0000-0000-0000-00000000e003", name: "Rent", nextDate: new Date(2026, 10, 12).toISOString() })
    expect(nextRecurring([rule(), soon, later], NOW)?.rule.name).toBe("Streaming")
    expect(nextRecurring([soon], NOW)).toBeUndefined()
  })

  it("never shows a date before today, as iOS", () => {
    // Stored next date Nov 10 hasn't been recorded yet; on Nov 20 the next one is Dec 10.
    const monthly = rule({ nextDate: new Date(2026, 10, 10, 9).toISOString() })
    const next = nextRecurring([monthly], new Date(2026, 10, 20, 12))
    expect(next?.date.getMonth()).toBe(11)
    expect(next?.date.getDate()).toBe(10)
  })
})

describe("planSummary", () => {
  it("is empty without data", () => {
    const summary = planSummary(ledger({}), NOW)
    expect(summary.recurring.next).toBeUndefined()
    expect(summary.recurring.ruleCount).toBe(0)
    expect(summary.goals.count).toBe(0)
    expect(summary.goals.first).toBeUndefined()
    expect(summary.debts.isEmpty).toBe(true)
  })

  it("sums subscriptions, names the first goal and the next installment", () => {
    const summary = planSummary(ledger({ recurringRules: [rule()], savingsGoals: [goal], loans: [loan] }), NOW)
    expect(summary.recurring.subscriptionsPerMonth.amount.toString()).not.toBe("0")
    expect(summary.recurring.next?.rule.name).toBe("Streaming")
    expect(summary.goals.count).toBe(1)
    expect(summary.goals.first?.goal.name).toBe("Trip")
    expect(summary.goals.first?.progress.fraction.toNumber()).toBeCloseTo(0.25)
    expect(summary.debts.isEmpty).toBe(false)
    expect(summary.debts.nextLoan?.next?.number).toBe(1)
  })
})

describe("planSummary counts", () => {
  const debt = (overrides: Partial<PersonalDebt>): PersonalDebt => ({
    id: "00000000-0000-0000-0000-00000000d001",
    person: "Ana",
    direction: "theyOweMe",
    amount: { amount: "20", currency: "USD" },
    date: NOW.toISOString(),
    repayments: [],
    ...overrides,
  })

  it("counts the subscriptions the monthly total adds up", () => {
    const rules = [
      rule(),
      rule({ id: "00000000-0000-0000-0000-00000000e002", name: "Music" }),
      rule({ id: "00000000-0000-0000-0000-00000000e003", name: "Gym", isPaused: true }),
      rule({ id: "00000000-0000-0000-0000-00000000e004", name: "Rent", isSubscription: false }),
      rule({ id: "00000000-0000-0000-0000-00000000e005", name: "Refund", kind: "income" }),
    ]
    const summary = planSummary(ledger({ recurringRules: rules }), NOW)
    expect(summary.recurring.subscriptionCount).toBe(2)
    expect(summary.recurring.subscriptionsPerMonth.amount.toString()).toBe("20")
  })

  it("counts open debts to pay and the different people who owe", () => {
    const debts = [
      debt({}),
      debt({ id: "00000000-0000-0000-0000-00000000d002", person: "ana " , amount: { amount: "42", currency: "USD" } }),
      debt({ id: "00000000-0000-0000-0000-00000000d003", person: "Luis" }),
      debt({ id: "00000000-0000-0000-0000-00000000d004", person: "Marta", settledAt: NOW.toISOString() }),
      debt({ id: "00000000-0000-0000-0000-00000000d005", person: "Shop", direction: "iOwe" }),
    ]
    const summary = planSummary(ledger({ personalDebts: debts, loans: [loan] }), NOW)
    expect(summary.debts.peopleOwingCount).toBe(2)
    expect(summary.debts.youOweCount).toBe(2)
  })

  it("words the counts with plurals in English and Spanish", () => {
    const en = makeTranslator("en")
    const es = makeTranslator("es")
    expect(en.in("plan", "Per month · %lld subscriptions", 1)).toBe("Per month · 1 subscription")
    expect(es.in("plan", "Per month · %lld subscriptions", 7)).toBe("Al mes · 7 suscripciones")
    expect(en.in("plan", "%lld people owe you", 1)).toBe("1 person owes you")
    expect(es.in("plan", "%lld people owe you", 2)).toBe("2 personas te deben")
    expect(es.in("plan", "%lld people owe you", 1)).toBe("1 persona te debe")
    expect(en.in("plan", "%lld debts to pay", 3)).toBe("3 debts to pay")
    expect(es.in("plan", "%lld debts to pay", 1)).toBe("1 deuda por pagar")
  })
})
