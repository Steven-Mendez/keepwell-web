"use client"

import { useState, type CSSProperties, type ReactNode } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { AnimatedNumber } from "@/components/kw/animated-number"
import { KWSegmented } from "@/components/kw/design"
import { SpringFill } from "@/components/kw/motion"
import { CategoryBadge, Surface } from "@/components/kw/primitives"
import {
  toneClass,
  type SummaryFormat,
  type Tone,
} from "@/components/summary/summary-format"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import {
  Decimal,
  cashFlowOutcome,
  monthKey,
  savings,
  savingsRate,
  type CategoryChange,
  type MonthlySummary,
  type TrendReport,
  type YearTotals,
} from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { categoryColor, categoryNameById } from "@/lib/presentation/display"
import type { TransactionCategory } from "@/lib/schema"
import { cn } from "@/lib/utils"

import { CategoryRing, type RingSlice } from "./category-ring"
import { MonthFlowTable } from "./month-flow-table"
import {
  axisMonth,
  changePercent,
  changeTone,
  comparisonLabel,
  rangeText,
} from "./range-format"

interface CardProps {
  t: Translator
  f: SummaryFormat
  report: TrendReport
  className?: string
}

const OTHERS_COLOR = "var(--control-off)"
const animation = {
  isAnimationActive: "auto" as const,
  animationDuration: 280,
  animationEasing: "ease-out" as const,
}

function toneOf(income: Decimal, expense: Decimal): Tone {
  const kind = cashFlowOutcome(income, expense).kind
  return kind === "saved"
    ? "positive"
    : kind === "overspent"
      ? "negative"
      : "neutral"
}

const multiYear = (report: TrendReport) =>
  report.range.start.year !== report.range.end.year

function CardHeader({
  title,
  caption,
  trailing,
}: {
  title: string
  caption?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <h2 className="type-heading">{title}</h2>
        {caption ? (
          <p className="type-caption text-muted-foreground">{caption}</p>
        ) : null}
      </div>
      {trailing}
    </div>
  )
}

function Legend({ items }: { items: { label: string; swatch: ReactNode }[] }) {
  return (
    <ul
      className="flex flex-wrap items-center gap-x-4 gap-y-1 type-caption text-text-secondary"
      aria-hidden
    >
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          {item.swatch}
          {item.label}
        </li>
      ))}
    </ul>
  )
}

const dot = (className: string) => (
  <span className={cn("size-2.5 rounded-full", className)} />
)
const solidLine = (color: string) => (
  <span className="h-0.5 w-4 rounded-full" style={{ background: color }} />
)
const dashedLine = (
  <span className="h-0 w-4 border-t-2 border-dashed border-text-faint" />
)

function TooltipBox({
  title,
  rows,
  footer,
}: {
  title: string
  rows: { label: string; value: string; swatch?: ReactNode }[]
  footer?: ReactNode
}) {
  return (
    <div className="grid min-w-44 gap-1.5 rounded-xl bg-secondary px-3 py-2 type-caption shadow-depth">
      <span className="type-label">{title}</span>
      {rows.map((row) => (
        <span
          key={row.label}
          className="flex items-center justify-between gap-4"
        >
          <span className="flex items-center gap-1.5 text-text-secondary">
            {row.swatch}
            {row.label}
          </span>
          <span className="tabular-nums">{row.value}</span>
        </span>
      ))}
      {footer}
    </div>
  )
}

// Tiles: the period's four answers before any chart.

