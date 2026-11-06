import { formatAmount, formatNumber, type Decimal, type Sign, type YearMonth } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"

/** Formatting the summary shares (iOS SummaryViewModel's money/percent/monthName helpers). */
export function summaryFormat(t: Translator, currency: string) {
  const monthText = (month: YearMonth, style: "long" | "short", capitalized: boolean, withYear = false) => {
    const text = new Date(month.year, month.month - 1, 1).toLocaleDateString(t.locale, { month: style, ...(withYear ? { year: "numeric" } : {}) })
    return capitalized ? text.charAt(0).toUpperCase() + text.slice(1) : text
  }
  return {
    money: (amount: Decimal, sign: Sign = "automatic") => formatAmount(amount, currency, { sign }),
    /** Whole units for axes and annotations, where cents are noise. */
    compact: (amount: Decimal | number, sign: Sign = "automatic") => formatAmount(amount, currency, { fractionDigits: 0, sign }),
    percent: (share: Decimal) => `${formatNumber(share.times(100), 0)}%`,
    /** Mid-sentence a month keeps its language's case ("octubre"); standing alone it's capitalized. */
    month: (month: YearMonth, style: "long" | "short" = "long", capitalized = true, withYear = false) => monthText(month, style, capitalized, withYear),
  }
}

export type SummaryFormat = ReturnType<typeof summaryFormat>

export type Tone = "positive" | "negative" | "neutral"

export const toneClass: Record<Tone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-foreground",
}
