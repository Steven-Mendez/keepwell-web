import {
  debtRemaining,
  isActive,
  isSettled,
  occurrencesFrom,
  startOfDay,
  orderedGoals,
  orderedLoans,
  savingsGoalProgress,
  subscriptionsPerMonth,
  type Ledger,
  type LoanProgress,
  type Money,
  type SavingsGoalProgress,
} from "@/lib/domain"
import { debtTotals, type DebtTotals, type TimeZone } from "@/lib/domain"
import type { RecurringRule, SavingsGoal } from "@/lib/schema"

/** What the Plan hub's three cards show; computed once so the screen only draws it. */
export interface PlanSummary {
  recurring: {
    ruleCount: number
    /** The rules `subscriptionsPerMonth` adds up: live expense subscriptions. */
    subscriptionCount: number
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
    /** Open loans and open debts the person owes: what `totals.youOwe` adds up. */
    youOweCount: number
    /** Different people with an open debt to the person: who `totals.owedToYou` adds up. */
    peopleOwingCount: number
    isEmpty: boolean
    /** The loan whose next installment comes first. */
    nextLoan?: LoanProgress
  }
}

/** The soonest next occurrence among active (not paused, not finished) rules; ties keep the name order. */
export function nextRecurring(
  rules: readonly RecurringRule[],
  now: Date,
  zone: TimeZone
): { rule: RecurringRule; date: Date } | undefined {
  let best: { rule: RecurringRule; date: Date } | undefined
  for (const rule of rules) {
    if (!isActive(rule, zone)) continue
    // The stored next date, or today if it already passed (not recorded yet): never a past day, as iOS.
    const stored = new Date(rule.nextDate)
    const today = startOfDay(now, zone)
    const date = occurrencesFrom(rule, stored > today ? stored : today, 1, zone)[0]
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
  const goals = orderedGoals(ledger.savingsGoals, now, ledger.timeZone)
  const first = goals[0]
  const totals = debtTotals(ledger.loans, ledger.personalDebts)
  const nextLoan = orderedLoans(ledger.loans, now, ledger.timeZone).find((entry) => entry.next)
  const next = nextRecurring(ledger.recurringRules, now, ledger.timeZone)
  return {
    recurring: {
      ruleCount: ledger.recurringRules.length,
      subscriptionCount: ledger.recurringRules.filter(
        (rule) =>
          rule.isSubscription && rule.kind === "expense" && isActive(rule, ledger.timeZone)
      ).length,
      subscriptionsPerMonth: subscriptionsPerMonth(
        ledger.recurringRules,
        ledger.settings.currencies,
        ledger.timeZone
      ),
      ...(next ? { next } : {}),
    },
    goals: {
      count: goals.length,
      ...(first
        ? { first: { goal: first, progress: savingsGoalProgress(first, now, ledger.timeZone) } }
        : {}),
    },
    debts: {
      totals,
      ...debtCounts(ledger),
      isEmpty:
        totals.youOwe.length === 0 &&
        totals.owedToYou.length === 0 &&
        !nextLoan,
      ...(nextLoan ? { nextLoan } : {}),
    },
  }
}

/** How many things each debt total adds up, counted the way `debtTotals` picks them. */
function debtCounts(ledger: Ledger): {
  youOweCount: number
  peopleOwingCount: number
} {
  const open = ledger.personalDebts.filter(
    (debt) => !isSettled(debt) && !debtRemaining(debt).isZero()
  )
  const loans = ledger.loans.filter(
    (loan) => loan.installmentCount - loan.payments.length > 0
  ).length
  const people = new Set(
    open
      .filter((debt) => debt.direction === "theyOweMe")
      .map((debt) => debt.person.trim().toLowerCase())
  )
  return {
    youOweCount:
      loans + open.filter((debt) => debt.direction === "iOwe").length,
    peopleOwingCount: people.size,
  }
}
