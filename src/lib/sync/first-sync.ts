import type { SyncEntity } from "@/lib/schema"

// The first sync of a browser with an account (no cursor for that account yet). When both this
// browser and the account already hold the person's data, merging them would mix two ledgers
// (duplicate accounts, movements counted twice), so sync pauses and the person keeps one side.
// The same rules run on iOS.

/**
 * What counts as "the person's data". Categories and settings don't: onboarding seeds them on
 * every device. They are still replaced along with everything else when a side is chosen.
 */
export const USER_DATA_ENTITIES = [
  "account",
  "card",
  "transaction",
  "recurringRule",
  "loan",
  "loanPayment",
  "personalDebt",
  "personalDebtRepayment",
  "savingsGoal",
  "categorizationRule",
] as const satisfies readonly SyncEntity[]

export type UserDataEntity = (typeof USER_DATA_ENTITIES)[number]

/** Live (not deleted) rows per entity. */
export type DataCounts = Record<UserDataEntity, number>

export const EMPTY_COUNTS: DataCounts = Object.fromEntries(USER_DATA_ENTITIES.map((entity) => [entity, 0])) as DataCounts

export function hasUserData(counts: DataCounts): boolean {
  return USER_DATA_ENTITIES.some((entity) => counts[entity] > 0)
}

/**
 * - `choose`: both sides have data; sync waits for the person.
 * - `upload`: only this browser has data; it goes up as is (the account's categories and settings
 *   merge as on any sync).
 * - `download`: only the account has data; this browser takes the account's, untouched by what the
 *   browser seeded on its own (its default categories and settings never overwrite the account's).
 * - `merge`: neither has data; the usual sync (seeded categories and settings meet).
 */
export type FirstSyncDecision = "choose" | "upload" | "download" | "merge"

export function firstSyncDecision(local: DataCounts, cloud: DataCounts): FirstSyncDecision {
  const here = hasUserData(local)
  const there = hasUserData(cloud)
  if (here && there) return "choose"
  if (here) return "upload"
  if (there) return "download"
  return "merge"
}

/** The person's pending decision, with what each side holds, kept until they choose. */
export interface PendingChoice {
  userId: string | null
  local: DataCounts
  cloud: DataCounts
}