export function TrendKpis({ t, f, report }: CardProps) {
  const { cashFlow, comparisonCashFlow, hasComparison } = report
  const net = savings(cashFlow)
  const rate = savingsRate(cashFlow)
  const versus = (current: Decimal, previous: Decimal, upIsGood: boolean) => {
    const change = hasComparison
      ? changePercent(f, current, previous)
      : undefined
    return change
      ? {
          text: `${change} ${comparisonLabel(t, f, report.comparison)}`,
          tone: changeTone(current, previous, upIsGood),
        }
      : undefined
  }
  const savedChange = hasComparison
    ? net.minus(savings(comparisonCashFlow))
    : undefined

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <Tile
        label={
          net.lt(0) ? t.in("web", "You overspent") : t.in("web", "You saved")
        }
        value={f.money(net, net.gt(0) ? "always" : "automatic")}
        tone={toneOf(cashFlow.income, cashFlow.expense)}
        caption={
          rate && rate.gt(0)
            ? t.in("web", "You kept %@ of what came in", f.percent(rate))
            : undefined
        }
        detail={
          savedChange && !savedChange.isZero()
            ? {
                text: t.in(
                  "web",
                  savedChange.gt(0) ? "%@ more than %@" : "%@ less than %@",
                  f.money(savedChange.abs()),
                  rangeText(f, report.comparison)
                ),
                tone: savedChange.gt(0) ? "positive" : "negative",
              }
            : undefined
        }
      />
      <Tile
        dot="bg-positive"
        label={t.in("summary", "Came in")}
        value={f.money(cashFlow.income)}
        detail={versus(cashFlow.income, comparisonCashFlow.income, true)}
      />
      <Tile
        dot="bg-negative"
        label={t.in("summary", "Went out")}
        value={f.money(cashFlow.expense)}
        detail={versus(cashFlow.expense, comparisonCashFlow.expense, false)}
      />
      <Tile
        label={t.in("web", "Average spending")}
        value={
          report.averageExpense
            ? f.money(report.averageExpense)
            : f.money(cashFlow.expense)
        }
        caption={t.in("web", "per month")}
        detail={
          report.averageIncome
            ? {
                text: t.in(
                  "web",
                  "Income averages %@",
                  f.money(report.averageIncome)
                ),
                tone: "neutral",
              }
            : undefined
        }
      />
    </div>
  )
}

function Tile({
  label,
  value,
  caption,
  detail,
  tone = "neutral",
  dot: dotClass,
}: {
  label: string
  value: string
  caption?: string | undefined
  detail?: { text: string; tone: Tone } | undefined
  tone?: Tone
  dot?: string
}) {
  return (
    <Surface className="flex min-w-0 flex-col gap-1 p-4">
      <span className="flex items-center gap-1.5 truncate type-caption text-text-secondary">
        {dotClass ? (
          <span
            className={cn("size-2 shrink-0 rounded-full", dotClass)}
            aria-hidden
          />
        ) : null}
        {label}
      </span>
      <AnimatedNumber
        value={value}
        className={cn("type-title-sm leading-tight", toneClass[tone])}
      />
      {caption ? (
        <span className="line-clamp-1 type-caption-sm text-muted-foreground">
          {caption}
        </span>
      ) : null}
      {detail ? (
        <span
          className={cn(
            "line-clamp-2 type-caption-sm",
            detail.tone === "neutral"
              ? "text-muted-foreground"
              : toneClass[detail.tone]
          )}
          title={detail.text}
        >
          {detail.text}
        </span>
      ) : null}
    </Surface>
  )
}

// Month by month: what came in against what went out, with the period's average spending.

