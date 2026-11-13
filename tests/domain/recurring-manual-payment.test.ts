// T29: a movement typed by hand for an occurrence the rule then produces on its own.
// A manual payment of the rent (same account, kind and currency, amount within 7.5 %, up to two
// calendar days before) counts as the occurrence: the rule produces nothing for it and moves on.
import { describe, expect, it } from "vitest"

import { manualPaymentFor, materializeRecurring, occurrence } from "@/lib/domain"
import { DEFAULT_SETTINGS, type RecurringRule, type Transaction } from "@/lib/schema"

import { IDs, ZONE, date, sampleStore, transaction } from "./fixtures"

const RULE_ID = "00000000-0000-0000-0000-00000000e029"
const OTHER_RULE_ID = "00000000-0000-0000-0000-00000000f029"

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

/** `card: null` pays from the account itself. */
type Payment = Partial<Omit<Parameters<typeof transaction>[0], "card">> & { card?: string | null; recurringId?: string }

function manual(options: Payment = {}): Transaction {
  const { recurringId, card, ...rest } = options
  const made = transaction({ amount: "500", account: IDs.savings, category: "housing", description: "Alquiler", date: date(2026, 10, 30), ...rest, ...(card === null ? {} : { card: card ?? IDs.savingsDebit }) })
  return recurringId === undefined ? made : { ...made, recurringId }
}

/** The rent paid by hand two days before it's due: same account and amount, no `recurringId`. */
function storeWith(rules: RecurringRule[], transactions: Transaction[]) {
  const store = sampleStore()
  store.settings = { ...DEFAULT_SETTINGS, currencies: { principal: "USD", second: "NIO", rate: "36.6243" }, hasCompletedOnboarding: true }
  store.recurringRules = rules
  store.transactions = transactions
  return store
}

const storeWithManualRent = () => storeWith([rent], [manual()])

const ruleMovements = (store: ReturnType<typeof sampleStore>, ruleId = RULE_ID) => store.transactions.filter((tx) => tx.recurringId === ruleId)

/** Runs the rent rule on 1 Nov at 20:00 next to one manual payment; true when that payment covered it. */
async function covers(payment: Transaction, rule: RecurringRule = rent, today = date(2026, 11, 1, 20)): Promise<boolean> {
  const store = storeWith([rule], [payment])
  const created = await materializeRecurring(store, today)
  return created.length === 0
}

