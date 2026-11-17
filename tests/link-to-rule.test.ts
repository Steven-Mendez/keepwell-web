// "Link to a recurring" from a movement: which rules it offers, and in what order.
import { describe, expect, it } from "vitest"

import { linkableRules } from "@/components/recurring/link-to-rule"
import type { RecurringRule } from "@/lib/schema"

import { IDs, date, transaction } from "./domain/fixtures"

function rule(id: string, name: string, overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id,
    name,
    kind: "expense",
    categoryId: "subscriptions",
    amount: "6.49",
    currency: "USD",
    accountId: IDs.savings,
    frequency: "monthly",
    interval: 1,
    startDate: date(2026, 12, 1, 9).toISOString(),
    nextDate: date(2026, 12, 1, 9).toISOString(),
    isSubscription: true,
    autoConfirm: false,
    isPaused: false,
    ...overrides,
  }
}

describe("linkableRules", () => {
  const charge = transaction({ amount: "6.49", account: IDs.savings, description: "APPLE.COM/BILL Apple Music", date: date(2026, 11, 1) })

  it("offers rules of the movement's kind, the one it would be suggested for first", () => {
    const rules = [
      rule("00000000-0000-0000-0000-0000000000a1", "Adobe", { amount: "54.99" }),
      rule("00000000-0000-0000-0000-0000000000a2", "Apple Music"),
      rule("00000000-0000-0000-0000-0000000000a3", "Salary", { kind: "income", amount: "1500" }),
      rule("00000000-0000-0000-0000-0000000000a4", "Gym", { amount: "540", currency: "NIO" }),
    ]
    expect(linkableRules(charge, rules).map((candidate) => candidate.name)).toEqual(["Apple Music", "Adobe", "Gym"])
  })

  it("leaves out a rule of another kind", () => {
    expect(linkableRules(charge, [rule("00000000-0000-0000-0000-0000000000a3", "Salary", { kind: "income" })])).toEqual([])
  })
})
