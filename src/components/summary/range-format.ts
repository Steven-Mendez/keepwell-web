import type { Decimal, MonthRange, YearMonth } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"

import type { SummaryFormat, Tone } from "@/components/summary/summary-format"

/** "Jan – Nov 2026", "March 2026", "Mar 2025 – Aug 2026". */
export function rangeText(f: SummaryFormat, range: MonthRange): string {
  const { start, end } = range
  if (start.year === end.year && start.month === end.month) return f.month(start, "long", true, true)
  if (start.year === end.year) return `${f.month(start, "short")} – ${f.month(end, "short")} ${end.year}`
  return `${f.month(start, "short", true, true)} – ${f.month(end, "short", true, true)}`
}

/** Axis label: "Mar", or "Mar 25" once the period crosses a year, so two Marches never collide. */
export function axisMonth(f: SummaryFormat, month: YearMonth, multiYear: boolean): string {
  return multiYear ? `${f.month(month, "short")} ${String(month.year).slice(-2)}` : f.month(month, "short")
}

/** "+12%" / "−8%" against the comparison; `undefined` when there's nothing to divide by. */
export function changePercent(f: SummaryFormat, current: Decimal, previous: Decimal): string | undefined {
  if (!previous.gt(0)) return undefined
  const rate = current.minus(previous).div(previous)
  const text = f.percent(rate.abs())
  return rate.isZero() ? "=" : `${rate.gt(0) ? "+" : "−"}${text}`
}

/** Spending going up is bad news; income or savings going up is good news. */
export function changeTone(current: Decimal, previous: Decimal, upIsGood: boolean): Tone {
  if (current.eq(previous)) return "neutral"
  return current.gt(previous) === upIsGood ? "positive" : "negative"
}

export function comparisonLabel(t: Translator, f: SummaryFormat, range: MonthRange): string {
  return t.in("web", "vs %@", rangeText(f, range))
}
