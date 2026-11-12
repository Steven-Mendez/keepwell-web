import { homeOverview, type Ledger } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import type { RecurringRule } from "@/lib/schema"

import { homeReminders, type Reminder } from "@/components/home/home-reminders"

export interface Notifications {
  /** What applies now: payments, statements, installments, renewals, expiries, budgets, price rises. */
  reminders: Reminder[]
  /** Recurring payments an assistant proposed through MCP, paused until confirmed or discarded. */
  proposed: RecurringRule[]
  /** What the bell shows: every reminder plus every proposal. */
  count: number
}

/**
 * Recurring payments an assistant set up through MCP wait paused until the person confirms them
 * (ADR 0007 in keepwell-api).
 */
export function proposedRules(ledger: Ledger): RecurringRule[] {
  return ledger.recurringRules.filter(
    (rule) => rule.source === "mcp" && rule.isPaused
  )
}

/**
 * The notifications at `now`, computed from the ledger and stateless: nothing is read or unread,
 * each one disappears once it stops applying (iOS' inbox works the same way).
 *
 * Drafts due today (`planned-*`) are left out: they already have their own Drafts section on Home,
 * and showing them twice would double the bell's count for one thing to do.
 */
export function buildNotifications(
  t: Translator,
  ledger: Ledger,
  now: Date,
  hidden: boolean
): Notifications {
  const overview = homeOverview(ledger, now)
  const reminders = homeReminders(t, ledger, overview, now, hidden).filter(
    (reminder) => !reminder.id.startsWith("planned-")
  )
  const proposed = proposedRules(ledger)
  return { reminders, proposed, count: reminders.length + proposed.length }
}
