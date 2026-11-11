import { type SavingsGoalProgress } from "@/lib/domain"
import { formatAmount } from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"
import type { SavingsGoal, TargetMonth, TransactionCategory } from "@/lib/schema"

export const DEFAULT_GOAL_SYMBOL = "banknote"

/** The badge reads a category; a goal lends it its own id, color and symbol. */
export function goalBadge(goal: Pick<SavingsGoal, "id" | "name" | "color">): TransactionCategory {
  return {
    id: goal.id,
    name: goal.name,
    kind: "expense",
    isRenamed: false,
    ...(goal.color === undefined ? {} : { color: goal.color }),
  }
}

/** "December 2026" / "diciembre de 2026". */
export function targetMonthText(t: Translator, month: TargetMonth): string {
  return new Date(month.year, month.month - 1, 1).toLocaleDateString(t.locale, {
    month: "long",
    year: "numeric",
  })
}

export type GoalTone = "positive" | "pending" | "neutral"

/** The one line under a goal's bar: what to set aside, that it's done, or that the date passed. */
export function goalStatus(
  t: Translator,
  goal: SavingsGoal,
  progress: SavingsGoalProgress,
  money: (amount: string) => string
): { text: string; tone: GoalTone } {
  const remaining = money(progress.remaining.toFixed())
  if (progress.isReached) return { text: t.in("goals", "Goal reached"), tone: "positive" }
  if (progress.isOverdue) return { text: t.in("goals", "The date passed with %@ to go", remaining), tone: "pending" }
  if (progress.monthlyAmount && goal.targetMonth) {
    const monthly = money(progress.monthlyAmount.toFixed())
    return progress.monthsLeft === 1
      ? { text: t.in("goals", "Set aside %@ this month", monthly), tone: "neutral" }
      : {
          text: t.in("goals", "Set aside %@ a month until %@", monthly, targetMonthText(t, goal.targetMonth)),
          tone: "neutral",
        }
  }
  return { text: t.in("goals", "%@ to go", remaining), tone: "neutral" }
}

export const goalMoney = (goal: SavingsGoal) => (amount: string) => formatAmount(amount, goal.target.currency)
