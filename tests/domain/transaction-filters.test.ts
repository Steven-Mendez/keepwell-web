import { describe, expect, it } from "vitest"

import { amountInRange, amountRangeError, filterTransactions, originMatches, type TransactionQuery } from "@/lib/domain"
import type { RecurringRule, Transaction } from "@/lib/schema"

import { d, transaction } from "./fixtures"

// The list's amount range and origin filters (T27), mirrored in iOS FilterTransactionsTests.

function rule(id: string, options: { isSubscription?: boolean; isPaused?: boolean } = {}): RecurringRule {
  return {
    id,
    name: "Netflix",
    kind: "expense",
    categoryId: "subscriptions",
    amount: "15",
    currency: "USD",
    accountId: crypto.randomUUID(),
    frequency: "monthly",
    interval: 1,
    startDate: "2026-01-01T18:00:00.000Z",
    nextDate: "2026-11-01T18:00:00.000Z",
    isSubscription: options.isSubscription ?? false,
    autoConfirm: true,
    isPaused: options.isPaused ?? false,
  }
}

const fromRule = (tx: Transaction, recurringId: string): Transaction => ({ ...tx, recurringId })

describe("amountInRange", () => {
  const hundred = transaction({ amount: "100" })

  it("includes both bounds", () => {
    expect(amountInRange(hundred, { min: d(100) }, "USD")).toBe(true)
    expect(amountInRange(hundred, { max: d(100) }, "USD")).toBe(true)
    expect(amountInRange(hundred, { min: d(100), max: d(100) }, "USD")).toBe(true)
    expect(amountInRange(hundred, { min: d("100.01") }, "USD")).toBe(false)
    expect(amountInRange(hundred, { max: d("99.99") }, "USD")).toBe(false)
  })

  it("compares the amount rounded to cents, as shown", () => {
    const almost = transaction({ amount: "99.996" })
    expect(amountInRange(almost, { min: d(100) }, "USD")).toBe(true)
    expect(amountInRange(transaction({ amount: "99.994" }), { min: d(100) }, "USD")).toBe(false)
  })

  it("reads a second-currency movement in the principal at its own rate", () => {
    // NIO 3,662.43 at 36.6243 is USD 100.
    const cordobas = transaction({ amount: "3662.43", currency: "NIO" })
    expect(amountInRange(cordobas, { min: d(100) }, "USD")).toBe(true)
    expect(amountInRange(cordobas, { max: d("99.99") }, "USD")).toBe(false)
    // The bank's real debit wins over the rate.
    const debited = transaction({ amount: "3662.43", currency: "NIO", actualDebited: "101" })
    expect(amountInRange(debited, { min: d(101), max: d(101) }, "USD")).toBe(true)
  })

  it("filters transfers by their amount", () => {
    const transfer = transaction({ kind: "transfer", amount: "500", destination: crypto.randomUUID() })
    expect(amountInRange(transfer, { min: d(400), max: d(500) }, "USD")).toBe(true)
  })

  it("rejects a minimum above the maximum", () => {
    expect(amountRangeError({ min: d(500), max: d(100) })).toBe("minAboveMax")
    expect(amountRangeError({ min: d(100), max: d(100) })).toBeUndefined()
    expect(amountRangeError({ min: d(100) })).toBeUndefined()
    expect(amountInRange(hundred, { min: d(500), max: d(100) }, "USD")).toBe(false)
  })
})

describe("originMatches", () => {
  const rent = rule("rent")
  const netflix = rule("netflix", { isSubscription: true })
  const paused = rule("spotify", { isSubscription: true, isPaused: true })
  const rules = [rent, netflix, paused]
  const base = transaction({ amount: "15" })

  it("matches a rule's movements by id, even once the rule is deleted", () => {
    expect(originMatches(fromRule(base, "rent"), { kind: "rule", id: "rent" }, rules)).toBe(true)
    expect(originMatches(fromRule(base, "netflix"), { kind: "rule", id: "rent" }, rules)).toBe(false)
    expect(originMatches(fromRule(base, "gone"), { kind: "rule", id: "gone" }, rules)).toBe(true)
  })

  it("counts subscriptions by the rule as it is today, paused or not", () => {
    expect(originMatches(fromRule(base, "netflix"), { kind: "subscriptions" }, rules)).toBe(true)
    expect(originMatches(fromRule(base, "spotify"), { kind: "subscriptions" }, rules)).toBe(true)
    expect(originMatches(fromRule(base, "rent"), { kind: "subscriptions" }, rules)).toBe(false)
    // A deleted rule can't say whether it was a subscription.
    expect(originMatches(fromRule(base, "gone"), { kind: "subscriptions" }, rules)).toBe(false)
  })

  it("never matches a movement logged by hand", () => {
    expect(originMatches(base, { kind: "subscriptions" }, rules)).toBe(false)
    expect(originMatches(base, { kind: "rule", id: "rent" }, rules)).toBe(false)
    expect(originMatches(base, { kind: "any" }, rules)).toBe(true)
  })
})

describe("filterTransactions with amount and origin", () => {
  const netflix = rule("netflix", { isSubscription: true })
  const small = fromRule({ ...transaction({ amount: "15" }), id: "small" }, "netflix")
  const big = { ...transaction({ amount: "250" }), id: "big" }
  const draft = { ...transaction({ amount: "120", status: "planned" }), id: "draft" }
  const all = [small, big, draft]
  const query = (extra: Partial<TransactionQuery> = {}): TransactionQuery => ({ kind: "all", scope: { kind: "all" }, text: "", ...extra })
  const text = (tx: Transaction) => tx.description
  const context = { principal: "USD", rules: [netflix] }
  const ids = (list: Transaction[]) => list.map((tx) => tx.id)

  it("is today's filter without amount or origin", () => {
    expect(ids(filterTransactions(all, query(), text))).toEqual(["small", "big", "draft"])
    expect(ids(filterTransactions(all, query(), text, context))).toEqual(["small", "big", "draft"])
    expect(ids(filterTransactions(all, query({ amount: {}, origin: { kind: "any" } }), text, context))).toEqual(["small", "big", "draft"])
    expect(ids(filterTransactions(all, query({ kind: "planned" }), text, context))).toEqual(["draft"])
  })

  it("narrows by amount and by origin together with the kind", () => {
    expect(ids(filterTransactions(all, query({ amount: { min: d(100) } }), text, context))).toEqual(["big", "draft"])
    expect(ids(filterTransactions(all, query({ kind: "expense", amount: { min: d(100) } }), text, context))).toEqual(["big"])
    expect(ids(filterTransactions(all, query({ origin: { kind: "subscriptions" } }), text, context))).toEqual(["small"])
    expect(ids(filterTransactions(all, query({ origin: { kind: "rule", id: "netflix" }, amount: { min: d(20) } }), text, context))).toEqual([])
  })

  it("ignores amount and origin without a context", () => {
    expect(ids(filterTransactions(all, query({ amount: { min: d(100) }, origin: { kind: "subscriptions" } }), text))).toEqual(["small", "big", "draft"])
  })
})
