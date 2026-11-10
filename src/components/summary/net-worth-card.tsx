"use client"

import { useId } from "react"
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts"

import { AnimatedNumber } from "@/components/kw/animated-number"
import { Surface } from "@/components/kw/primitives"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { BALANCE_MASK } from "@/hooks/use-hidden-balances"
import { monthKey, netWorthChange, type NetWorthPoint } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { toneClass, type SummaryFormat, type Tone } from "./summary-format"

const chartConfig = {
  total: { label: "total", color: "var(--link)" },
} satisfies ChartConfig

/**
 * iOS NetWorthSection: net worth at the end of each of the last twelve months, the latest value and
 * how far it moved since the first month shown. Amounts and the axis follow "hide balances"; the
 * line keeps its shape, which says nothing about the amounts.
 */
export function NetWorthCard({
  t,
  f,
  points,
  convertsCurrencies,
  hidden,
  className,
}: {
  t: Translator
  f: SummaryFormat
  points: readonly NetWorthPoint[]
  /** Whether a second currency is converted, each month at its own rate, which the caption then says. */
  convertsCurrencies: boolean
  hidden: boolean
  className?: string
}) {
  const gradientId = useId()
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last) return null
  const change = netWorthChange(points)
  const since = f.month(
    first.month,
    "long",
    false,
    first.month.year !== last.month.year
  )
  const tone: Tone =
    !change || change.isZero()
      ? "neutral"
      : change.gt(0)
        ? "positive"
        : "negative"
  const changeText =
    change === undefined
      ? undefined
      : change.isZero()
        ? t.in("summary", "No change since %@", since)
        : t.in(
            "summary",
            "%@ since %@",
            hidden ? BALANCE_MASK : f.money(change, "always"),
            since
          )
  const data = points.map((point) => ({
    key: monthKey(point.month),
    label: f.month(point.month, "short"),
    name: f.month(
      point.month,
      "long",
      true,
      point.month.year !== last.month.year
    ),
    total: point.total.amount.toNumber(),
    text: hidden ? BALANCE_MASK : f.money(point.total.amount),
  }))

  return (
    <Surface className={cn("flex flex-col gap-3 p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col">
          <h2 className="type-heading">{t.in("summary", "Net worth")}</h2>
          <p className="type-caption text-muted-foreground">
            {convertsCurrencies
              ? t.in("summary", "At the end of each month, at that month's rate")
              : t.in("summary", "At the end of each month")}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <AnimatedNumber
            value={hidden ? BALANCE_MASK : f.money(last.total.amount)}
            className={cn(
              "type-title-sm leading-tight tabular-nums",
              last.total.amount.lt(0) && !hidden
                ? "text-negative"
                : "text-foreground"
            )}
          />
          {changeText ? (
            <p
              className={cn(
                "type-caption tabular-nums",
                tone === "neutral" ? "text-muted-foreground" : toneClass[tone]
              )}
            >
              {changeText}
            </p>
          ) : null}
        </div>
      </div>
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-52 w-full"
        aria-hidden
      >
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--link)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--link)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--divider)" />
          <XAxis
            dataKey="key"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(key: string) =>
              data.find((row) => row.key === key)?.label ?? ""
            }
          />
          <YAxis
            width={hidden ? 8 : 64}
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
            tick={!hidden}
            tickFormatter={(value: number) => f.compact(value)}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            content={({ active, payload }) => {
              const row = active
                ? (payload?.[0]?.payload as (typeof data)[number] | undefined)
                : undefined
              if (!row) return null
              return (
                <div className="grid min-w-36 gap-1 rounded-xl bg-secondary px-3 py-2 type-caption shadow-depth">
                  <span className="type-label">{row.name}</span>
                  <span className="tabular-nums">{row.text}</span>
                </div>
              )
            }}
          />
          <Area
            dataKey="total"
            type="monotone"
            stroke="var(--link)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive="auto"
            animationDuration={280}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ChartContainer>
      <ul className="sr-only">
        {data.map((row) => (
          <li key={row.key}>
            {row.name}: {row.text}
          </li>
        ))}
      </ul>
    </Surface>
  )
}
