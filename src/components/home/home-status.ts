import {
  ledgerNotifications,
  orderedLoans,
  type Ledger,
  type LedgerNotification,
  type LoanProgress,
} from "@/lib/domain"
import type { Translator } from "@/lib/i18n"

/**
 * The line under Home's greeting, counted from the same notifications as the inbox and the same
 * loans as the Debts card, so it never says "All caught up" while Home lists something late.
 */
export interface HomeStatus {
  /** Drafts dated today or before: the overdue ones in Home's Drafts list. */
  toConfirm: number
  /** Loan installments past their day, which Home's Debts card marks as overdue. */
  overdue: number
  /** Card payments and installments due today. */
  dueToday: number
  /** Card payments and installments due tomorrow, subscriptions renewing tomorrow and bills due tomorrow. */
  dueTomorrow: number
}

export function homeStatus(
  notifications: readonly LedgerNotification[],
  loans: readonly LoanProgress[]
): HomeStatus {
  const status: HomeStatus = {
    toConfirm: 0,
    overdue: 0,
    dueToday: 0,
    dueTomorrow: 0,
  }
  for (const notification of notifications) {
    switch (notification.kind) {
      case "planned":
        status.toConfirm++
        break
      case "payment":
      case "installment":
        if (notification.params.daysLeft === 0) status.dueToday++
        else if (notification.params.daysLeft === 1) status.dueTomorrow++
        break
      case "renewal":
      case "bill":
        status.dueTomorrow++
        break
    }
  }
  status.overdue = loans.filter((progress) => progress.isNextOverdue).length
  return status
}

export function ledgerHomeStatus(ledger: Ledger, now: Date): HomeStatus {
  return homeStatus(
    ledgerNotifications(ledger, now),
    orderedLoans(ledger.loans, now)
  )
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
    status.dueToday > 0
      ? t.in("home", "%lld due today", status.dueToday)
      : undefined,
    status.dueTomorrow > 0
      ? t.in("home", "%lld due tomorrow", status.dueTomorrow)
      : undefined,
  ].filter((part): part is string => part !== undefined)
  return parts.length > 0 ? parts.join(" · ") : t.in("home", "All caught up")
}
