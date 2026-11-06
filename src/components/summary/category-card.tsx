"use client"

import { useState } from "react"
import { Cell, Pie, PieChart, Tooltip } from "recharts"

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
  className,
}: {
  t: Translator
  f: SummaryFormat
  report: SummaryReport
  selectedIndex: number
  categories: readonly TransactionCategory[]
  /** Chosen in the summary header (iOS: "Expenses / Income" beside the title). */
  mode: CategoryMode
  className?: string
}) {
  const [active, setActive] = useState<string>()
  const breakdown = (mode === "expenses" ? report.expenseBreakdowns : report.incomeBreakdowns)[selectedIndex]
  const selected: MonthlySummary | undefined = report.months[selectedIndex]
  const byId = new Map(categories.map((category) => [category.id, category]))

  const rows = (breakdown?.entries ?? []).map((entry) => {
    if (entry.slice.kind === "others") {
      return { id: "others", name: t.in("summary", "%lld more categories", entry.slice.count), amount: f.money(entry.amount), percent: f.percent(entry.share), value: entry.amount.toNumber(), color: OTHERS_COLOR, category: undefined }
    }
    const category = byId.get(entry.slice.id)
    return {
      id: entry.slice.id,
      name: category ? categoryName(t, category) : entry.slice.id,
      amount: f.money(entry.amount),
      percent: f.percent(entry.share),
      value: entry.amount.toNumber(),
      color: categoryColor(category ?? { id: entry.slice.id }),
      category,
    }
  })
  const count = selected ? (mode === "expenses" ? selected.categories : selected.incomeCategories).length : 0
  const month = selected ? f.month(selected.month, "long", false) : ""
  const config: ChartConfig = Object.fromEntries(rows.map((row) => [row.id, { label: row.name, color: row.color }]))

  return (
    <Surface className={cn("flex flex-col gap-4 p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="type-heading">{t.in("summary", "By category")}</h2>
          <p className="type-caption text-muted-foreground">
            {count === 0 ? t.in("summary", mode === "expenses" ? "No spending" : "No income") : t.in("summary", "%lld categories", count)}
          </p>
        </div>

      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center type-body text-muted-foreground">
          {mode === "expenses" ? t.in("summary", "Nothing spent in %@.", month) : t.in("summary", "Nothing came in during %@.", month)}
        </p>
      ) : (
        <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,13rem)_1fr]">
          <div className="relative mx-auto aspect-square w-full max-w-52">
            <ChartContainer config={config} className="aspect-square w-full" aria-hidden>
              <PieChart>
                <Tooltip
                  content={({ active: isActive, payload }) => {
                    const row = isActive ? (payload?.[0]?.payload as (typeof rows)[number] | undefined) : undefined
                    if (!row) return null
                    return (
                      <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 type-caption shadow-depth">
                        <span className="size-2 rounded-full" style={{ backgroundColor: row.color }} />
                        <span>{row.name}</span>
                        <span className="tabular-nums text-text-secondary">
                          {row.amount} · {row.percent}
                        </span>
                      </div>
                    )
                  }}
                />
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
                  isAnimationActive={false}
                  onMouseLeave={() => setActive(undefined)}
                >
                  {rows.map((row) => (
                    <Cell key={row.id} fill={row.color} fillOpacity={active && active !== row.id ? 0.35 : 1} onMouseEnter={() => setActive(row.id)} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="type-amount-sm">{breakdown ? f.money(breakdown.total) : ""}</span>
              <span className="type-caption text-muted-foreground">{t.in("summary", mode === "expenses" ? "spent" : "received")}</span>
            </div>
          </div>
          <ul className="flex flex-col gap-1" onMouseLeave={() => setActive(undefined)}>
            {rows.map((row) => (
              <li
                key={row.id}
                onMouseEnter={() => setActive(row.id)}
                className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors", active === row.id && "bg-secondary/50")}
              >
                {row.category ? (
                  <CategoryBadge category={row.category} size="sm" />
                ) : (
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-secondary type-caption text-muted-foreground" aria-hidden>
                    •••
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate type-label">{row.name}</span>
                  <span className="h-1 overflow-hidden rounded-full bg-secondary" aria-hidden>
                    <span className="block h-full rounded-full" style={{ width: row.percent, backgroundColor: row.color }} />
                  </span>
                </span>
                <span className="flex flex-col items-end">
                  <span className="type-label tabular-nums">{row.amount}</span>
                  <span className="type-caption-sm text-muted-foreground tabular-nums">{row.percent}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Surface>
  )
}
