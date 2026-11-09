"use client"

import Link from "next/link"
import type { CSSProperties } from "react"

import { DEFAULT_GOAL_SYMBOL, goalBadge } from "@/components/goals/goal-format"
import { KWSection } from "@/components/kw/design"
import { SpringFill } from "@/components/kw/motion"
import { CategoryBadge } from "@/components/kw/primitives"
import { BALANCE_MASK } from "@/hooks/use-hidden-balances"
import { orderedGoals, savingsGoalProgress, type Ledger } from "@/lib/domain"
import { formatAmount } from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"

/**
 * iOS HomeGoalsCard: always on Home, so goals have a way in before the first one. With goals it shows
 * the first in list order and its bar; without, says there are none yet.
 */
export function GoalsSection({
  t,
  ledger,
  now,
  hidden,
}: {
  t: Translator
  ledger: Ledger
  now: Date
  hidden: boolean
}) {
  const goal = orderedGoals(ledger.savingsGoals, now)[0]
  const progress = goal ? savingsGoalProgress(goal, now) : undefined
  return (
    <KWSection
      title={t.in("home", "Savings goals")}
      action={
        <Link
          href="/goals"
          className="type-label text-link transition-colors outline-none hover:text-link-hover focus-visible:underline"
        >
          {t.in("home", "See all")}
        </Link>
      }
    >
      <Link
        href="/goals"
        className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 press-row outline-none hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {goal && progress ? (
          <>
            <CategoryBadge category={goalBadge(goal)} symbol={goal.icon ?? DEFAULT_GOAL_SYMBOL} />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate type-body font-semibold">{goal.name}</span>
                <span className="shrink-0 type-caption text-muted-foreground tabular-nums">
                  {t.in(
                    "home",
                    "%@ of %@",
                    hidden ? BALANCE_MASK : formatAmount(goal.saved, goal.target.currency),
                    hidden ? BALANCE_MASK : formatAmount(goal.target.amount, goal.target.currency)
                  )}
                </span>
              </span>
              <span
                className="h-1.5 overflow-hidden rounded-full bg-secondary"
                style={{ "--fill": progress.isReached ? "var(--positive)" : "var(--accent)" } as CSSProperties}
                aria-hidden
              >
                <SpringFill fraction={progress.fraction.toNumber()} className="bg-(--fill)" />
              </span>
            </span>
          </>
        ) : (
          <span className="type-body text-muted-foreground">{t.in("home", "No goals yet")}</span>
        )}
      </Link>
    </KWSection>
  )
}
