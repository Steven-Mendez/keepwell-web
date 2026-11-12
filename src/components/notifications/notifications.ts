import { ledgerNotifications, startOfDay, type Ledger, type LedgerNotification } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import type { NotificationState } from "@/lib/repositories"

import { notificationCopy, type NotificationCopy } from "@/lib/presentation/notification-copy"

export interface InboxEntry extends NotificationCopy {
  notification: LedgerNotification
  read: boolean
}

export interface InboxDay {
  /** Start of the day, the group's key. */
  day: Date
  entries: InboxEntry[]
}

export interface Inbox {
  days: InboxDay[]
  /** Every entry, newest first, for "mark all as read" and "delete read". */
  entries: InboxEntry[]
  /** What the bell counts. */
  unread: number
}

export const EMPTY_INBOX: Inbox = { days: [], entries: [], unread: 0 }

/**
 * The inbox at `now`: the notifications that apply (ADR 0012) minus the deleted ones, each with its
 * read state, grouped by day, newest first.
 *
 * Drafts due today (`planned`) are left out: Home already has a Drafts section with its own
 * "Confirm", and listing them twice would double the bell for one thing to do. They still arrive as
 * native notifications.
 */
export function buildInbox(t: Translator, ledger: Ledger, states: readonly NotificationState[], now: Date, hidden: boolean): Inbox {
  const byId = new Map(states.map((state) => [state.id, state]))
  const entries: InboxEntry[] = []
  for (const notification of ledgerNotifications(ledger, now)) {
    if (notification.kind === "planned") continue
    const state = byId.get(notification.id)
    if (state?.dismissedAt) continue
    entries.push({ ...notificationCopy(t, ledger, notification, hidden), notification, read: Boolean(state?.readAt) })
  }
  const days: InboxDay[] = []
  for (const entry of entries) {
    const day = startOfDay(entry.notification.date)
    const last = days.at(-1)
    if (last && last.day.getTime() === day.getTime()) last.entries.push(entry)
    else days.push({ day, entries: [entry] })
  }
  return { days, entries, unread: entries.filter((entry) => !entry.read).length }
}
