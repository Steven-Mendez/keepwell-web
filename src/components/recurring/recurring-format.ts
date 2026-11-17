import type { PendingRuleDraft, RecurringSectionKind, RuleState, RuleStatus } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { accountName, cardShortName } from "@/lib/presentation/display"
import type {
  Account,
  Card,
  RecurringFrequency,
  RecurringRule,
} from "@/lib/schema"

// How a recurring rule reads on screen: its frequency, its next date and what pays it.

/** "Every month", "Every 2 weeks", "Every year". */
export function frequencyText(
  t: Translator,
  frequency: RecurringFrequency,
  interval: number
): string {
  switch (frequency) {
    case "weekly":
      return t.in("sharedpresentation", "Every %lld weeks", interval)
    case "monthly":
      return t.in("sharedpresentation", "Every %lld months", interval)
    case "yearly":
      return t.in("sharedpresentation", "Every %lld years", interval)
  }
}

/** The frequency choices in the editor ("Weekly", "Monthly", "Yearly"), as iOS. */
export function frequencyUnit(
  t: Translator,
  frequency: RecurringFrequency
): string {
  switch (frequency) {
    case "weekly":
      return t.in("recurring", "Weekly")
    case "monthly":
      return t.in("recurring", "Monthly")
    case "yearly":
      return t.in("recurring", "Yearly")
  }
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

/** "Today", "Tomorrow", or the date ("Nov 30", with the year when it isn't this one). */
export function nextDateText(
  t: Translator,
  date: Date,
  now: Date = new Date()
): string {
  if (sameDay(date, now)) return t.in("sharedpresentation", "Today")
  if (
    sameDay(
      date,
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    )
  )
    return t.in("sharedpresentation", "Tomorrow")
  return date.toLocaleDateString(t.locale, {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  })
}

/**
 * A rule's draft waiting on its row in place of the next date: "To confirm · Nov 12" for today's,
 * "Overdue · 3 days" for an older one.
 */
export function pendingDraftText(
  t: Translator,
  pending: PendingRuleDraft,
  now: Date = new Date()
): string {
  if (pending.daysOverdue > 0)
    return t.in("recurring", "Overdue · %lld days", pending.daysOverdue)
  const date = new Date(pending.transaction.date)
  return t.in(
    "recurring",
    "To confirm · %@",
    date.toLocaleDateString(t.locale, {
      day: "numeric",
      month: "short",
      ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
    })
  )
}

const shortDate = (t: Translator, date: Date, now: Date) =>
  date.toLocaleDateString(t.locale, {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  })

/**
 * Where a rule stands, on its row and in its detail: "Paid · Nov 1", "To confirm · Nov 12",
 * "Overdue · 3 days", "Paused", "Ended", or its next date with the days left ("Dec 4 · in 18 days").
 */
export function ruleStatusText(
  t: Translator,
  status: RuleStatus,
  now: Date = new Date()
): string {
  switch (status.state) {
    case "overdue":
      return t.in("recurring", "Overdue · %lld days", status.daysOverdue)
    case "toConfirm":
      return t.in(
        "recurring",
        "To confirm · %@",
        shortDate(t, new Date(status.draft?.date ?? now), now)
      )
    case "paused":
      return t.in("recurring", "Paused")
    case "ended":
      return t.in("recurring", "Ended")
    case "paid":
      return t.in(
        "recurring",
        "Paid · %@",
        shortDate(t, new Date(status.payment?.date ?? now), now)
      )
    case "upcoming":
      return nextPaymentText(t, status, now)
  }
}

/** The next date, with the days left once it's past tomorrow: "Today", "Tomorrow", "Dec 4 · in 18 days". */
export function nextPaymentText(
  t: Translator,
  status: RuleStatus,
  now: Date = new Date()
): string {
  if (!status.nextDate) return t.in("recurring", "Ended")
  const date = nextDateText(t, status.nextDate, now)
  const days = status.daysUntilNext ?? 0
  return days >= 2 ? t.in("recurring", "%@ · in %lld days", date, days) : date
}

/** The state alone, for the detail's capsule. */
export function ruleStateLabel(t: Translator, state: RuleState): string {
  switch (state) {
    case "overdue":
      return t.in("recurring", "Overdue")
    case "toConfirm":
      return t.in("recurring", "To confirm")
    case "paused":
      return t.in("recurring", "Paused")
    case "ended":
      return t.in("recurring", "Ended")
    case "paid":
      return t.in("recurring", "Paid")
    case "upcoming":
      return t.in("recurring", "Upcoming")
  }
}

/** The color a state reads in: green once paid, amber while something waits, muted otherwise. */
export function ruleStateClass(state: RuleState): string {
  switch (state) {
    case "paid":
      return "text-positive"
    case "overdue":
      return "font-semibold text-pending"
    case "paused":
      return "text-pending"
    case "toConfirm":
      return "text-foreground"
    default:
      return "text-muted-foreground"
  }
}

export function sectionTitle(
  t: Translator,
  kind: RecurringSectionKind
): string {
  switch (kind) {
    case "subscriptions":
      return t.in("sharedpresentation", "Subscriptions")
    case "bills":
      return t.in("recurring", "Bills and other expenses")
    case "income":
      return t.in("home", "Income")
    case "transfers":
      return t.in("transactions", "Transfers")
  }
}

/** What pays it: the card's short name ("Visa ··4321"), the account, or "Savings → Cash" for a transfer. */
export function rulePaymentText(
  t: Translator,
  rule: RecurringRule,
  lookup: { accounts: readonly Account[]; cards: readonly Card[] }
): string {
  const name = (id: string | undefined) => {
    const account = lookup.accounts.find((candidate) => candidate.id === id)
    return account ? accountName(account) : ""
  }
  if (rule.kind === "transfer")
    return `${name(rule.accountId)} → ${name(rule.destinationAccountId)}`
  const card = lookup.cards.find((candidate) => candidate.id === rule.cardId)
  return card && card.kind !== "transfer"
    ? cardShortName(t, card)
    : name(rule.accountId)
}
