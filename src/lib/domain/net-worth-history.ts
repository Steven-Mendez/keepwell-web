import type { Account, CurrencySettings, Transaction } from "@/lib/schema"

import { addDays, addMonths, compareMonths, monthInterval, sameMonth, startOfDay, yearMonthContaining, type YearMonth } from "./calendar"
import type { Decimal } from "./decimal"
import type { Money } from "./money"
import { balanceOf, isConfirmed, netWorth } from "./rules"

// Port of iOS Domain/Rules/NetWorthHistory.swift: net worth at the end of each of the last months,
// computed the same on both platforms over the same shared fixture.

/** The current month and the eleven before it. */
export const NET_WORTH_HISTORY_MONTHS = 12

export interface NetWorthPoint {
  month: YearMonth
  /** In the principal currency; credit debts count negative, as in today's net worth. */
  total: Money
}

/**
 * Oldest first.
 * - Each past month is valued at its last moment; the current one as of the end of today, so
 *   movements dated later this month are not counted yet.
 * - An account adds its balance (`balanceOf`, confirmed movements dated up to then) only once its
 *   opening day has come; before that it contributes nothing.
 * - Every month converts at today's settings rate (`netWorth`): the app keeps no history of rates,
 *   so only the balances move, not the rate.
 * - Months before the first account opened are left out; without accounts there are none.
 */
export function netWorthHistory(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  settings: CurrencySettings,
  now: Date = new Date(),
  count = NET_WORTH_HISTORY_MONTHS,
): NetWorthPoint[] {
  if (accounts.length === 0) return []
  const firstOpening = Math.min(...accounts.map((account) => new Date(account.openingDate).getTime()))
  const first = yearMonthContaining(new Date(firstOpening))
  const current = yearMonthContaining(now)
  const endOfToday = addDays(startOfDay(now), 1)
  const confirmed = transactions.filter(isConfirmed)
  const points: NetWorthPoint[] = []
  for (let offset = count - 1; offset >= 0; offset--) {
    const month = addMonths(current, -offset)
    if (compareMonths(month, first) < 0) continue
    // Exclusive: the instant right after the moment the month is valued at.
    const cutoff = (sameMonth(month, current) ? endOfToday : monthInterval(month).end).getTime()
    const movements = confirmed.filter((transaction) => new Date(transaction.date).getTime() < cutoff)
    const balances = accounts
      .filter((account) => startOfDay(new Date(account.openingDate)).getTime() < cutoff)
      .flatMap((account) => balanceOf(account, movements))
    points.push({ month, total: netWorth(balances, settings) })
  }
  return points
}

/** The latest month against the first one shown; `undefined` with fewer than two months. */
export function netWorthChange(points: readonly NetWorthPoint[]): Decimal | undefined {
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last || points.length < 2) return undefined
  return last.total.amount.minus(first.total.amount)
}