export function MonthlyFlowCard({ t, f, report, className }: CardProps) {
  const many = multiYear(report)
  const data = report.months.map((month) => ({
    key: monthKey(month.month),
    label: axisMonth(f, month.month, many),
    name: f.month(month.month, "long", true, true),
    income: month.income.toNumber(),
    expense: month.expense.toNumber(),
    incomeText: f.money(month.income),
    expenseText: f.money(month.expense),
    net: savings(month),
    tone: toneOf(month.income, month.expense),
  }))
  const average = report.averageExpense
  const config = {
    income: { label: "income", color: "var(--positive)" },
    expense: { label: "expense", color: "var(--negative)" },
  } satisfies ChartConfig

  return (
    <Surface className={cn("flex min-h-0 flex-col gap-3 p-4", className)}>
      <CardHeader
        title={t.in("web", "Month by month")}
        caption={
          average
            ? t.in("summary", "Average %@ / month", f.money(average))
            : undefined
        }
        trailing={
          <Legend
            items={[
              { label: t.in("summary", "Came in"), swatch: dot("bg-positive") },
              {
                label: t.in("summary", "Went out"),
                swatch: dot("bg-negative"),
              },
            ]}
          />
        }
      />
      <ChartContainer
        config={config}
        className="aspect-auto h-64 w-full"
        aria-hidden
      >
        <BarChart
          data={data}
          barGap={2}
          barCategoryGap={data.length > 18 ? "12%" : "24%"}
          margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--divider)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            width={64}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => f.compact(value)}
          />
          <Tooltip
            cursor={{ fill: "var(--accent)", opacity: 0.5 }}
            content={({ active, payload }) => {
              const row = active
                ? (payload?.[0]?.payload as (typeof data)[number] | undefined)
                : undefined
              if (!row) return null
              return (
                <TooltipBox
                  title={row.name}
                  rows={[
                    {
                      label: t.in("summary", "Came in"),
                      value: row.incomeText,
                      swatch: dot("size-2 bg-positive"),
                    },
                    {
                      label: t.in("summary", "Went out"),
                      value: row.expenseText,
                      swatch: dot("size-2 bg-negative"),
                    },
                  ]}
                  footer={
                    <span className={cn("type-label", toneClass[row.tone])}>
                      {f.money(row.net, "always")}
                    </span>
                  }
                />
              )
            }}
          />
          {average ? (
            <ReferenceLine
              y={average.toNumber()}
              stroke="var(--text-faint)"
              strokeDasharray="4 4"
            />
          ) : null}
          <Bar
            dataKey="income"
            fill="var(--positive)"
            radius={[4, 4, 0, 0]}
            {...animation}
          />
          <Bar
            dataKey="expense"
            fill="var(--negative)"
            radius={[4, 4, 0, 0]}
            {...animation}
          />
        </BarChart>
      </ChartContainer>
      <MonthTable t={t} f={f} months={report.months} />
    </Surface>
  )
}

function MonthTable({
  t,
  f,
  months,
}: {
  t: Translator
  f: SummaryFormat
  months: readonly MonthlySummary[]
}) {
  const rows = months.map((month) => ({
    key: monthKey(month.month),
    name: f.month(month.month, "long", true, true),
    income: f.money(month.income),
    expense: f.money(month.expense),
    result: f.money(savings(month), "always"),
  }))
  return (
    <MonthFlowTable t={t} caption={t.in("web", "Month by month")} rows={rows} />
  )
}

// Savings building up: the period's line against the comparison's, month for month.

export function SavingsCard({ t, f, report, className }: CardProps) {
  const many = multiYear(report)
  const data = report.months.map((month, index) => {
    const current = report.cumulativeSavings[index]
    const previous = report.hasComparison
      ? report.comparisonCumulativeSavings[index]
      : undefined
    const before = report.comparisonMonths[index]
    return {
      label: axisMonth(f, month.month, many),
      name: f.month(month.month, "long", true, true),
      previousName: before ? f.month(before.month, "long", true, true) : "",
      current: current?.toNumber() ?? 0,
      currentText: current ? f.money(current, "always") : "",
      ...(previous
        ? {
            previous: previous.toNumber(),
            previousText: f.money(previous, "always"),
          }
        : {}),
    }
  })
  const total = report.cumulativeSavings.at(-1)
  const currentLegend = rangeText(f, report.range)
  const previousLegend = rangeText(f, report.comparison)
  const config = {
    current: { label: currentLegend, color: "var(--chart-1)" },
    previous: { label: previousLegend, color: "var(--text-faint)" },
  } satisfies ChartConfig

  return (
    <Surface className={cn("flex min-h-0 flex-col gap-3 p-4", className)}>
      <CardHeader
        title={t.in("web", "Savings over time")}
        caption={
          total
            ? t.in("web", "Running total of what you kept, month after month")
            : undefined
        }
        trailing={
          <Legend
            items={[
              { label: currentLegend, swatch: solidLine("var(--chart-1)") },
              ...(report.hasComparison
                ? [{ label: previousLegend, swatch: dashedLine }]
                : []),
            ]}
          />
        }
      />
      <ChartContainer
        config={config}
        className="aspect-auto h-56 w-full"
        aria-hidden
      >
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--divider)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            width={64}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => f.compact(value)}
          />
          <ReferenceLine y={0} stroke="var(--text-faint)" strokeOpacity={0.6} />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            content={({ active, payload }) => {
              const row = active
                ? (payload?.[0]?.payload as (typeof data)[number] | undefined)
                : undefined
              if (!row) return null
              return (
                <TooltipBox
                  title={row.name}
                  rows={[
                    {
                      label: t.in("web", "Saved so far"),
                      value: row.currentText,
                      swatch: solidLine("var(--chart-1)"),
                    },
                    ...(row.previousText
                      ? [
                          {
                            label: row.previousName,
                            value: row.previousText,
                            swatch: dashedLine,
                          },
                        ]
                      : []),
                  ]}
                />
              )
            }}
          />
          {report.hasComparison ? (
            <Line
              dataKey="previous"
              type="monotone"
              stroke="var(--text-faint)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              {...animation}
            />
          ) : null}
          <Line
            dataKey="current"
            type="monotone"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            dot={data.length <= 12 ? { r: 3 } : false}
            activeDot={{ r: 5 }}
            {...animation}
          />
        </LineChart>
      </ChartContainer>
    </Surface>
  )
}

