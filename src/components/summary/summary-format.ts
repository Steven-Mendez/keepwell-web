import {
  cashFlowOutcome,
  savingsRate,
  type Decimal,
  type MonthlySummary,
  type YearMonth,
} from "@/lib/domain"
import {
  formatAmount,
  formatNumber,
  type Sign,
} from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"

/** Formatting the summary shares (iOS SummaryViewModel's money/percent/monthName helpers). */
export function summaryFormat(t: Translator, currency: string) {
  const monthText = (
    month: YearMonth,
    style: "long" | "short",
    capitalized: boolean,
    withYear = false
  ) => {
    const text = new Date(month.year, month.month - 1, 1).toLocaleDateString(
      t.locale,
      { month: style, ...(withYear ? { year: "numeric" } : {}) }
    )
    return capitalized ? text.charAt(0).toUpperCase() + text.slice(1) : text
  }
  return {
    money: (amount: Decimal, sign: Sign = "automatic") =>
      formatAmount(amount, currency, { sign }),
    /** Whole units for axes and annotations, where cents are noise. */
    compact: (amount: Decimal | number, sign: Sign = "automatic") =>
      formatAmount(amount, currency, { fractionDigits: 0, sign }),
    percent: (share: Decimal) => `${formatNumber(share.times(100), 0)}%`,
    /** Mid-sentence a month keeps its language's case ("octubre"); standing alone it's capitalized. */
    month: (
      month: YearMonth,
      style: "long" | "short" = "long",
      capitalized = true,
      withYear = false
    ) => monthText(month, style, capitalized, withYear),
  }
}

export type SummaryFormat = ReturnType<typeof summaryFormat>

export type Tone = "positive" | "negative" | "neutral"

export const toneClass: Record<Tone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-foreground",
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
