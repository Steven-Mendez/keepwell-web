"use client"

import { useState, type CSSProperties } from "react"
import { Cell, Pie, PieChart } from "recharts"

import { AnimatedNumber } from "@/components/kw/animated-number"
import { KWSegmented } from "@/components/kw/design"
import { SpringFill } from "@/components/kw/motion"
import { CategoryBadge, Surface } from "@/components/kw/primitives"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import type { MonthlySummary, SummaryReport } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { categoryColor, categoryName } from "@/lib/presentation/display"
import type { TransactionCategory } from "@/lib/schema"
import { cn } from "@/lib/utils"

import type { SummaryFormat } from "./summary-format"

const OTHERS_COLOR = "var(--control-off)"

export type CategoryMode = "expenses" | "income"

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

  const rows = (breakdown?.entries ?? []).map((entry) => {
    if (entry.slice.kind === "others") {
      return {
        id: "others",
        name: t.in("summary", "%lld more categories", entry.slice.count),
        amount: f.money(entry.amount),
        percent: f.percent(entry.share),
        share: entry.share.toNumber(),
        value: entry.amount.toNumber(),
        color: OTHERS_COLOR,
        category: undefined,
      }
    }
    const category = byId.get(entry.slice.id)
    return {
      id: entry.slice.id,
      name: category ? categoryName(t, category) : entry.slice.id,
      amount: f.money(entry.amount),
      percent: f.percent(entry.share),
      share: entry.share.toNumber(),
      value: entry.amount.toNumber(),
      color: categoryColor(category ?? { id: entry.slice.id }),
      category,
    }
  })
  const count = selected
    ? (mode === "expenses" ? selected.categories : selected.incomeCategories)
        .length
    : 0
  const month = selected ? f.month(selected.month, "long", false) : ""
  const hovered = rows.find((row) => row.id === active)
  const config: ChartConfig = Object.fromEntries(
    rows.map((row) => [row.id, { label: row.name, color: row.color }])
  )

  return (
    <Surface className={cn("flex min-h-0 flex-col gap-4 p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="type-heading">{t.in("summary", "By category")}</h2>
          <p className="type-caption text-muted-foreground">
            {count === 0
              ? t.in(
                  "summary",
                  mode === "expenses" ? "No spending" : "No income"
                )
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
          {mode === "expenses"
            ? t.in("summary", "Nothing spent in %@.", month)
            : t.in("summary", "Nothing came in during %@.", month)}
        </p>
      ) : (
        // Ring on top and the list under it, so the card stands as a tall column beside the charts
        // (Mobbin: Rocket Money's spending breakdown, Wise's category bars).
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="relative mx-auto aspect-square w-full max-w-44 shrink-0">
            <ChartContainer
              config={config}
              className="aspect-square w-full"
              aria-hidden
            >
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="68%"
                  outerRadius="100%"
                  paddingAngle={rows.length > 1 ? 2 : 0}
                  cornerRadius={4}
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive="auto"
                  animationDuration={280}
                  animationEasing="ease-out"
                  onMouseLeave={() => setActive(undefined)}
                >
                  {rows.map((row) => (
                    <Cell
                      key={row.id}
                      fill={row.color}
                      fillOpacity={active && active !== row.id ? 0.35 : 1}
                      onMouseEnter={() => setActive(row.id)}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            {/* The ring is too small for a floating tooltip, so the hovered slice (or list row) takes over its center. */}
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
              aria-live="polite"
            >
              <AnimatedNumber
                value={
                  hovered
                    ? hovered.amount
                    : breakdown
                      ? f.money(breakdown.total)
                      : ""
                }
                className="type-amount-sm"
              />
              <span className="max-w-full truncate type-caption text-muted-foreground">
                {hovered
                  ? `${hovered.name} · ${hovered.percent}`
                  : t.in("summary", mode === "expenses" ? "spent" : "received")}
              </span>
            </div>
          </div>
          <ul
            className="-mx-2 flex min-h-0 flex-1 [scrollbar-width:thin] flex-col gap-1 overflow-y-auto"
            onMouseLeave={() => setActive(undefined)}
          >
            {rows.map((row) => (
              <li
                key={row.id}
                onMouseEnter={() => setActive(row.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors",
                  active === row.id && "bg-secondary/50"
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
            ))}
          </ul>
        </div>
      )}
    </Surface>
  )
}