// Where the money went: the period's ring, each category against the comparison.

type Mode = "expenses" | "income"

/** The mode-dependent texts; literal `t.in` calls keep the keys visible to the strings test. */
const MODE_TEXT: Record<
  Mode,
  (t: Translator) => { empty: string; total: string }
> = {
  expenses: (t) => ({
    empty: t.in("summary", "No spending"),
    total: t.in("summary", "spent"),
  }),
  income: (t) => ({
    empty: t.in("summary", "No income"),
    total: t.in("summary", "received"),
  }),
}

type CategoryLookup = ReadonlyMap<string, TransactionCategory>

/** The name and color a category id shows with, falling back to the id when the category is gone. */
function categoryLook(t: Translator, byId: CategoryLookup, id: string) {
  const category = byId.get(id)
  return {
    category,
    name: categoryNameById(t, category, id),
    color: categoryColor(category ?? { id }),
  }
}

/** The ring's slices: the largest categories and the "N more categories" tail. */
function ringSlices(
  t: Translator,
  f: SummaryFormat,
  breakdown: TrendReport["expenseBreakdown"],
  byId: CategoryLookup
): RingSlice[] {
  return breakdown.entries.map((entry) => {
    const figures = {
      value: entry.amount.toNumber(),
      amount: f.money(entry.amount),
      percent: f.percent(entry.share),
    }
    if (entry.slice.kind === "others")
      return {
        id: "others",
        name: t.in("summary", "%lld more categories", entry.slice.count),
        ...figures,
        color: OTHERS_COLOR,
      }
    const { name, color } = categoryLook(t, byId, entry.slice.id)
    return { id: entry.slice.id, name, ...figures, color }
  })
}

/** One mode's side of the report: its breakdown, its per-category changes and whether the comparison had any. */
function modeData(report: TrendReport, mode: Mode) {
  const expenses = mode === "expenses"
  const changes = expenses ? report.expenseCategories : report.incomeCategories
  const comparisonTotal = expenses
    ? report.comparisonCashFlow.expense
    : report.comparisonCashFlow.income
  return {
    breakdown: expenses ? report.expenseBreakdown : report.incomeBreakdown,
    changes,
    comparable: report.hasComparison && comparisonTotal.gt(0),
  }
}

