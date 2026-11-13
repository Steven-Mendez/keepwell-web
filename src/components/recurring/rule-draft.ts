import {
  SUBSCRIPTIONS_CATEGORY_ID,
  type RecurringRuleDraft,
  type TransactionDraft,
} from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import type { RecurringFrequency } from "@/lib/schema"

// What the rule editor saves, apart from the hook, so the short subscription form and the full
// one can be shown to save the same rule from the same values.

/** The four periods of the short subscription form; any other schedule is under "More options". */
export type SubscriptionPeriod =
  "monthly" | "quarterly" | "halfYearly" | "yearly"

export const SUBSCRIPTION_PERIODS: readonly SubscriptionPeriod[] = [
  "monthly",
  "quarterly",
  "halfYearly",
  "yearly",
]

/** Each period is an ordinary schedule: every 1, 3 or 6 months, or every year. */
export function periodSchedule(period: SubscriptionPeriod): {
  frequency: RecurringFrequency
  interval: number
} {
  switch (period) {
    case "monthly":
      return { frequency: "monthly", interval: 1 }
    case "quarterly":
      return { frequency: "monthly", interval: 3 }
    case "halfYearly":
      return { frequency: "monthly", interval: 6 }
    case "yearly":
      return { frequency: "yearly", interval: 1 }
  }
}

/** The period a schedule is, or `undefined` for one the four don't cover (weekly, every 2 months…). */
export function periodOf(
  frequency: RecurringFrequency,
  interval: number
): SubscriptionPeriod | undefined {
  return SUBSCRIPTION_PERIODS.find((period) => {
    const schedule = periodSchedule(period)
    return schedule.frequency === frequency && schedule.interval === interval
  })
}

export function periodTitle(t: Translator, period: SubscriptionPeriod): string {
  switch (period) {
    case "monthly":
      return t.in("recurring", "Monthly")
    case "quarterly":
      return t.in("recurring", "Quarterly")
    case "halfYearly":
      return t.in("recurring", "Half-yearly")
    case "yearly":
      return t.in("recurring", "Yearly")
  }
}

/**
 * Only an expense can be a subscription; until the person flips the switch (`choice`), a rule is
 * one while its category is "Subscriptions" (iOS).
 */
export function ruleIsSubscription(
  kind: TransactionDraft["kind"],
  categoryId: string | undefined,
  choice: boolean | undefined
): boolean {
  return (
    kind === "expense" && (choice ?? categoryId === SUBSCRIPTIONS_CATEGORY_ID)
  )
}

/** The rule the editor saves: the movement form's draft plus how it repeats and records itself. */
export function recurringDraft(
  draft: TransactionDraft,
  choices: {
    id?: string
    frequency: RecurringFrequency
    interval: number
    endDate?: Date
    isSubscription: boolean
    autoConfirm: boolean
  }
): RecurringRuleDraft {
  const { id, frequency, interval, endDate, isSubscription, autoConfirm } =
    choices
  return {
    ...(id ? { id } : {}),
    name: draft.description,
    kind: draft.kind,
    amount: draft.amount,
    currency: draft.currency,
    ...(draft.categoryId ? { categoryId: draft.categoryId } : {}),
    ...(draft.source ? { source: draft.source } : {}),
    ...(draft.destinationAccountId
      ? { destinationAccountId: draft.destinationAccountId }
      : {}),
    frequency,
    interval,
    startDate: draft.date,
    ...(endDate ? { endDate } : {}),
    isSubscription,
    autoConfirm,
    note: draft.note,
  }
}
