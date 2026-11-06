"use client"

import { KWSection } from "@/components/kw/design"
import { AnimatedNumber } from "@/components/kw/animated-number"
import { BALANCE_MASK } from "@/hooks/use-hidden-balances"
import {
  forecastPlannedExpenses,
  forecastPlannedIncome,
  forecastTotal,
  formatAmount,
  type BalanceForecast,
  type Decimal,
} from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/**
 * iOS HomeForecastCard: roughly what bank and cash accounts will hold when the month closes, and the
 * lines that add up to it. Amounts follow "hide balances"; estimates round to whole units.
 */
export function ForecastSection({
  t,
  forecast,
  hidden,
}: {
  t: Translator
  forecast: BalanceForecast
  hidden: boolean
}) {
  const total = forecastTotal(forecast)
  const money = (amount: Decimal, signed: boolean) =>
    hidden
      ? BALANCE_MASK
      : formatAmount(amount, forecast.currency, {
          fractionDigits: 0,
          sign: signed && !amount.isZero() ? "always" : "automatic",
        })
  const lines: [string, Decimal, boolean][] = [
    [t.in("home", "Available today"), forecast.availableToday, false],
    [t.in("home", "Planned income"), forecastPlannedIncome(forecast), true],
    [
      t.in("home", "Planned expenses"),
      forecastPlannedExpenses(forecast).neg(),
      true,
    ],
    [t.in("home", "Card payments"), forecast.cardPayments.neg(), true],
    [t.in("home", "Usual spending"), forecast.usualSpending.neg(), true],
  ]
  return (
    <KWSection title={t.in("home", "End of month")}>
      <div className="flex flex-col gap-3 rounded-2xl bg-card p-[18px]">
        <div className="flex flex-col gap-1">
          <AnimatedNumber
            value={
              hidden
                ? BALANCE_MASK
                : t.in(
                    "home",
                    "≈ %@",
                    formatAmount(total, forecast.currency, {
                      fractionDigits: 0,
                    })
                  )
            }
            className={cn(
              "type-title-sm leading-tight",
              total.lt(0) && !hidden ? "text-negative" : "text-foreground"
            )}
          />
          <p className="type-caption text-muted-foreground">
            {t.in(
              "home",
              "What your bank and cash accounts would hold, counting what's planned and your usual spending."
            )}
          </p>
        </div>
        <dl className="flex flex-col gap-2 border-t border-divider pt-3">
          {lines.map(([label, amount, signed]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-2 type-caption text-text-secondary"
            >
              <dt className="truncate">{label}</dt>
              <dd className="shrink-0 tabular-nums">{money(amount, signed)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </KWSection>
  )
}
