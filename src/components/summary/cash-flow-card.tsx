"use client"

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts"

import { Surface } from "@/components/kw/primitives"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { cashFlowOutcome, monthKey, savings, savingsRate, type MonthlySummary, type SummaryReport } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { toneClass, type SummaryFormat, type Tone } from "./summary-format"

const chartConfig = {
  income: { label: "income", color: "var(--positive)" },
  expense: { label: "expense", color: "var(--negative)" },
} satisfies ChartConfig

function toneOf(month: MonthlySummary): Tone {
  const kind = cashFlowOutcome(month.income, month.expense).kind
  return kind === "saved" ? "positive" : kind === "overspent" ? "negative" : "neutral"
}

/** "Saved in November +$60.00 · You kept 60% of what came in." (iOS FlowHeadline). */
function headline(t: Translator, f: SummaryFormat, selected: MonthlySummary) {
  const month = f.month(selected.month, "long", false)
  const outcome = cashFlowOutcome(selected.income, selected.expense)
  switch (outcome.kind) {
    case "saved": {
      const rate = savingsRate(selected)
      return {
        title: t.in("summary", "You saved in %@", month),
        amount: f.money(outcome.amount, "always"),
        detail: t.in("summary", "You kept %@ of what came in.", rate ? f.percent(rate) : ""),
        tone: "positive" as Tone,
      }
    }
    case "overspent":
      return {
        title: t.in("summary", "You overspent in %@", month),
        amount: f.money(outcome.amount.neg()),
        detail: selected.income.gt(0) ? t.in("summary", "You spent %@ more than came in.", f.money(outcome.amount)) : t.in("summary", "Nothing came in, so all of it came from your savings."),
        tone: "negative" as Tone,
      }
    case "even":
      return { title: t.in("summary", "You broke even in %@", month), amount: f.money(selected.income.minus(selected.income)), detail: t.in("summary", "You spent exactly what came in."), tone: "neutral" as Tone }
    case "noActivity":
      return { title: t.in("summary", "Nothing moved in %@", month), amount: f.money(selected.income), detail: undefined, tone: "neutral" as Tone }
  }
}

function outcomeSentence(t: Translator, f: SummaryFormat, month: MonthlySummary): string {
  const outcome = cashFlowOutcome(month.income, month.expense)
  switch (outcome.kind) {
    case "saved":
      return t.in("summary", "saved %@", f.money(outcome.amount))
    case "overspent":
      return t.in("summary", "overspent %@", f.money(outcome.amount))
    case "even":
      return t.in("summary", "broke even")
    case "noActivity":
      return t.in("summary", "no movements")
  }
}

