import type { Account, Card, CurrencySettings, Transaction, TransactionKind } from "@/lib/schema"
import { OTHER_EXPENSE_ID, OTHER_INCOME_ID } from "@/lib/schema"

import {
  addDays,
  addMonths,
  daysInMonth,
  monthInterval,
  monthKey,
  sameMonth,
  startOfDay,
  yearMonthContaining,
  type DateInterval,
  type YearMonth,
} from "./calendar"
import { Decimal, ZERO, dec, sum } from "./decimal"
import { DomainError } from "./errors"
import { convert, fromStored, rateHasSecondCurrency, settingsRate, type Money } from "./money"

// Ports of keepwell-ios Packages/Domain/Sources/Domain/Rules: the HANDOFF rules every screen shares.

export const isConfirmed = (transaction: Transaction) => transaction.status === "confirmed"
const dateOf = (transaction: Transaction) => new Date(transaction.date)

/** "`amount` is always positive"; a known bank charge must be positive too (iOS `checkAmounts`). */
export function checkAmounts(amount: Decimal, actualDebitedPrincipal?: Decimal): void {
  if (amount.lte(0) || (actualDebitedPrincipal !== undefined && actualDebitedPrincipal.lte(0))) throw DomainError.invalidAmount()
}

// Rule 2: conversion, always with the rate stored on the transaction.

function isInSecondCurrency(transaction: Transaction): boolean {
  return rateHasSecondCurrency(transaction.exchangeRate) && transaction.currency === transaction.exchangeRate.second
}

/** The real debit if the bank reported one; otherwise the amount, converted when in the second currency. */
export function principalAmount(transaction: Transaction): Decimal {
  if (transaction.actualDebitedPrincipal !== undefined) return dec(transaction.actualDebitedPrincipal)
  const amount = dec(transaction.amount)
  return isInSecondCurrency(transaction) ? amount.div(dec(transaction.exchangeRate.rate)) : amount
}

/** The amount itself when in the second currency; otherwise the principal amount (real debit first) times the rate. */
export function secondAmount(transaction: Transaction): Decimal {
  if (isInSecondCurrency(transaction)) return dec(transaction.amount)
  return dec(transaction.actualDebitedPrincipal ?? transaction.amount).times(dec(transaction.exchangeRate.rate))
}

/** The amount in `currency`, which must be one of the transaction's two currencies. */
export function amountIn(transaction: Transaction, currency: string): Decimal {
  return currency === transaction.exchangeRate.second && rateHasSecondCurrency(transaction.exchangeRate)
    ? secondAmount(transaction)
    : principalAmount(transaction)
}

/** The rate the bank effectively applied (second per principal), when it reported a real debit. */
export function bankRate(transaction: Transaction): Decimal | undefined {
  if (transaction.actualDebitedPrincipal === undefined || !isInSecondCurrency(transaction)) return undefined
  const debited = dec(transaction.actualDebitedPrincipal)
  return debited.gt(0) ? dec(transaction.amount).div(debited) : undefined
}

// Rules 1, 3, 4, 5: balances.

export function accountCurrencies(account: Account): string[] {
  return account.openingBalances.map((balance) => balance.currency)
}

/** +1 when money enters the account, −1 when it leaves, 0 when the movement doesn't touch it. */
export function direction(transaction: Transaction, accountId: string): -1 | 0 | 1 {
  switch (transaction.kind) {
    case "expense":
      return transaction.accountId === accountId ? -1 : 0
    case "income":
      return transaction.accountId === accountId ? 1 : 0
    case "transfer":
      if (transaction.accountId === accountId) return -1
      return transaction.destinationAccountId === accountId ? 1 : 0
  }
}

/** Which of the account's currencies the movement hits; a dual card books each purchase in its own currency. */
export function share(transaction: Transaction, account: Account): { currency: string; amount: Decimal } {
  const currencies = accountCurrencies(account)
  if (currencies.length > 1) {
    if (currencies.includes(transaction.currency)) return { currency: transaction.currency, amount: dec(transaction.amount) }
    const principal = currencies[0] as string
    return { currency: principal, amount: amountIn(transaction, principal) }
  }
  const currency = currencies[0] ?? transaction.currency
  return { currency, amount: amountIn(transaction, currency) }
}

/** Opening balance plus confirmed inflows minus outflows since the opening day, one per currency. */
export function balanceOf(account: Account, transactions: readonly Transaction[]): Money[] {
  const openingDay = startOfDay(new Date(account.openingDate)).getTime()
  const totals = new Map<string, Decimal>(account.openingBalances.map((balance) => [balance.currency, dec(balance.amount)]))
  for (const transaction of transactions) {
    if (!isConfirmed(transaction) || dateOf(transaction).getTime() < openingDay) continue
    const sign = direction(transaction, account.id)
    if (sign === 0) continue
    const { currency, amount } = share(transaction, account)
    totals.set(currency, (totals.get(currency) ?? ZERO).plus(amount.times(sign)))
  }
  return accountCurrencies(account).map((currency) => ({ amount: totals.get(currency) ?? ZERO, currency }))
}

