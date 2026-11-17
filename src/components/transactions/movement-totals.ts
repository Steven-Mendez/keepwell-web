import {
  Decimal,
  UnconvertedTally,
  dayKey,
  storedAmountIn,
  type UnconvertedMovements,
} from "@/lib/domain"
import type { Transaction } from "@/lib/schema"
import { deviceTimeZone } from "@/lib/platform/time-zone"

export interface MovementTotals {
  moneyIn: Decimal
  moneyOut: Decimal
  /** What the stored rate couldn't bring to the principal currency, left out of both. */
  excluded: UnconvertedMovements[]
}

/**
 * The cash flow of the listed movements: confirmed money in and out in the principal currency, each
 * converted with its stored rate, at its full amount. Unlike the monthly summary it doesn't take the
 * others' shares out of a split expense or leave out a deposited repayment: it adds up the movements
 * as listed. Transfers, drafts and movements that rate can't convert don't count.
 */
export function movementTotals(
  transactions: readonly Transaction[],
  principal: string
): MovementTotals {
  let moneyIn = new Decimal(0)
  let moneyOut = new Decimal(0)
  const excluded = new UnconvertedTally()
  for (const transaction of transactions) {
    if (transaction.status !== "confirmed" || transaction.kind === "transfer")
      continue
    const amount = storedAmountIn(transaction, principal)
    if (amount === undefined) {
      excluded.add(transaction)
      continue
    }
    if (transaction.kind === "income") moneyIn = moneyIn.plus(amount)
    else moneyOut = moneyOut.plus(amount)
  }
  return { moneyIn, moneyOut, excluded: excluded.entries }
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
