"use client"

import Link from "next/link"
import type { CSSProperties } from "react"

import { SpringFill } from "@/components/kw/motion"
import { CategoryBadge, Surface } from "@/components/kw/primitives"
import {
  budgetStatuses,
  otherCurrencyBudgets,
  type BudgetLevel,
  type MonthlySummary,
} from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { categoryNameById } from "@/lib/presentation/display"
import type { TransactionCategory } from "@/lib/schema"
import { cn } from "@/lib/utils"

import type { SummaryFormat } from "./summary-format"

const FILL: Record<BudgetLevel, string> = {
  onTrack: "var(--accent)",
  nearLimit: "var(--pending)",
  exceeded: "var(--negative)",
}

/**
 * The selected month's spending against each category budget; absent when none is set. Budgets in
 * another currency than the month's (the principal changed since) are named, not converted, with a
 * way to edit them.
 */
export function BudgetCard({
  t,
  f,
  summary,
  categories,
  className,
}: {
  t: Translator
  f: SummaryFormat
  summary: MonthlySummary | undefined
  categories: readonly TransactionCategory[]
  className?: string
}) {
  if (!summary) return null
  const statuses = budgetStatuses(summary, categories)
  const skipped = otherCurrencyBudgets(summary, categories)
  if (statuses.length === 0 && skipped.length === 0) return null
  const byId = new Map(categories.map((category) => [category.id, category]))

  return (
    <Surface className={cn("flex flex-col gap-4 p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="type-heading">{t.in("summary", "Budgets")}</h2>
        {skipped.length > 0 ? (
          <Link
            href="/settings/categories#expense"
            className="type-label text-link transition-colors outline-none hover:text-link-hover focus-visible:underline"
          >
            {t.in("summary", "Edit budgets")}
          </Link>
        ) : null}
      </div>
      {skipped.map((group) => (
        <p key={group.currency} className="type-caption text-muted-foreground">
          {t.in(
            "summary",
            "%lld budgets are in %@ and aren't compared",
            group.count,
            group.currency
          )}
        </p>
      ))}
      <ul className="grid gap-x-8 gap-y-3 empty:hidden md:grid-cols-2 xl:grid-cols-3">
        {statuses.map((status) => {
          const category = byId.get(status.categoryId)
          const remaining = status.budget.minus(status.spent)
          return (
            <li key={status.categoryId} className="flex items-center gap-3">
              {category ? <CategoryBadge category={category} size="sm" /> : null}
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate type-label">
                    {categoryNameById(t, category, status.categoryId)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 type-caption tabular-nums",
                      status.level === "exceeded"
                        ? "text-negative"
                        : status.level === "nearLimit"
                          ? "text-pending"
                          : "text-muted-foreground"
                    )}
                  >
                    {remaining.lt(0)
                      ? t.in("summary", "%@ over", f.money(remaining.abs()))
                      : t.in("summary", "%@ left", f.money(remaining))}
                  </span>
                </span>
                <span
                  className="h-1.5 overflow-hidden rounded-full bg-secondary"
                  style={{ "--fill": FILL[status.level] } as CSSProperties}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(status.ratio.toNumber() * 100)}
                  aria-label={categoryNameById(t, category, status.categoryId)}
                >
                  <SpringFill fraction={status.ratio.toNumber()} className="bg-(--fill)" />
                </span>
                <span className="type-caption-sm text-muted-foreground tabular-nums">
                  {t.in("summary", "%@ of %@", f.money(status.spent), f.money(status.budget))}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </Surface>
  )
}