// Rule 6: net worth, with today's settings rate.

export function netWorth(balances: readonly Money[], settings: CurrencySettings): Money {
  const rate = settingsRate(settings)
  return { amount: sum(balances.map((balance) => convert(balance, rate, settings.principal).amount)), currency: settings.principal }
}

export function inSecondCurrency(total: Money, settings: CurrencySettings): Money | undefined {
  if (settings.second === undefined) return undefined
  try {
    return convert(total, settingsRate(settings), settings.second)
  } catch {
    return undefined
  }
}

// Rule 7: monthly summary, in the principal currency.

export interface CategoryTotal {
  categoryId: string
  amount: Decimal
  /** Share of the month's total (0…1). */
  share: Decimal
}

export interface MonthlySummary {
  month: YearMonth
  currency: string
  income: Decimal
  expense: Decimal
  /** Spending per category, largest first. */
  categories: CategoryTotal[]
  /** Income per category, largest first. */
  incomeCategories: CategoryTotal[]
}

function ranked(totals: Map<string, Decimal>, total: Decimal): CategoryTotal[] {
  return [...totals.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount, share: total.gt(0) ? amount.div(total) : ZERO }))
    .sort((a, b) => (a.amount.eq(b.amount) ? (a.categoryId < b.categoryId ? -1 : 1) : b.amount.cmp(a.amount)))
}

export function monthlySummary(month: YearMonth, transactions: readonly Transaction[], currency: string): MonthlySummary {
  let income = ZERO
  let expense = ZERO
  const perCategory = new Map<string, Decimal>()
  const perIncome = new Map<string, Decimal>()
  for (const transaction of transactions) {
    if (!isConfirmed(transaction) || !sameMonth(yearMonthContaining(dateOf(transaction)), month)) continue
    const amount = principalAmount(transaction)
    if (transaction.kind === "income") {
      income = income.plus(amount)
      const id = transaction.categoryId ?? OTHER_INCOME_ID
      perIncome.set(id, (perIncome.get(id) ?? ZERO).plus(amount))
    } else if (transaction.kind === "expense") {
      expense = expense.plus(amount)
      const id = transaction.categoryId ?? OTHER_EXPENSE_ID
      perCategory.set(id, (perCategory.get(id) ?? ZERO).plus(amount))
    }
  }
  return { month, currency, income, expense, categories: ranked(perCategory, expense), incomeCategories: ranked(perIncome, income) }
}

export const savings = (summary: { income: Decimal; expense: Decimal }) => summary.income.minus(summary.expense)

/** `savings / income`; `undefined` without income, since 0% would hide overspending. */
export function savingsRate(summary: { income: Decimal; expense: Decimal }): Decimal | undefined {
  return summary.income.gt(0) ? savings(summary).div(summary.income) : undefined
}

function totalsByMonth(kind: TransactionKind, transactions: readonly Transaction[]): Map<string, Decimal> {
  const totals = new Map<string, Decimal>()
  for (const transaction of transactions) {
    if (!isConfirmed(transaction) || transaction.kind !== kind) continue
    const key = monthKey(yearMonthContaining(dateOf(transaction)))
    totals.set(key, (totals.get(key) ?? ZERO).plus(principalAmount(transaction)))
  }
  return totals
}

/** Monthly totals of one kind for `count` months ending at `last`, oldest first. */
export function monthlyTotals(kind: TransactionKind, last: YearMonth, count: number, transactions: readonly Transaction[]) {
  const totals = totalsByMonth(kind, transactions)
  return Array.from({ length: count }, (_, index) => {
    const month = addMonths(last, index - (count - 1))
    return { month, total: totals.get(monthKey(month)) ?? ZERO }
  })
}

/** Average over the months that have any movement of that kind; `undefined` when there are none. */
export function averageMonthlyTotal(kind: TransactionKind, transactions: readonly Transaction[]): Decimal | undefined {
  const totals = [...totalsByMonth(kind, transactions).values()].filter((total) => total.gt(0))
  return totals.length === 0 ? undefined : sum(totals).div(totals.length)
}

export interface PlannedSummary {
  count: number
  principalTotal: Decimal
  secondTotal: Decimal
}

