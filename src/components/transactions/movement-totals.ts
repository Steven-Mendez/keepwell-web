import { Decimal, amountIn, dayKey } from "@/lib/domain"
import type { Transaction } from "@/lib/schema"
import { deviceTimeZone } from "@/lib/platform/time-zone"

export interface MovementTotals {
  moneyIn: Decimal
  moneyOut: Decimal
}

/** Confirmed income and spending in the principal currency; transfers and drafts don't count, as in iOS summaries. */
export function movementTotals(
  transactions: readonly Transaction[],
  principal: string
): MovementTotals {
  let moneyIn = new Decimal(0)
  let moneyOut = new Decimal(0)
  for (const transaction of transactions) {
    if (transaction.status !== "confirmed" || transaction.kind === "transfer")
      continue
    const amount = amountIn(transaction, principal)
    if (transaction.kind === "income") moneyIn = moneyIn.plus(amount)
    else moneyOut = moneyOut.plus(amount)
  }
  return { moneyIn, moneyOut }
}

export function dayNet(
  transactions: readonly Transaction[],
  principal: string
): Decimal | undefined {
  const { moneyIn, moneyOut } = movementTotals(transactions, principal)
  return moneyIn.minus(moneyOut)
}

/** The (already sorted) movements grouped by their day, in order. */
export function groupByDay(
  transactions: readonly Transaction[]
): [string, Transaction[]][] {
  const byDay = new Map<string, Transaction[]>()
  for (const transaction of transactions) {
    const key = dayKey(new Date(transaction.date), deviceTimeZone())
    byDay.set(key, [...(byDay.get(key) ?? []), transaction])
  }
  return [...byDay.entries()]
}

/** Newest first. */
export function newestFirst(
  transactions: readonly Transaction[]
): Transaction[] {
  return [...transactions].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0
  )
}
