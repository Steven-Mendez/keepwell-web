import { upcomingPayments, type Ledger, type UpcomingPayment } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"

/** Days ahead Home's "Upcoming" looks: the line under the greeting reads the same list. */
export const HOME_UPCOMING_DAYS = 7

/**
 * The line under Home's greeting, counted from the same `upcomingPayments` list Home's "Upcoming"
 * shows, so it never says "All caught up" while that list shows something late.
 */
export interface HomeStatus {
  /** Drafts dated today or before: the late ones in "Upcoming". */
  toConfirm: number
  /** Loan installments past their day, one per installment. */
  overdue: number
  /** Personal debts past their due date, either direction: the late ones "Upcoming" lists. */
  overdueDebts: number
  /** Card payments, installments and personal debts due today. */
  dueToday: number
  /** Card payments, installments and personal debts due tomorrow, subscriptions renewing tomorrow and bills due tomorrow. */
  dueTomorrow: number
}

export function homeStatus(payments: readonly UpcomingPayment[]): HomeStatus {
  const status: HomeStatus = { toConfirm: 0, overdue: 0, overdueDebts: 0, dueToday: 0, dueTomorrow: 0 }
  for (const payment of payments) {
    switch (payment.kind) {
      case "draft":
        if (payment.status !== "upcoming") status.toConfirm++
        break
      case "installment":
      case "card":
        if (payment.kind === "installment" && payment.status === "overdue") status.overdue++
        else if (payment.status === "today") status.dueToday++
        else if (payment.daysFromToday === 1) status.dueTomorrow++
        break
      case "recurring": {
        // The renewals and bills the inbox reminds of the day before (`ledgerNotifications`).
        const { rule } = payment
        if (payment.daysFromToday === 1 && (rule.isSubscription || (rule.kind === "expense" && !rule.autoConfirm))) status.dueTomorrow++
        break
      }
      case "debt":
        // Either direction: the debt reminder (`ledgerNotifications`) covers both, and "Upcoming" lists both.
        if (payment.status === "overdue") status.overdueDebts++
        else if (payment.status === "today") status.dueToday++
        else if (payment.daysFromToday === 1) status.dueTomorrow++
        break
    }
  }
  return status
}

/** How many of what's due today or later "Upcoming" shows; everything overdue shows on top. */
export const HOME_UPCOMING_COUNT = 3

/** What Home's "Upcoming" lists: all that's overdue (hiding one would contradict the line), then the next few. */
export function homeUpcomingShown(payments: readonly UpcomingPayment[]): UpcomingPayment[] {
  const overdue = payments.filter((payment) => payment.status === "overdue")
  const next = payments.filter((payment) => payment.status !== "overdue").slice(0, HOME_UPCOMING_COUNT)
  return [...overdue, ...next]
}

/** The list Home's "Upcoming" and its status line share. */
export function homeUpcomingPayments(ledger: Ledger, now: Date): UpcomingPayment[] {
  return upcomingPayments(ledger, now, HOME_UPCOMING_DAYS)
}

export function ledgerHomeStatus(ledger: Ledger, now: Date): HomeStatus {
  return homeStatus(homeUpcomingPayments(ledger, now))
}

/** "2 payments to confirm · 1 due tomorrow", or "All caught up". */
export function homeStatusText(t: Translator, status: HomeStatus): string {
  const parts = [
    status.toConfirm > 0
      ? t.in("home", "%lld payments to confirm", status.toConfirm)
      : undefined,
    status.overdue > 0
      ? t.in("home", "%lld installments overdue", status.overdue)
      : undefined,
    status.overdueDebts > 0
      ? t.in("home", "%lld debts overdue", status.overdueDebts)
      : undefined,
    status.dueToday > 0
      ? t.in("home", "%lld due today", status.dueToday)
      : undefined,
    status.dueTomorrow > 0
      ? t.in("home", "%lld due tomorrow", status.dueTomorrow)
      : undefined,
  ].filter((part): part is string => part !== undefined)
  return parts.length > 0 ? parts.join(" · ") : t.in("home", "All caught up")
}

/** "Spent in November", "Gastado en noviembre": mid-sentence the month keeps its language's case. */
export function spentInMonthText(t: Translator, month: { year: number; month: number }): string {
  const name = new Date(month.year, month.month - 1, 1).toLocaleDateString(t.locale, { month: "long" })
  return t.in("home", "Spent in %@", name)
}
