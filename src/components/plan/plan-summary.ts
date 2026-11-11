import {
  isActive,
  nextOccurrenceOf,
  orderedGoals,
  orderedLoans,
  savingsGoalProgress,
  subscriptionsPerMonth,
  type Ledger,
  type LoanProgress,
  type Money,
  type SavingsGoalProgress,
} from "@/lib/domain"
import { debtTotals, type DebtTotals } from "@/lib/domain"
import type { RecurringRule, SavingsGoal } from "@/lib/schema"

/** What the Plan hub's three cards show; computed once so the screen only draws it. */
export interface PlanSummary {
  recurring: {
    ruleCount: number
    subscriptionsPerMonth: Money
    /** The soonest movement an active rule will produce. */
    next?: { rule: RecurringRule; date: Date }
  }
  goals: {
    count: number
    first?: { goal: SavingsGoal; progress: SavingsGoalProgress }
  }
  debts: {
    totals: DebtTotals
    isEmpty: boolean
    /** The loan whose next installment comes first. */
    nextLoan?: LoanProgress
  }
}

/** The soonest next occurrence among active (not paused, not finished) rules; ties keep the name order. */
export function nextRecurring(
  rules: readonly RecurringRule[]
): { rule: RecurringRule; date: Date } | undefined {
  let best: { rule: RecurringRule; date: Date } | undefined
  for (const rule of rules) {
    if (!isActive(rule)) continue
    const date = nextOccurrenceOf(rule)
    if (!date) continue
    if (
      !best ||
      date.getTime() < best.date.getTime() ||
      (date.getTime() === best.date.getTime() && rule.name < best.rule.name)
    )
      best = { rule, date }
  }
  return best
}

export function planSummary(ledger: Ledger, now: Date): PlanSummary {
  const goals = orderedGoals(ledger.savingsGoals, now)
  const first = goals[0]
  const totals = debtTotals(ledger.loans, ledger.personalDebts)
  const nextLoan = orderedLoans(ledger.loans, now).find((entry) => entry.next)
  const next = nextRecurring(ledger.recurringRules)
  return {
    recurring: {
      ruleCount: ledger.recurringRules.length,
      subscriptionsPerMonth: subscriptionsPerMonth(
        ledger.recurringRules,
        ledger.settings.currencies
      ),
      ...(next ? { next } : {}),
    },
    goals: {
      count: goals.length,
      ...(first
        ? { first: { goal: first, progress: savingsGoalProgress(first, now) } }
        : {}),
    },
    debts: {
      totals,
      isEmpty:
        totals.youOwe.length === 0 &&
        totals.owedToYou.length === 0 &&
        !nextLoan,
      ...(nextLoan ? { nextLoan } : {}),
    },
  }
}
