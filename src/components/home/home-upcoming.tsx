"use client"

import Link from "next/link"

import { useAppActions } from "@/components/app/app-actions"
import { KWSection, KWTransactionIcon } from "@/components/kw/design"
import { transactionAmountClass } from "@/components/kw/design-styles"
import { CategoryBadge } from "@/components/kw/primitives"
import { nextDateText } from "@/components/recurring/recurring-format"
import { BALANCE_MASK } from "@/hooks/use-hidden-balances"
import { upcoming, type Ledger } from "@/lib/domain"
import { formatAmount } from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"

/** Occurrences shown on Home: the next three within a week. */
export const HOME_UPCOMING_COUNT = 3
export const HOME_UPCOMING_DAYS = 7

/** "Upcoming": the next recurring movements within a week, with "See all" to Recurring. Hidden when none. */
export function UpcomingSection({
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
  const { openRuleEditor } = useAppActions()
  const next = upcoming(ledger.recurringRules, now, HOME_UPCOMING_DAYS).slice(
    0,
    HOME_UPCOMING_COUNT
  )
  if (next.length === 0) return null
  return (
    <KWSection
      title={t.in("web", "Upcoming")}
      action={
        <Link
          href="/recurring"
          className="type-label text-link transition-colors outline-none hover:text-link-hover focus-visible:underline"
        >
          {t.in("home", "See all")}
        </Link>
      }
    >
      <div className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card">
        {next.map(({ rule, date }) => {
          const category = ledger.categories.find(
            (candidate) => candidate.id === rule.categoryId
          )
          return (
            <button
              key={`${rule.id}-${date.toISOString()}`}
              type="button"
              onClick={() => openRuleEditor({ mode: "edit", ruleId: rule.id })}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left press-row outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50"
            >
              {rule.kind === "transfer" ? (
                <KWTransactionIcon style="transfer" className="size-8" />
              ) : (
                <CategoryBadge category={category} size="sm" />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate type-label text-foreground">
                  {rule.name}
                </span>
                <span className="truncate type-caption text-muted-foreground">
                  {nextDateText(t, date, now)}
                </span>
              </span>
              <span
                className={`shrink-0 type-label tabular-nums ${transactionAmountClass(rule.kind)}`}
              >
                {hidden
                  ? BALANCE_MASK
                  : formatAmount(rule.amount, rule.currency)}
              </span>
            </button>
          )
        })}
      </div>
    </KWSection>
  )
}