/** Income against spending for every month of the window; a bar selects its month. */
export function CashFlowCard({
  t,
  f,
  report,
  selectedIndex,
  onSelect,
  className,
}: {
  t: Translator
  f: SummaryFormat
  report: SummaryReport
  selectedIndex: number
  onSelect: (index: number) => void
  className?: string
}) {
  const selected = report.months[selectedIndex]
  if (!selected) return null
  const head = headline(t, f, selected)
  const data = report.months.map((month, index) => ({
    key: monthKey(month.month),
    index,
    label: f.month(month.month, "short"),
    name: f.month(month.month),
    income: month.income.toNumber(),
    expense: month.expense.toNumber(),
    incomeText: f.money(month.income),
    expenseText: f.money(month.expense),
    result: outcomeSentence(t, f, month),
    net: cashFlowOutcome(month.income, month.expense).kind === "noActivity" ? "" : f.compact(savings(month), "always"),
    tone: toneOf(month),
  }))
  const average = report.averageExpense

  return (
    <Surface className={cn("flex flex-col gap-4 p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="type-heading">{t.in("summary", "Cash flow")}</h2>
          <p className="type-label text-text-secondary">{head.title}</p>
          <p className={cn("type-amount-lg", toneClass[head.tone])}>{head.amount}</p>
          {head.detail ? <p className="type-caption text-muted-foreground">{head.detail}</p> : null}
        </div>
        <ul className="flex items-center gap-4 type-caption text-text-secondary" aria-hidden>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-positive" />
            {t.in("summary", "Came in")}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-negative" />
            {t.in("summary", "Went out")}
          </li>
        </ul>
      </div>

      <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full" aria-hidden>
        <BarChart
          data={data}
          barGap={2}
          barCategoryGap="28%"
          margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
          onClick={(state) => {
            const index = typeof state?.activeTooltipIndex === "number" ? state.activeTooltipIndex : Number(state?.activeTooltipIndex)
            if (Number.isInteger(index) && index >= 0) onSelect(index)
          }}
        >
          <CartesianGrid vertical={false} stroke="var(--divider)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis width={64} tickLine={false} axisLine={false} tickFormatter={(value: number) => f.compact(value)} />
          <Tooltip
            cursor={{ fill: "var(--accent)", opacity: 0.5 }}
            content={({ active, payload }) => {
              const row = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined
              if (!row) return null
              return (
                <div className="grid min-w-44 gap-1.5 rounded-xl bg-secondary px-3 py-2 type-caption shadow-depth">
                  <span className="type-label">{row.name}</span>
                  <span className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <span className="size-2 rounded-full bg-positive" />
                      {t.in("summary", "Came in")}
                    </span>
                    <span className="tabular-nums">{row.incomeText}</span>
                  </span>
                  <span className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <span className="size-2 rounded-full bg-negative" />
                      {t.in("summary", "Went out")}
                    </span>
                    <span className="tabular-nums">{row.expenseText}</span>
                  </span>
                  <span className={cn("type-label", toneClass[row.tone])}>{row.result}</span>
                </div>
              )
            }}
          />
          {average ? <ReferenceLine y={average.toNumber()} stroke="var(--text-faint)" strokeDasharray="4 4" /> : null}
          <Bar dataKey="income" radius={[4, 4, 0, 0]} className="cursor-pointer">
            {data.map((row) => (
              <Cell key={row.key} fill="var(--positive)" fillOpacity={row.index === selectedIndex ? 1 : 0.35} />
            ))}
          </Bar>
          <Bar dataKey="expense" radius={[4, 4, 0, 0]} className="cursor-pointer">
            {data.map((row) => (
              <Cell key={row.key} fill="var(--negative)" fillOpacity={row.index === selectedIndex ? 1 : 0.35} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      {average ? <p className="type-caption text-muted-foreground">{t.in("summary", "Average %@ / month", f.money(average))}</p> : null}

      <div>
        <h3 className="mb-2 type-label text-text-secondary">{t.in("summary", "Result per month")}</h3>
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {data.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => onSelect(row.index)}
                aria-pressed={row.index === selectedIndex}
                className={cn(
                  "flex w-full flex-col items-start rounded-xl px-2.5 py-2 text-left transition-colors outline-none hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring",
                  row.index === selectedIndex && "bg-secondary",
                )}
              >
                <span className="type-caption-sm text-muted-foreground">{row.label}</span>
                <span className={cn("type-label tabular-nums", toneClass[row.tone])}>{row.net || "—"}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <table className="sr-only">
        <caption>{t.in("summary", "Cash flow")}</caption>
        <thead>
          <tr>
            <th>{t.in("summary", "Month")}</th>
            <th>{t.in("summary", "Came in")}</th>
            <th>{t.in("summary", "Went out")}</th>
            <th>{t.in("summary", "Result")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.key}>
              <td>{row.name}</td>
              <td>{row.incomeText}</td>
              <td>{row.expenseText}</td>
              <td>{row.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  )
}

/** The whole window in one line, so one bad month reads in context (iOS WindowSummary). */
export function WindowCard({ t, f, report, selectedIndex, className }: { t: Translator; f: SummaryFormat; report: SummaryReport; selectedIndex: number; className?: string }) {
  const trend = report.cashFlow
  const count = report.months.length
  const outcome = cashFlowOutcome(trend.income, trend.expense)
  const amount = outcome.kind === "saved" ? f.money(outcome.amount, "always") : outcome.kind === "overspent" ? f.money(outcome.amount.neg()) : f.money(trend.income.minus(trend.income))
  const tone: Tone = outcome.kind === "saved" ? "positive" : outcome.kind === "overspent" ? "negative" : "neutral"
  const selected = report.months[selectedIndex]
  const largest = selected ? (selected.income.gt(selected.expense) ? selected.income : selected.expense) : undefined
  const fraction = (value: MonthlySummary["income"]) => (largest && largest.gt(0) ? value.div(largest).toNumber() : 0)

  return (
    <Surface className={cn("flex flex-col gap-5 p-5", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="type-label text-text-secondary">{t.in("summary", "Last %lld months", count)}</h2>
        <p className={cn("type-amount-sm", toneClass[tone])}>{amount}</p>
        <p className="type-caption text-muted-foreground">{t.in("summary", "You saved in %lld of %lld months", trend.monthsSaved, count)}</p>
      </div>
      {selected ? (
        <div className="flex flex-col gap-3">
          <h3 className="type-label text-text-secondary">{f.month(selected.month, "long", true, selected.month.year !== report.months.at(-1)?.month.year)}</h3>
          {(
            [
              ["Came in", selected.income, "bg-positive", "always"],
              ["Went out", selected.expense, "bg-negative", "automatic"],
            ] as const
          ).map(([label, value, color, sign]) => (
            <div key={label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="type-caption text-text-secondary">{t.in("summary", label)}</span>
                <span className="type-label tabular-nums">{f.money(value, sign)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className={cn("h-full rounded-full transition-[width] duration-300", color)} style={{ width: `${Math.max(fraction(value) * 100, value.gt(0) ? 2 : 0)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-divider pt-4">
        <div className="flex flex-col gap-0.5">
          <dt className="type-caption-sm text-muted-foreground">{t.in("summary", "Expenses")}</dt>
          <dd className="type-caption">{report.averageExpense ? t.in("summary", "Average %@ / month", f.money(report.averageExpense)) : t.in("summary", "No spending")}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="type-caption-sm text-muted-foreground">{t.in("summary", "Income")}</dt>
          <dd className="type-caption">{report.averageIncome ? t.in("summary", "Average %@ / month", f.money(report.averageIncome)) : t.in("summary", "No income")}</dd>
        </div>
      </dl>
    </Surface>
  )
}