function CategoryChangeItem({
  t,
  f,
  entry,
  look,
  isActive,
  onActivate,
  comparable,
  upIsGood,
}: {
  t: Translator
  f: SummaryFormat
  entry: CategoryChange
  look: ReturnType<typeof categoryLook>
  isActive: boolean
  onActivate: () => void
  comparable: boolean
  upIsGood: boolean
}) {
  const { category, name, color } = look
  return (
    <li
      onMouseEnter={onActivate}
      className={cn(
        "flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors",
        isActive && "bg-secondary/50"
      )}
    >
      {category ? (
        <CategoryBadge category={category} size="sm" />
      ) : (
        <span
          className="inline-flex size-8 rounded-full bg-secondary"
          aria-hidden
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-label">{name}</span>
        <span
          className="mt-1 h-1 overflow-hidden rounded-full bg-secondary"
          style={{ "--fill": color } as CSSProperties}
          aria-hidden
        >
          <SpringFill
            fraction={entry.share.toNumber()}
            className="bg-(--fill)"
          />
        </span>
      </span>
      <span className="flex flex-col items-end">
        <span className="type-label tabular-nums">{f.money(entry.amount)}</span>
        <span className="flex items-center gap-1.5 type-caption-sm tabular-nums">
          <span className="text-muted-foreground">
            {f.percent(entry.share)}
          </span>
          {comparable ? (
            <ChangeChip t={t} f={f} entry={entry} upIsGood={upIsGood} />
          ) : null}
        </span>
      </span>
    </li>
  )
}

export function CategoriesCard({
  t,
  f,
  report,
  categories,
  className,
}: CardProps & { categories: readonly TransactionCategory[] }) {
  const [mode, setMode] = useState<Mode>("expenses")
  const [active, setActive] = useState<string>()
  const byId = new Map(categories.map((category) => [category.id, category]))
  const { breakdown, changes, comparable } = modeData(report, mode)
  const slices = ringSlices(t, f, breakdown, byId)
  // The list names every category, not only the ring's largest, so nothing hides in "others".
  const rows = [
    ...new Map(changes.map((entry) => [entry.categoryId, entry])).values(),
  ].filter((entry) => entry.amount.gt(0))
  const text = MODE_TEXT[mode](t)

  return (
    <Surface className={cn("flex min-h-0 flex-col gap-4 p-4", className)}>
      <CardHeader
        title={t.in("summary", "By category")}
        caption={
          comparable ? comparisonLabel(t, f, report.comparison) : undefined
        }
        trailing={
          <KWSegmented
            style="compact"
            aria-label={t.in("summary", "By category")}
            value={mode}
            onChange={setMode}
            options={[
              { value: "expenses", title: t.in("summary", "Expenses") },
              { value: "income", title: t.in("summary", "Income") },
            ]}
          />
        }
      />
      {rows.length === 0 ? (
        <p className="py-10 text-center type-body text-muted-foreground">
          {text.empty}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <CategoryRing
            slices={slices}
            active={active}
            onActiveChange={setActive}
            total={f.money(breakdown.total)}
            totalCaption={text.total}
            className="max-w-48"
          />
          <ul
            className="-mx-2 flex min-h-0 flex-1 [scrollbar-width:thin] flex-col gap-1 overflow-y-auto lg:max-h-[520px]"
            onMouseLeave={() => setActive(undefined)}
          >
            {rows.map((entry) => (
              <CategoryChangeItem
                key={entry.categoryId}
                t={t}
                f={f}
                entry={entry}
                look={categoryLook(t, byId, entry.categoryId)}
                isActive={active === entry.categoryId}
                onActivate={() => setActive(entry.categoryId)}
                comparable={comparable}
                upIsGood={mode === "income"}
              />
            ))}
          </ul>
        </div>
      )}
    </Surface>
  )
}

function ChangeChip({
  t,
  f,
  entry,
  upIsGood,
}: {
  t: Translator
  f: SummaryFormat
  entry: CategoryChange
  upIsGood: boolean
}) {
  if (!entry.previous.gt(0))
    return (
      <span className="rounded-full bg-secondary px-1.5 text-text-secondary">
        {t.in("web", "New")}
      </span>
    )
  const text = changePercent(f, entry.amount, entry.previous) ?? ""
  const tone = changeTone(entry.amount, entry.previous, upIsGood)
  return (
    <span
      className={cn(
        tone === "neutral" ? "text-muted-foreground" : toneClass[tone]
      )}
      title={t.in("web", "Before: %@", f.money(entry.previous))}
    >
      {text}
    </span>
  )
}

// The largest categories month by month: is food creeping up, did transport drop off?

export function CategoryTrendsCard({
  t,
  f,
  report,
  categories,
  className,
}: CardProps & { categories: readonly TransactionCategory[] }) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const many = multiYear(report)
  const series = report.categoryTrends.map((trend) => {
    const category = byId.get(trend.categoryId)
    return {
      id: trend.categoryId,
      name: categoryNameById(t, category, trend.categoryId),
      color: categoryColor(category ?? { id: trend.categoryId }),
    }
  })
  const data = report.months.map((month, index) => ({
    label: axisMonth(f, month.month, many),
    name: f.month(month.month, "long", true, true),
    ...Object.fromEntries(
      report.categoryTrends.map((trend) => [
        trend.categoryId,
        trend.amounts[index]?.toNumber() ?? 0,
      ])
    ),
  }))
  const config: ChartConfig = Object.fromEntries(
    series.map((item) => [item.id, { label: item.name, color: item.color }])
  )

  return (
    <Surface className={cn("flex min-h-0 flex-col gap-3 p-4", className)}>
      <CardHeader
        title={t.in("web", "Top categories over time")}
        caption={t.in(
          "web",
          "Your largest spending categories, month by month"
        )}
        trailing={
          <Legend
            items={series.map((item) => ({
              label: item.name,
              swatch: solidLine(item.color),
            }))}
          />
        }
      />
      {series.length === 0 ? (
        <p className="py-10 text-center type-body text-muted-foreground">
          {t.in("summary", "No spending")}
        </p>
      ) : (
        <ChartContainer
          config={config}
          className="aspect-auto h-56 w-full"
          aria-hidden
        >
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--divider)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => f.compact(value)}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              content={({ active, payload }) => {
                const row = active
                  ? (payload?.[0]?.payload as
                      Record<string, string | number> | undefined)
                  : undefined
                if (!row) return null
                return (
                  <TooltipBox
                    title={String(row.name)}
                    rows={series.map((item) => ({
                      label: item.name,
                      value: f.money(dec(row[item.id])),
                      swatch: solidLine(item.color),
                    }))}
                  />
                )
              }}
            />
            {series.map((item) => (
              <Line
                key={item.id}
                dataKey={item.id}
                type="monotone"
                stroke={item.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                {...animation}
              />
            ))}
          </LineChart>
        </ChartContainer>
      )}
    </Surface>
  )
}

