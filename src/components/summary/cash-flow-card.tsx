"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Surface } from "@/components/kw/primitives"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import {
  cashFlowOutcome,
  monthKey,
  savingsRate,
  type MonthlySummary,
  type SummaryReport,
} from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { toneClass, type SummaryFormat, type Tone } from "./summary-format"

const chartConfig = {
  income: { label: "income", color: "var(--positive)" },
  expense: { label: "expense", color: "var(--negative)" },
} satisfies ChartConfig

function toneOf(month: MonthlySummary): Tone {
  const kind = cashFlowOutcome(month.income, month.expense).kind
  return kind === "saved"
    ? "positive"
    : kind === "overspent"
      ? "negative"
      : "neutral"
}

/** "Saved in November +$60.00 · You kept 60% of what came in." (iOS FlowHeadline). */
export function headline(
  t: Translator,
  f: SummaryFormat,
  selected: MonthlySummary
) {
  const month = f.month(selected.month, "long", false)
  const outcome = cashFlowOutcome(selected.income, selected.expense)
  switch (outcome.kind) {
    case "saved": {
      const rate = savingsRate(selected)
      return {
        title: t.in("summary", "You saved in %@", month),
        amount: f.money(outcome.amount, "always"),
        detail: t.in(
          "summary",
          "You kept %@ of what came in.",
          rate ? f.percent(rate) : ""
        ),
        tone: "positive" as Tone,
      }
    }
    case "overspent":
      return {
        title: t.in("summary", "You overspent in %@", month),
        amount: f.money(outcome.amount.neg()),
        detail: selected.income.gt(0)
          ? t.in(
              "summary",
              "You spent %@ more than came in.",
              f.money(outcome.amount)
            )
          : t.in(
              "summary",
              "Nothing came in, so all of it came from your savings."
            ),
        tone: "negative" as Tone,
      }
    case "even":
      return {
        title: t.in("summary", "You broke even in %@", month),
        amount: f.money(selected.income.minus(selected.income)),
        detail: t.in("summary", "You spent exactly what came in."),
        tone: "neutral" as Tone,
      }
    case "noActivity":
      return {
        title: t.in("summary", "Nothing moved in %@", month),
        amount: f.money(selected.income),
        detail: undefined,
        tone: "neutral" as Tone,
      }
  }
}

function outcomeSentence(
  t: Translator,
  f: SummaryFormat,
  month: MonthlySummary
): string {
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
    tone: toneOf(month),
  }))
  const average = report.averageExpense

  return (
    <Surface className={cn("flex min-h-0 flex-col gap-3 p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="type-heading">{t.in("summary", "Cash flow")}</h2>
          <p className="type-caption text-muted-foreground">
            {average
              ? t.in("summary", "Average %@ / month", f.money(average))
              : head.title}
          </p>
        </div>
        <ul
          className="flex items-center gap-4 type-caption text-text-secondary"
          aria-hidden
        >
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

      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-56 w-full lg:h-auto lg:min-h-0 lg:flex-1"
        aria-hidden
      >
        <BarChart
          data={data}
          barGap={2}
          barCategoryGap="28%"
          margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
          onClick={(state) => {
            const index =
              typeof state?.activeTooltipIndex === "number"
                ? state.activeTooltipIndex
                : Number(state?.activeTooltipIndex)
            if (Number.isInteger(index) && index >= 0) onSelect(index)
          }}
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
          <Tooltip
            cursor={{ fill: "var(--accent)", opacity: 0.5 }}
            content={({ active, payload }) => {
              const row = active
                ? (payload?.[0]?.payload as (typeof data)[number] | undefined)
                : undefined
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
                  <span className={cn("type-label", toneClass[row.tone])}>
                    {row.result}
                  </span>
                </div>
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
            radius={[4, 4, 0, 0]}
            isAnimationActive="auto"
            animationDuration={280}
            animationEasing="ease-out"
            className="cursor-pointer"
          >
            {data.map((row) => (
              <Cell
                key={row.key}
                fill="var(--positive)"
                fillOpacity={row.index === selectedIndex ? 1 : 0.35}
              />
            ))}
          </Bar>
          <Bar
            dataKey="expense"
            radius={[4, 4, 0, 0]}
            isAnimationActive="auto"
            animationDuration={280}
            animationEasing="ease-out"
            className="cursor-pointer"
          >
            {data.map((row) => (
              <Cell
                key={row.key}
                fill="var(--negative)"
                fillOpacity={row.index === selectedIndex ? 1 : 0.35}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

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