/** Planned movements waiting for confirmation, in both currencies. */
export function plannedSummary(transactions: readonly Transaction[]): PlannedSummary {
  const planned = transactions.filter((transaction) => !isConfirmed(transaction))
  return {
    count: planned.length,
    principalTotal: sum(planned.map(principalAmount)),
    secondTotal: sum(planned.map(secondAmount)),
  }
}

// Billing cycle: from the day after the previous cutoff through the cutoff day; days past a
// month's end clamp to its last day.

function cutoffIn(month: YearMonth, day: number): Date {
  return new Date(month.year, month.month - 1, Math.min(day, daysInMonth(month)))
}

export function billingCycle(date: Date, cutoffDay: number | undefined): DateInterval {
  const month = yearMonthContaining(date)
  if (cutoffDay === undefined) return monthInterval(month)
  const thisCutoff = cutoffIn(month, cutoffDay)
  const day = startOfDay(date)
  const [startCutoff, endCutoff] =
    day.getTime() <= thisCutoff.getTime()
      ? [cutoffIn(addMonths(month, -1), cutoffDay), thisCutoff]
      : [thisCutoff, cutoffIn(addMonths(month, 1), cutoffDay)]
  return { start: addDays(startCutoff, 1), end: addDays(endCutoff, 1) }
}

/** The next date (today included) that falls on `day` of a month, clamped like cutoffs. */
export function nextOccurrence(day: number, onOrAfter: Date): Date {
  const today = startOfDay(onOrAfter)
  const month = yearMonthContaining(onOrAfter)
  const candidate = cutoffIn(month, day)
  return candidate.getTime() >= today.getTime() ? candidate : cutoffIn(addMonths(month, 1), day)
}

// Subscriptions: a charge in the "Subscriptions" category, or the same description in two months.

export const SUBSCRIPTIONS_CATEGORY_ID = "subscriptions"

/** Case- and accent-insensitive comparison key ("Café" = "cafe"). */
export function folded(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

export function subscriptionsCharged(cardId: string, transactions: readonly Transaction[]): string[] {
  const months = new Map<string, Set<string>>()
  const inCategory = new Set<string>()
  const latest = new Map<string, { date: number; description: string }>()
  for (const transaction of transactions) {
    if (transaction.cardId !== cardId || transaction.kind !== "expense" || !isConfirmed(transaction)) continue
    const key = folded(transaction.description.trim())
    if (key === "") continue
    const date = dateOf(transaction)
    const set = months.get(key) ?? new Set<string>()
    set.add(monthKey(yearMonthContaining(date)))
    months.set(key, set)
    if (transaction.categoryId === SUBSCRIPTIONS_CATEGORY_ID) inCategory.add(key)
    const previous = latest.get(key)
    if (!previous || date.getTime() > previous.date) latest.set(key, { date: date.getTime(), description: transaction.description })
  }
  return [...latest.entries()]
    .filter(([key]) => inCategory.has(key) || (months.get(key)?.size ?? 0) >= 2)
    .sort(([, a], [, b]) => b.date - a.date)
    .map(([, value]) => value.description)
}

// Scope: everything or one account (what left it and, for transfers, what arrived).

export type TransactionScope = { kind: "all" } | { kind: "account"; id: string }

export function scopeIncludes(scope: TransactionScope, transaction: Transaction): boolean {
  return scope.kind === "all" || transaction.accountId === scope.id || transaction.destinationAccountId === scope.id
}

// Card expiry: works through the last day of its month; reminder on the first of that month.

export function expiryReminderDay(expiry: { month: number; year: number }): Date {
  return new Date(expiry.year, expiry.month - 1, 1)
}

export function compareExpiry(a: { month: number; year: number }, b: { month: number; year: number }): number {
  return a.year === b.year ? a.month - b.month : a.year - b.year
}

/** Builds a valid "valid thru" or throws, like iOS `CardExpiry.init`. */
export function cardExpiry(month: number, year: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2199) {
    throw DomainError.invalidExpiry()
  }
  return { month, year }
}

/** Last four digits: exactly four ASCII digits. */
export function checkLastFour(value: string | undefined): void {
  if (value !== undefined && !/^[0-9]{4}$/.test(value)) throw DomainError.invalidLastFour(value)
}

export function checkDayOfMonth(day: number | undefined): void {
  if (day !== undefined && (!Number.isInteger(day) || day < 1 || day > 31)) throw DomainError.invalidDayOfMonth(day)
}

/** "Bank One Savings": the bank followed by the account's own name. */
export function accountDisplayName(account: Pick<Account, "bank" | "name">): string {
  return [account.bank, account.name]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part !== "")
    .join(" ")
}

export function cardsOf(accountId: string, cards: readonly Card[]): Card[] {
  return cards.filter((card) => card.accountId === accountId)
}

export { fromStored }
