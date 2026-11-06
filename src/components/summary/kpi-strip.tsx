"use client"

import type { ReactNode } from "react"

import { AnimatedNumber } from "@/components/kw/animated-number"
import { Surface } from "@/components/kw/primitives"
import { cashFlowOutcome, type SummaryReport } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { headline } from "./cash-flow-card"
import { toneClass, type SummaryFormat, type Tone } from "./summary-format"

/**
 * The month at a glance, one figure per tile (Mobbin: Monarch's cash flow totals, Origin's
 * income / expenses / net strip): what came in, what went out, how the month ended, and how the
 * whole window went. Every figure rolls when the month changes.
 */
export function KpiStrip({ t, f, report, selectedIndex }: { t: Translator; f: SummaryFormat; report: SummaryReport; selectedIndex: number }) {
  const selected = report.months[selectedIndex]
  if (!selected) return null
  const head = headline(t, f, selected)
  const trend = report.cashFlow
  const count = report.months.length
  const outcome = cashFlowOutcome(trend.income, trend.expense)
  const windowAmount = outcome.kind === "saved" ? f.money(outcome.amount, "always") : outcome.kind === "overspent" ? f.money(outcome.amount.neg()) : f.money(trend.income.minus(trend.income))
  const windowTone: Tone = outcome.kind === "saved" ? "positive" : outcome.kind === "overspent" ? "negative" : "neutral"

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <Tile
        dot="bg-positive"
        label={t.in("summary", "Came in")}
        value={f.money(selected.income)}
        caption={report.averageIncome ? t.in("summary", "Average %@ / month", f.money(report.averageIncome)) : t.in("summary", "No income")}
      />
      <Tile
        dot="bg-negative"
        label={t.in("summary", "Went out")}
        value={f.money(selected.expense)}
        caption={report.averageExpense ? t.in("summary", "Average %@ / month", f.money(report.averageExpense)) : t.in("summary", "No spending")}
      />
      <Tile label={head.title} value={head.amount} tone={head.tone} caption={head.detail} />
      <Tile label={t.in("summary", "Last %lld months", count)} value={windowAmount} tone={windowTone} caption={t.in("summary", "You saved in %lld of %lld months", trend.monthsSaved, count)} />
    </div>
  )
}

function Tile({ label, value, caption, tone = "neutral", dot }: { label: string; value: string; caption?: ReactNode; tone?: Tone; dot?: string }) {
  return (
    <Surface className="flex min-w-0 flex-col gap-1 p-4">
      <span className="flex items-center gap-1.5 truncate type-caption text-text-secondary">
        {dot ? <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden /> : null}
        {label}
      </span>
      <AnimatedNumber value={value} className={cn("type-title-sm leading-tight", toneClass[tone])} />
      {caption ? (
        <span className="line-clamp-1 type-caption-sm text-muted-foreground" title={typeof caption === "string" ? caption : undefined}>
          {caption}
        </span>
      ) : null}
    </Surface>
  )
}