// Recharts hands values back as numbers; formatting needs a Decimal.
const dec = (value: string | number | undefined) => new Decimal(value ?? 0)

// The period's notable facts in words: best and worst month, streaks, what moved the most.

export function HighlightsCard({
  t,
  f,
  report,
  categories,
  className,
}: CardProps & { categories: readonly TransactionCategory[] }) {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const nameOf = (id: string) => {
    const category = byId.get(id)
    return categoryNameById(t, category, id)
  }
  const active = report.months.filter(
    (month) => month.income.gt(0) || month.expense.gt(0)
  ).length
  const items: { label: string; value: string; detail?: string; tone: Tone }[] =
    []
  if (report.bestMonth) {
    const net = savings(report.bestMonth)
    items.push({
      label: t.in("web", "Best month"),
      value: f.month(report.bestMonth.month, "long", true, multiYear(report)),
      detail: f.money(net, "always"),
      tone: net.gt(0) ? "positive" : "neutral",
    })
  }
  if (report.worstMonth) {
    const net = savings(report.worstMonth)
    items.push({
      label: t.in("web", "Toughest month"),
      value: f.month(report.worstMonth.month, "long", true, multiYear(report)),
      detail: f.money(net, net.gt(0) ? "always" : "automatic"),
      tone: net.lt(0) ? "negative" : "neutral",
    })
  }
  if (active > 0) {
    items.push({
      label: t.in("web", "Months you saved"),
      value: t.in("web", "%lld of %lld", report.cashFlow.monthsSaved, active),
      tone: "neutral",
    })
  }
  if (report.biggestIncrease) {
    items.push({
      label: t.in("web", "Grew the most"),
      value: nameOf(report.biggestIncrease.categoryId),
      detail: `+${f.money(report.biggestIncrease.change)}`,
      tone: "negative",
    })
  }
  if (report.biggestDecrease) {
    items.push({
      label: t.in("web", "Dropped the most"),
      value: nameOf(report.biggestDecrease.categoryId),
      detail: `−${f.money(report.biggestDecrease.change.abs())}`,
      tone: "positive",
    })
  }

  return (
    <Surface className={cn("flex min-h-0 flex-col gap-3 p-4", className)}>
      <CardHeader
        title={t.in("web", "Highlights")}
        caption={
          report.hasComparison &&
          (report.biggestIncrease || report.biggestDecrease)
            ? t.in(
                "web",
                "Spending changes %@",
                comparisonLabel(t, f, report.comparison)
              )
            : undefined
        }
      />
      <dl className="flex flex-col divide-y divide-(--divider)">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-4 py-2.5"
          >
            <dt className="type-caption text-text-secondary">{item.label}</dt>
            <dd className="flex min-w-0 flex-col items-end">
              <span className="truncate type-label">{item.value}</span>
              {item.detail ? (
                <span
                  className={cn(
                    "type-caption-sm tabular-nums",
                    item.tone === "neutral"
                      ? "text-muted-foreground"
                      : toneClass[item.tone]
                  )}
                >
                  {item.detail}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </Surface>
  )
}

// Every year side by side: did this year go better than the last?

export function YearsCard({
  t,
  f,
  years,
  className,
}: {
  t: Translator
  f: SummaryFormat
  years: readonly YearTotals[]
  className?: string
}) {
  const data = years.map((year) => {
    const net = savings(year.cashFlow)
    return {
      label: year.isRunning
        ? t.in("web", "%lld so far", year.year)
        : String(year.year),
      income: year.cashFlow.income.toNumber(),
      expense: year.cashFlow.expense.toNumber(),
      net: net.toNumber(),
      incomeText: f.money(year.cashFlow.income),
      expenseText: f.money(year.cashFlow.expense),
      netText: f.money(net, net.gt(0) ? "always" : "automatic"),
      tone: toneOf(year.cashFlow.income, year.cashFlow.expense),
    }
  })
  const config = {
    income: { label: "income", color: "var(--positive)" },
    expense: { label: "expense", color: "var(--negative)" },
    net: { label: "net", color: "var(--chart-1)" },
  } satisfies ChartConfig

  return (
    <Surface className={cn("flex min-h-0 flex-col gap-3 p-4", className)}>
      <CardHeader
        title={t.in("web", "Year over year")}
        caption={t.in(
          "web",
          "Every year you've logged, whatever range is picked above"
        )}
        trailing={
          <Legend
            items={[
              { label: t.in("summary", "Came in"), swatch: dot("bg-positive") },
              {
                label: t.in("summary", "Went out"),
                swatch: dot("bg-negative"),
              },
              { label: t.in("web", "Saved"), swatch: dot("bg-chart-1") },
            ]}
          />
        }
      />
      <ChartContainer
        config={config}
        className="aspect-auto h-56 w-full"
        aria-hidden
      >
        <BarChart
          data={data}
          barGap={4}
          barCategoryGap="30%"
          margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--divider)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            width={64}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => f.compact(value)}
          />
          <ReferenceLine y={0} stroke="var(--text-faint)" strokeOpacity={0.6} />
          <Tooltip
            cursor={{ fill: "var(--accent)", opacity: 0.5 }}
            content={({ active, payload }) => {
              const row = active
                ? (payload?.[0]?.payload as (typeof data)[number] | undefined)
                : undefined
              if (!row) return null
              return (
                <TooltipBox
                  title={row.label}
                  rows={[
                    {
                      label: t.in("summary", "Came in"),
                      value: row.incomeText,
                      swatch: dot("size-2 bg-positive"),
                    },
                    {
                      label: t.in("summary", "Went out"),
                      value: row.expenseText,
                      swatch: dot("size-2 bg-negative"),
                    },
                  ]}
                  footer={
                    <span className={cn("type-label", toneClass[row.tone])}>
                      {row.netText}
                    </span>
                  }
                />
              )
            }}
          />
          <Bar
            dataKey="income"
            fill="var(--positive)"
            radius={[4, 4, 0, 0]}
            {...animation}
          />
          <Bar
            dataKey="expense"
            fill="var(--negative)"
            radius={[4, 4, 0, 0]}
            {...animation}
          />
          <Bar dataKey="net" radius={4} {...animation}>
            {data.map((row) => (
              <Cell
                key={row.label}
                fill={
                  row.tone === "negative" ? "var(--negative)" : "var(--chart-1)"
                }
                fillOpacity={row.tone === "negative" ? 0.55 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>{t.in("web", "Year over year")}</caption>
        <tbody>
          {data.map((row) => (
            <tr key={row.label}>
              <td>{row.label}</td>
              <td>{row.incomeText}</td>
              <td>{row.expenseText}</td>
              <td>{row.netText}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  )
}
