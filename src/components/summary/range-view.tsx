"use client"

import { useMemo } from "react"

import { KWSegmented } from "@/components/kw/design"
import { OptionSelect } from "@/components/kw/pickers"
import { activityRange, compareMonths, lastMonths, monthKey, monthRange, rangeMonths, trendReport, yearToDate, yearTotals, type MonthRange, type TrendReport, type YearMonth } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import type { Transaction, TransactionCategory } from "@/lib/schema"

import { CategoriesCard, CategoryTrendsCard, HighlightsCard, MonthlyFlowCard, SavingsCard, TrendKpis, YearsCard } from "./range-cards"
import type { SummaryFormat } from "./summary-format"

/** One month (the stepper and pace) or a span of months read as one period. */
export type Period = "month" | "thisYear" | "last12" | "custom"

/** "2026-03" from the month pickers. */
export type CustomRange = { start: string; end: string }

const parseKey = (key: string): YearMonth => {
  const [year, month] = key.split("-").map(Number)
  return { year: year ?? 1970, month: month ?? 1 }
}

function rangeFor(period: Exclude<Period, "month">, custom: CustomRange | undefined, now: Date): MonthRange {
  switch (period) {
    case "thisYear":
      return yearToDate(now)
    case "last12":
      return lastMonths(12, now)
    case "custom": {
      const fallback = lastMonths(6, now)
      return monthRange(custom ? parseKey(custom.start) : fallback.start, custom ? parseKey(custom.end) : fallback.end)
    }
  }
}

/**
 * Everything a period view needs, recomputed when the ledger changes. "now" is read then too, so a
 * new month or year rolls the presets over.
 */
export function useRangeSummary(transactions: readonly Transaction[] | undefined, currency: string, period: Period, custom: CustomRange | undefined) {
  return useMemo(() => {
    if (!transactions || period === "month") return undefined
    const now = new Date()
    return {
      report: trendReport(transactions, currency, rangeFor(period, custom, now), now),
      activity: activityRange(transactions, now) ?? lastMonths(12, now),
      years: yearTotals(transactions, currency, now),
    }
  }, [transactions, currency, period, custom])
}

export function PeriodPicker({ t, value, onChange }: { t: Translator; value: Period; onChange: (period: Period) => void }) {
  return (
    // Full height, so it lines up with the month stepper's 40 px buttons beside it.
    <KWSegmented<Period>
      className="w-auto"
      aria-label={t.in("web", "Period")}
      value={value}
      onChange={onChange}
      options={[
        { value: "month", title: t.in("web", "Month") },
        { value: "thisYear", title: t.in("web", "This year") },
        { value: "last12", title: t.in("web", "Last 12 months") },
        { value: "custom", title: t.in("web", "Custom") },
      ]}
    />
  )
}

/** From and to, reaching back to the first movement; picking them in either order works. */
export function CustomRangePicker({ t, f, activity, range, onChange }: { t: Translator; f: SummaryFormat; activity: MonthRange; range: MonthRange; onChange: (range: CustomRange) => void }) {
  // Also reaches the range's own start, which may come before the first movement (the default custom range).
  const options = rangeMonths(monthRange(compareMonths(range.start, activity.start) < 0 ? range.start : activity.start, activity.end))
    .reverse()
    .map((month) => ({ value: monthKey(month), label: f.month(month, "long", true, true) }))
  const start = monthKey(range.start)
  const end = monthKey(range.end)
  return (
    <div className="flex items-center gap-2">
      <OptionSelect aria-label={t.in("web", "From")} className="h-10 w-44" value={start} options={options} onChange={(next) => onChange({ start: next, end })} />
      <span className="type-caption text-muted-foreground">–</span>
      <OptionSelect aria-label={t.in("web", "To")} className="h-10 w-44" value={end} options={options} onChange={(next) => onChange({ start, end: next })} />
    </div>
  )
}

/** A period at a glance, then its charts: month by month and savings building up beside where it went. */
export function RangeSummary({ t, f, report, years, categories }: { t: Translator; f: SummaryFormat; report: TrendReport; years: Parameters<typeof YearsCard>[0]["years"]; categories: readonly TransactionCategory[] }) {
  return (
    <>
      <TrendKpis t={t} f={f} report={report} />
      <div className="grid gap-4 lg:grid-cols-3">
        <MonthlyFlowCard t={t} f={f} report={report} className="lg:col-span-2" />
        <CategoriesCard t={t} f={f} report={report} categories={categories} className="lg:row-span-2" />
        <SavingsCard t={t} f={f} report={report} className="lg:col-span-2" />
        <CategoryTrendsCard t={t} f={f} report={report} categories={categories} className="lg:col-span-2" />
        <HighlightsCard t={t} f={f} report={report} categories={categories} />
        {years.length > 1 ? <YearsCard t={t} f={f} years={years} className="lg:col-span-3" /> : null}
      </div>
    </>
  )
}
