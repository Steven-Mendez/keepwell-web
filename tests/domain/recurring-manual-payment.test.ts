// T29: a movement typed by hand for an occurrence the rule then produces on its own.
// `materializeRecurring` only skips an occurrence that already has a movement carrying the rule's
// `recurringId`, so a manual payment of the rent does not stop an auto-confirmed rule from saving a
// second one. The first test pins today's (wrong) result; the second states the expected one and is
// marked as failing until T29 links manual payments to the rule.
import { describe, expect, it } from "vitest"

import { materializeRecurring, occurrence } from "@/lib/domain"
import { DEFAULT_SETTINGS, type RecurringRule } from "@/lib/schema"

import { IDs, date, sampleStore, transaction } from "./fixtures"

const RULE_ID = "00000000-0000-0000-0000-00000000e029"

const rent: RecurringRule = {
  id: RULE_ID,
  name: "Rent",
  kind: "expense",
  categoryId: "housing",
  amount: "500",
  currency: "USD",
  accountId: IDs.savings,
  cardId: IDs.savingsDebit,
  frequency: "monthly",
  interval: 1,
  startDate: date(2026, 10, 1, 9).toISOString(),
  nextDate: date(2026, 11, 1, 9).toISOString(),
  isSubscription: false,
  autoConfirm: true,
  isPaused: false,
}

/** The rent paid by hand two days before it's due: same account and amount, no `recurringId`. */
function storeWithManualRent() {
  const store = sampleStore()
  store.settings = { ...DEFAULT_SETTINGS, currencies: { principal: "USD", second: "NIO", rate: "36.6243" }, hasCompletedOnboarding: true }
  store.recurringRules = [rent]
  store.transactions = [transaction({ amount: "500", account: IDs.savings, card: IDs.savingsDebit, category: "housing", description: "Alquiler", date: date(2026, 10, 30) })]
  return store
}

const rentPayments = (store: ReturnType<typeof sampleStore>) => store.transactions.filter((tx) => tx.accountId === IDs.savings && tx.amount === "500" && tx.status === "confirmed")

describe("Manual payment of a recurring occurrence (T29)", () => {
  it("today: an auto-confirmed rule saves a second payment next to the manual one", async () => {
    const store = storeWithManualRent()
    expect(occurrence(rent, 1).toISOString()).toBe(rent.nextDate)
    const created = await materializeRecurring(store, date(2026, 11, 1, 20))
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ status: "confirmed", recurringId: RULE_ID, amount: "500" })
    expect(rentPayments(store)).toHaveLength(2)
  })

  // Expected failure until T29: the manual payment should count as the occurrence.
  it.fails("expected: the manual payment counts as the occurrence and nothing is duplicated", async () => {
    const store = storeWithManualRent()
    await materializeRecurring(store, date(2026, 11, 1, 20))
    expect(rentPayments(store)).toHaveLength(1)
  })
})
