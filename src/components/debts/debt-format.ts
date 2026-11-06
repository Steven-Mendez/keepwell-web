import { BALANCE_MASK } from "@/hooks/use-hidden-balances"
import {
  dayKey,
  debtRemaining,
  formatAmount,
  parseDayKey,
  type LoanProgress,
  type Money,
  type PaymentSource,
} from "@/lib/domain"
import type { Ledger } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { accountName, methodTitle } from "@/lib/presentation/display"
import type { PersonalDebt } from "@/lib/schema"

export const SELECT_CLASS =
  "h-10 w-full appearance-none rounded-xl border-0 bg-secondary px-3 type-body shadow-none outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** "Nov 28, 2026" / "28 nov 2026". */
export function dayText(t: Translator, date: Date | string): string {
  return new Date(date).toLocaleDateString(t.locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** The value of a date field, and back: the day at noon, so no time zone moves it. */
export const dateFieldValue = (date: Date) => dayKey(date)
export const dateFromField = (text: string, fallback: Date) =>
  parseDayKey(text) ?? fallback

/** "C$19,166.70 · $40.00", one amount per currency, or "Nothing". */
export function totalsText(
  t: Translator,
  lines: readonly Money[],
  hidden: boolean
): string {
  if (lines.length === 0) return t.in("debts", "Nothing")
  return lines
    .map((line) =>
      hidden ? BALANCE_MASK : formatAmount(line.amount, line.currency)
    )
    .join(" · ")
}

/** "Next: 3/12 on Nov 28, 2026 · C$5,500.00", "Overdue: …" or "Paid off". */
export function loanLine(
  t: Translator,
  progress: LoanProgress,
  hidden: boolean
): string {
  const { loan, next } = progress
  if (!next) return t.in("debts", "Paid off")
  const amount = hidden
    ? BALANCE_MASK
    : formatAmount(loan.installmentAmount, loan.borrowed.currency)
  const number = `${next.number}/${loan.installmentCount}`
  return progress.isNextOverdue
    ? t.in(
        "debts",
        "Overdue: %@ on %@ · %@",
        number,
        dayText(t, next.dueDate),
        amount
      )
    : t.in(
        "debts",
        "Next: %@ on %@ · %@",
        number,
        dayText(t, next.dueDate),
        amount
      )
}

export function loanLeft(
  t: Translator,
  progress: LoanProgress,
  hidden: boolean
): string {
  const amount = hidden
    ? BALANCE_MASK
    : formatAmount(progress.remaining, progress.loan.borrowed.currency)
  return t.in("debts", "%@ left", amount)
}

/** Paid installments over all of them, for the bar. */
export function paidFraction(progress: LoanProgress): number {
  const count = progress.loan.installmentCount
  return count > 0 ? Math.min(progress.loan.payments.length / count, 1) : 0
}

export function directionText(
  t: Translator,
  debt: Pick<PersonalDebt, "direction">
): string {
  return debt.direction === "theyOweMe"
    ? t.in("debts", "Owes you")
    : t.in("debts", "You owe")
}

/** "Owes you · Dinner". */
export function debtLine(t: Translator, debt: PersonalDebt): string {
  const direction = directionText(t, debt)
  return debt.note ? `${direction} · ${debt.note}` : direction
}

/** What is left, or "Settled". */
export function debtAmount(
  t: Translator,
  debt: PersonalDebt,
  hidden: boolean
): string {
  if (debt.settledAt) return t.in("debts", "Settled")
  return hidden
    ? BALANCE_MASK
    : formatAmount(debtRemaining(debt), debt.amount.currency)
}

export interface MethodOption {
  key: string
  source: PaymentSource
  title: string
}

/** Every way to pay, as on iOS: each card or transfer channel, and accounts without any (cash). */
export function paymentMethods(
  t: Translator,
  ledger: Pick<Ledger, "accounts" | "cards">
): MethodOption[] {
  return ledger.accounts.flatMap((account): MethodOption[] => {
    const cards = ledger.cards.filter((card) => card.accountId === account.id)
    if (cards.length === 0)
      return [
        {
          key: `account:${account.id}`,
          source: { type: "account", id: account.id },
          title: accountName(account),
        },
      ]
    return cards.map((card) => ({
      key: `card:${card.id}`,
      source: { type: "card", id: card.id },
      title: methodTitle(t, card, account),
    }))
  })
}
