// The Plan hub's three cards: what recurring comes next, the first goal and the debts line.
import { describe, expect, it } from "vitest"

import { nextRecurring, planSummary } from "@/components/plan/plan-summary"
import type { Ledger } from "@/lib/domain"
import { DEFAULT_SETTINGS, type Loan, type RecurringRule, type SavingsGoal } from "@/lib/schema"

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