describe("Manual payment of a recurring occurrence (T29)", () => {
  it("the manual payment counts as the occurrence and nothing is duplicated", async () => {
    const store = storeWithManualRent()
    expect(occurrence(rent, 1, ZONE).toISOString()).toBe(rent.nextDate)
    const created = await materializeRecurring(store, date(2026, 11, 1, 20))
    expect(created).toEqual([])
    expect(store.transactions.filter((tx) => tx.accountId === IDs.savings && tx.amount === "500" && tx.status === "confirmed")).toHaveLength(1)
    // The rule moves on as if it had produced the occurrence, and the manual movement is left as typed.
    expect(store.recurringRules[0]?.nextDate).toBe(date(2026, 12, 1, 9).toISOString())
    expect(store.transactions[0]?.recurringId).toBeUndefined()
  })

  it("a rule without automatic confirmation leaves no draft for an occurrence already paid", async () => {
    const store = storeWith([{ ...rent, autoConfirm: false }], [manual()])
    expect(await materializeRecurring(store, date(2026, 11, 1, 20))).toEqual([])
    expect(store.transactions.filter((tx) => tx.status === "planned")).toEqual([])
  })

  it("counts from two calendar days before through the occurrence's day", async () => {
    expect(await covers(manual({ date: date(2026, 10, 30, 0) }))).toBe(true)
    expect(await covers(manual({ date: date(2026, 11, 1, 23) }))).toBe(true)
    expect(await covers(manual({ date: date(2026, 10, 29, 23) }))).toBe(false)
    // Typed the day after: the occurrence already exists by then (out of scope).
    expect(await covers(manual({ date: date(2026, 11, 2, 8) }), rent, date(2026, 11, 2, 20))).toBe(false)
  })

  it("allows the amount to differ by 7.5 % of the rule's, no more", async () => {
    expect(await covers(manual({ amount: "537.50" }))).toBe(true)
    expect(await covers(manual({ amount: "462.50" }))).toBe(true)
    expect(await covers(manual({ amount: "538" }))).toBe(false)
    expect(await covers(manual({ amount: "462" }))).toBe(false)
  })

  it("needs the rule's account, currency, kind and card", async () => {
    expect(await covers(manual({ account: IDs.payroll, card: IDs.payrollDebit }))).toBe(false)
    expect(await covers(manual({ currency: "NIO" }))).toBe(false)
    expect(await covers(manual({ kind: "income", category: "salary" }))).toBe(false)
    expect(await covers(manual({ card: IDs.savingsTransfer }))).toBe(false)
    // A rule paid from the account (no card) accepts any card of that account.
    const { cardId: _card, ...fromAccount } = rent
    expect(await covers(manual({ card: IDs.savingsTransfer }), fromAccount)).toBe(true)
  })

  it("never takes a movement linked to another rule, and takes one linked to this rule on another day", async () => {
    expect(await covers(manual({ recurringId: OTHER_RULE_ID }))).toBe(false)
    expect(await covers(manual({ recurringId: RULE_ID }))).toBe(true)
  })

  it("one payment covers one occurrence of a weekly rule, not the next one", async () => {
    const weekly: RecurringRule = { ...rent, frequency: "weekly", startDate: date(2026, 10, 25, 9).toISOString(), nextDate: date(2026, 11, 1, 9).toISOString() }
    const store = storeWith([weekly], [manual({ date: date(2026, 10, 31) })])
    const created = await materializeRecurring(store, date(2026, 11, 8, 20))
    expect(created.map((tx) => tx.date)).toEqual([date(2026, 11, 8, 9).toISOString()])
    expect(store.recurringRules[0]?.nextDate).toBe(date(2026, 11, 15, 9).toISOString())
  })

  it("two rules with the same amount and account: the payment covers only the one with the lower id", async () => {
    const other: RecurringRule = { ...rent, id: OTHER_RULE_ID, name: "Parking" }
    const store = storeWith([other, rent], [manual()])
    const created = await materializeRecurring(store, date(2026, 11, 1, 20))
    expect(created.map((tx) => tx.recurringId)).toEqual([OTHER_RULE_ID])
    expect(ruleMovements(store)).toEqual([])
    expect(store.recurringRules.map((rule) => rule.nextDate)).toEqual([date(2026, 12, 1, 9).toISOString(), date(2026, 12, 1, 9).toISOString()])
  })

  it("applies to transfers with the same destination and to income", async () => {
    const { categoryId: _c, cardId: _k, ...base } = rent
    const transferRule: RecurringRule = { ...base, kind: "transfer", destinationAccountId: IDs.cash }
    expect(await covers(manual({ kind: "transfer", category: null, card: null, destination: IDs.cash }), transferRule)).toBe(true)
    expect(await covers(manual({ kind: "transfer", category: null, card: null, destination: IDs.payroll }), transferRule)).toBe(false)
    const { cardId: _card, ...salary } = { ...rent, kind: "income" as const, categoryId: "salary", amount: "1200" }
    expect(await covers(manual({ kind: "income", category: "salary", card: null, amount: "1180" }), salary)).toBe(true)
  })

  it("picks the closest amount, then the closest date, then the lowest id, and skips taken ones", () => {
    const due = new Date(rent.nextDate)
    const near = { ...manual({ amount: "505", date: date(2026, 10, 30) }), id: "00000000-0000-0000-0000-0000000000b2" }
    const far = { ...manual({ amount: "520", date: date(2026, 11, 1) }), id: "00000000-0000-0000-0000-0000000000b1" }
    expect(manualPaymentFor(rent, due, [far, near], new Set(), ZONE)?.id).toBe(near.id)
    const sameAmountLater = { ...near, id: "00000000-0000-0000-0000-0000000000b3", date: date(2026, 10, 31).toISOString() }
    expect(manualPaymentFor(rent, due, [near, sameAmountLater], new Set(), ZONE)?.id).toBe(sameAmountLater.id)
    const twin = { ...near, id: "00000000-0000-0000-0000-0000000000b0" }
    expect(manualPaymentFor(rent, due, [near, twin], new Set(), ZONE)?.id).toBe(twin.id)
    expect(manualPaymentFor(rent, due, [near, twin], new Set([twin.id]), ZONE)?.id).toBe(near.id)
  })
})
