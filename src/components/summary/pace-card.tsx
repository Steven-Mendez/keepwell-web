"use client"

import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts"

import { AnimatedNumber } from "@/components/kw/animated-number"
import { Surface } from "@/components/kw/primitives"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import {
  daysInMonth,
  paceComparisonDay,
  paceDifference,
  pacePreviousBySameDay,
  pacePreviousTotal,
  paceSpentSoFar,
  type SummaryReport,
} from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { toneClass, type SummaryFormat, type Tone } from "./summary-format"

const chartConfig = {
  current: { label: "current", color: "var(--chart-1)" },
  previous: { label: "previous", color: "var(--text-faint)" },
} satisfies ChartConfig

/** Running spending through the month against the month before, day by day (iOS PaceSection). */
export function PaceCard({
  t,
  f,
  report,
  selectedIndex,
  className,
}: {
  t: Translator
  f: SummaryFormat
  report: SummaryReport
  selectedIndex: number
  className?: string
}) {
  const pace = report.paces[selectedIndex]
  if (!pace) return null
  const isRunning = selectedIndex === report.months.length - 1
  const month = f.month(pace.month, "long", false)
  const previous = f.month(pace.previousMonth, "long", false)
  const difference = paceDifference(pace)
  const amount = f.money(difference.abs())
  let comparison: string
  let tone: Tone
  if (pacePreviousTotal(pace).isZero()) {
    comparison = t.in(
      "summary",
      "Nothing was spent in %@ to compare with.",
      previous
    )
    tone = "neutral"
  } else if (difference.lt(0)) {
    comparison = t.in(
      "summary",
      "%@ less than %@ by the same day",
      amount,
      previous
    )
    tone = "positive"
  } else if (difference.gt(0)) {
    comparison = t.in(
      "summary",
      "%@ more than %@ by the same day",
      amount,
      previous
    )
    tone = "negative"
  } else {
    comparison = t.in("summary", "Same as %@ by the same day", previous)
    tone = "neutral"
  }
  const dayCount = Math.max(pace.previous.length, daysInMonth(pace.month))
  const data = Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1
    const current = pace.current.find((point) => point.day === day)
    const before = pace.previous.find((point) => point.day === day)
    return {
      day,
      ...(current
        ? {
            current: current.cumulative.toNumber(),
            currentText: f.money(current.cumulative),
          }
        : {}),
      ...(before
        ? {
            previous: before.cumulative.toNumber(),
            previousText: f.money(before.cumulative),
          }
        : {}),
    }
  })
  const currentLegend = f.month(pace.month)
  const previousLegend = f.month(pace.previousMonth)

  return (
    <Surface className={cn("flex min-h-0 flex-col gap-3 p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="type-heading">{t.in("summary", "Pace")}</h2>
            <span className="type-caption text-text-secondary">
              {isRunning
                ? t.in("summary", "Spent so far in %@", month)
                : t.in("summary", "Spent in %@", month)}
            </span>
            <AnimatedNumber
              value={f.money(paceSpentSoFar(pace))}
              className="type-label"
            />
          </div>
          <p
            className={cn(
              "type-caption",
              tone === "neutral" ? "text-muted-foreground" : toneClass[tone]
            )}
          >
            {comparison}
          </p>
        </div>
        <ul
          className="flex items-center gap-4 type-caption text-text-secondary"
          aria-hidden
        >
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-chart-1" />
            {currentLegend}
          </li>
          <li
            className="flex items-center gap-1.5"
            title={t.in(
              "summary",
              "%@ total: %@",
              previousLegend,
              f.money(pacePreviousTotal(pace))
            )}
          >
            <span className="h-0 w-4 border-t-2 border-dashed border-text-faint" />
            {previousLegend}
          </li>
        </ul>
      </div>
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-48 w-full lg:h-auto lg:min-h-0 lg:flex-1"
        aria-hidden
      >
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--divider)" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            ticks={[1, 8, 15, 22, dayCount]}
          />
          <YAxis
            width={64}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => f.compact(value)}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            content={({ active, payload, label }) => {
              const row = active
                ? (payload?.[0]?.payload as (typeof data)[number] | undefined)
                : undefined
              if (!row) return null
              return (
                <div className="grid min-w-40 gap-1 rounded-xl bg-secondary px-3 py-2 type-caption shadow-depth">
                  <span className="type-label">
                    {t.in("summary", "Day")} {label}
                  </span>
                  {row.currentText ? (
                    <span className="flex justify-between gap-4">
                      <span className="text-text-secondary">
                        {currentLegend}
                      </span>
                      <span className="tabular-nums">{row.currentText}</span>
                    </span>
                  ) : null}
                  {row.previousText ? (
                    <span className="flex justify-between gap-4">
                      <span className="text-text-secondary">
                        {previousLegend}
                      </span>
                      <span className="tabular-nums">{row.previousText}</span>
                    </span>
                  ) : null}
                </div>
              )
            }}
          />
          <Line
            dataKey="previous"
            type="monotone"
            stroke="var(--text-faint)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive="auto"
            animationDuration={280}
            animationEasing="ease-out"
          />
          <Line
            dataKey="current"
            type="monotone"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive="auto"
            animationDuration={280}
            animationEasing="ease-out"
            connectNulls={false}
          />
        </LineChart>
      </ChartContainer>
      <p className="sr-only">
        {t.in(
          "summary",
          "By day %lld, %@ spent in %@ against %@ in %@.",
          paceComparisonDay(pace),
          f.money(paceSpentSoFar(pace)),
          month,
          f.money(pacePreviousBySameDay(pace)),
          previous
        )}
      </p>
    </Surface>
  )
}
