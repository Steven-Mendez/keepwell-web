"use client"

import { useState, type CSSProperties } from "react"

import { KWSegmented } from "@/components/kw/design"
import { SpringFill } from "@/components/kw/motion"
import { CategoryBadge, Surface } from "@/components/kw/primitives"
import type { MonthlySummary, SummaryReport } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { categoryColor, categoryNameById } from "@/lib/presentation/display"
import type { TransactionCategory } from "@/lib/schema"
import { cn } from "@/lib/utils"

import { CategoryRing } from "./category-ring"
import type { SummaryFormat } from "./summary-format"

const OTHERS_COLOR = "var(--control-off)"

export type CategoryMode = "expenses" | "income"

/**
 * The mode-dependent texts, so the card reads one entry instead of branching on the mode each
 * time. Literal `t.in` calls keep the keys visible to the strings test.
 */
const MODE_TEXT: Record<
  CategoryMode,
  (t: Translator) => {
    empty: string
    total: string
    nothing: (month: string) => string
  }
> = {
  expenses: (t) => ({
    empty: t.in("summary", "No spending"),
    total: t.in("summary", "spent"),
    nothing: (month) => t.in("summary", "Nothing spent in %@.", month),
  }),
  income: (t) => ({
    empty: t.in("summary", "No income"),
    total: t.in("summary", "received"),
    nothing: (month) => t.in("summary", "Nothing came in during %@.", month),
  }),
}

type CategoryEntry = NonNullable<
  SummaryReport["expenseBreakdowns"][number]
>["entries"][number]

type CategoryRow = {
  id: string
  name: string
  amount: string
  percent: string
  share: number
  value: number
  color: string
  category: TransactionCategory | undefined
}

/** One ring slice and list row: a category, or the "N more categories" tail. */
function categoryRow(
  t: Translator,
  f: SummaryFormat,
  entry: CategoryEntry,
  byId: ReadonlyMap<string, TransactionCategory>
): CategoryRow {
  const figures = {
    amount: f.money(entry.amount),
    percent: f.percent(entry.share),
    share: entry.share.toNumber(),
    value: entry.amount.toNumber(),
  }
  if (entry.slice.kind === "others") {
    return {
      id: "others",
      name: t.in("summary", "%lld more categories", entry.slice.count),
      ...figures,
      color: OTHERS_COLOR,
      category: undefined,
    }
  }
  const category = byId.get(entry.slice.id)
  return {
    id: entry.slice.id,
    name: categoryNameById(t, category, entry.slice.id),
    ...figures,
    color: categoryColor(category ?? { id: entry.slice.id }),
    category,
  }
}

function categoryCount(
  selected: MonthlySummary | undefined,
  mode: CategoryMode
) {
  if (!selected) return 0
  return (mode === "expenses" ? selected.categories : selected.incomeCategories)
    .length
}

function CategoryListItem({
  row,
  isActive,
  onActivate,
}: {
  row: CategoryRow
  isActive: boolean
  onActivate: () => void
}) {
  return (
    <li
      onMouseEnter={onActivate}
      className={cn(
        "flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors",
        isActive && "bg-secondary/50"
      )}
    >
      {row.category ? (
        <CategoryBadge category={row.category} size="sm" />
      ) : (
        <span
          className="inline-flex size-8 items-center justify-center rounded-full bg-secondary type-caption text-muted-foreground"
          aria-hidden
        >
          •••
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-label">{row.name}</span>
        <span
          className="mt-1 h-1 overflow-hidden rounded-full bg-secondary"
          style={{ "--fill": row.color } as CSSProperties}
          aria-hidden
        >
          <SpringFill fraction={row.share} className="bg-(--fill)" />
        </span>
      </span>
      <span className="flex flex-col items-end">
        <span className="type-label tabular-nums">{row.amount}</span>
        <span className="type-caption-sm text-muted-foreground tabular-nums">
          {row.percent}
        </span>
      </span>
    </li>
  )
}

/** The selected month's categories as a ring and the list under it, both from one breakdown. */
export function CategoryCard({
  t,
  f,
  report,
  selectedIndex,
  categories,
  mode,
  onModeChange,
  className,
}: {
  t: Translator
  f: SummaryFormat
  report: SummaryReport
  selectedIndex: number
  categories: readonly TransactionCategory[]
  /** iOS: "Expenses / Income" beside the title; here in the card's own header, the only thing it changes. */
  mode: CategoryMode
  onModeChange: (mode: CategoryMode) => void
  className?: string
}) {
  const [active, setActive] = useState<string>()
  const breakdown = (
    mode === "expenses" ? report.expenseBreakdowns : report.incomeBreakdowns
  )[selectedIndex]
  const selected: MonthlySummary | undefined = report.months[selectedIndex]
  const byId = new Map(categories.map((category) => [category.id, category]))

  const rows = (breakdown?.entries ?? []).map((entry) =>
    categoryRow(t, f, entry, byId)
  )
  const count = categoryCount(selected, mode)
  const month = selected ? f.month(selected.month, "long", false) : ""

  return (
    <Surface className={cn("flex min-h-0 flex-col gap-4 p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="type-heading">{t.in("summary", "By category")}</h2>
          <p className="type-caption text-muted-foreground">
            {count === 0
              ? MODE_TEXT[mode](t).empty
              : t.in("summary", "%lld categories", count)}
          </p>
        </div>
        <KWSegmented
          style="compact"
          aria-label={t.in("summary", "By category")}
          value={mode}
          onChange={onModeChange}
          options={[
            { value: "expenses", title: t.in("summary", "Expenses") },
            { value: "income", title: t.in("summary", "Income") },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center type-body text-muted-foreground">
          {MODE_TEXT[mode](t).nothing(month)}
        </p>
      ) : (
        // Ring on top and the list under it, so the card stands as a tall column beside the charts
        // (Mobbin: Rocket Money's spending breakdown, Wise's category bars).
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <CategoryRing
            slices={rows}
            active={active}
            onActiveChange={setActive}
            total={breakdown ? f.money(breakdown.total) : ""}
            totalCaption={MODE_TEXT[mode](t).total}
            className="max-w-44"
          />
          <ul
            className="-mx-2 flex min-h-0 flex-1 [scrollbar-width:thin] flex-col gap-1 overflow-y-auto"
            onMouseLeave={() => setActive(undefined)}
          >
            {rows.map((row) => (
              <CategoryListItem
                key={row.id}
                row={row}
                isActive={active === row.id}
                onActivate={() => setActive(row.id)}
              />
            ))}
          </ul>
        </div>
      )}
    </Surface>
  )
}
