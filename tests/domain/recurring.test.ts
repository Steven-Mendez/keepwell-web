// Recurring movements and subscriptions: the schedule, materializing what's due, pause and resume,
// and totals (shared contract with keepwell-ios).
import { describe, expect, it } from "vitest"

import {
  DomainError,
  InMemoryStore,
  dayKey,
  deleteAccount,
  deleteRecurringRule,
  due,
  firstOccurrence,
  homeOverview,
  loadLedger,
  materializeRecurring,
  monthlyEquivalent,
  occurrence,
  recurringOverview,
  ruleRepeating,
  saveRecurringRule,
  saveRepeatingTransaction,
  saveTransaction,
  setRecurringRulePaused,
  subscriptionsCharged,
  subscriptionsPerMonth,
  upcoming,
  type RecurringRuleDraft,
} from "@/lib/domain"
import { DEFAULT_SETTINGS, type RecurringRule } from "@/lib/schema"

import { IDs, d, date, sampleStore, single, transaction } from "./fixtures"

const RULE_ID = "00000000-0000-0000-0000-00000000e001"

type Overrides<T> = { [K in keyof T]?: T[K] | undefined }

/** Drops keys set to `undefined`, so an override can remove an optional field. */
const defined = <T,>(value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T

function rule(overrides: Overrides<RecurringRule> = {}): RecurringRule {
  const start = overrides.startDate ?? date(2026, 1, 31, 9).toISOString()
  return defined<RecurringRule>({
    id: RULE_ID,
    name: "Streaming",
    kind: "expense",
    categoryId: "subscriptions",
    amount: "10",
    currency: "USD",
    accountId: IDs.mastercard,
    cardId: IDs.mastercardHolder,
    frequency: "monthly",
    interval: 1,
    startDate: start,
    nextDate: start,
    isSubscription: true,
    autoConfirm: false,
    isPaused: false,
    ...overrides,
  })
}

const days = (dates: readonly Date[]) => dates.map(dayKey)

async function expectDomainError(work: () => Promise<unknown>, code: DomainError["code"]) {
  const error = await work().then(
    () => undefined,
    (thrown: unknown) => thrown,
  )
  expect(error).toBeInstanceOf(DomainError)
  expect((error as DomainError).code).toBe(code)
}

describe("Recurring schedule", () => {
  it("clamps month ends from the anchor, never from the previous clamped date", () => {
    const monthly = rule()
    expect(days([0, 1, 2, 3, 12, 13].map((n) => occurrence(monthly, n)))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2027-01-31", "2027-02-28"])
    const leap = rule({ startDate: date(2028, 1, 31).toISOString() })
    expect(dayKey(occurrence(leap, 1))).toBe("2028-02-29")
  })

  it("keeps the time of day on every occurrence", () => {
    const monthly = rule({ startDate: date(2026, 1, 31, 7).toISOString() })
    expect(occurrence(monthly, 5).getHours()).toBe(7)
    expect(occurrence(monthly, 5).getMinutes()).toBe(0)
  })

  it("weekly is seven days times the interval; yearly clamps Feb 29", () => {
    const weekly = rule({ frequency: "weekly", interval: 2, startDate: date(2026, 10, 1).toISOString() })
    expect(days([0, 1, 2].map((n) => occurrence(weekly, n)))).toEqual(["2026-10-01", "2026-10-15", "2026-10-29"])
    const yearly = rule({ frequency: "yearly", startDate: date(2028, 2, 29).toISOString() })
    expect(days([1, 4].map((n) => occurrence(yearly, n)))).toEqual(["2029-02-28", "2032-02-29"])
    const every3Months = rule({ interval: 3 })
    expect(days([1, 2].map((n) => occurrence(every3Months, n)))).toEqual(["2026-04-30", "2026-07-31"])
  })

  it("first occurrence on or after a day compares calendar days", () => {
    const monthly = rule()
    expect(dayKey(firstOccurrence(monthly, date(2026, 2, 28, 23)))).toBe("2026-02-28")
    expect(dayKey(firstOccurrence(monthly, date(2026, 3, 1)))).toBe("2026-03-31")
    expect(dayKey(firstOccurrence(monthly, date(2020, 1, 1)))).toBe("2026-01-31")
    expect(dayKey(firstOccurrence(monthly, date(2031, 6, 15)))).toBe("2031-06-30")
  })

  it("due: from nextDate through today, within the end, none when paused", () => {
    const monthly = rule({ nextDate: occurrence(rule(), 1).toISOString() })
    expect(days(due(monthly, date(2026, 4, 30, 6)))).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"])
    expect(days(due({ ...monthly, endDate: date(2026, 3, 31, 0).toISOString() }, date(2026, 6, 1)))).toEqual(["2026-02-28", "2026-03-31"])
    expect(due({ ...monthly, isPaused: true }, date(2026, 6, 1))).toEqual([])
    expect(due(monthly, date(2026, 2, 27))).toEqual([])
  })

  it("monthly equivalent by frequency and interval", () => {
    expect(monthlyEquivalent({ amount: "30", frequency: "monthly", interval: 3 }).toString()).toBe("10")
    expect(monthlyEquivalent({ amount: "12", frequency: "weekly", interval: 1 }).toString()).toBe("52")
    expect(monthlyEquivalent({ amount: "120", frequency: "yearly", interval: 2 }).toString()).toBe("5")
  })

  it("subscriptions per month convert to the principal and skip paused and other kinds", () => {
    const currencies = { principal: "USD", second: "NIO", rate: "36.6243" }
    const total = subscriptionsPerMonth(
      [
        rule({ id: crypto.randomUUID(), amount: "10" }),
        rule({ id: crypto.randomUUID(), amount: "366.243", currency: "NIO" }),
        rule({ id: crypto.randomUUID(), amount: "99", isPaused: true }),
        rule({ id: crypto.randomUUID(), amount: "50", isSubscription: false }),
        rule({ id: crypto.randomUUID(), amount: "120", frequency: "yearly" }),
      ],
      currencies,
    )
    expect(total).toEqual({ amount: d(30), currency: "USD" })
    const overview = recurringOverview([rule(), rule({ id: crypto.randomUUID(), isSubscription: false, kind: "income", categoryId: "salary" })], currencies)
    expect(overview.sections.map((section) => section.kind)).toEqual(["subscriptions", "income"])
    expect(overview.subscriptionsPerYear.amount.toString()).toBe("120")
  })

  it("upcoming lists the next occurrences within the window, soonest first", () => {
    const today = date(2026, 10, 20, 8)
    const rules = [
      rule({ id: crypto.randomUUID(), name: "Rent", startDate: date(2026, 1, 25).toISOString(), nextDate: date(2026, 10, 25).toISOString() }),
      rule({ id: crypto.randomUUID(), name: "Gym", frequency: "weekly", startDate: date(2026, 10, 1).toISOString(), nextDate: date(2026, 10, 22).toISOString() }),
      rule({ id: crypto.randomUUID(), name: "Paused", isPaused: true, startDate: date(2026, 10, 21).toISOString(), nextDate: date(2026, 10, 21).toISOString() }),
    ]
    expect(upcoming(rules, today, 7).map(({ rule: r, date: when }) => `${r.name} ${dayKey(when)}`)).toEqual(["Gym 2026-10-22", "Rent 2026-10-25"])
  })
})

describe("Materialize recurring movements", () => {
  const settings = { ...DEFAULT_SETTINGS, currencies: { principal: "USD", second: "NIO", rate: "36.6243" }, hasCompletedOnboarding: true }

  function storeWith(rules: RecurringRule[]) {
    const store = sampleStore()
    store.transactions = []
    store.recurringRules = rules
    store.settings = settings
    return store
  }

  it("saves each due occurrence as a draft with today's rate and moves nextDate past it", async () => {
    const store = storeWith([rule({ nextDate: occurrence(rule(), 8).toISOString() })])
    const created = await materializeRecurring(store, date(2026, 10, 31, 20))
    expect(days(created.map((tx) => new Date(tx.date)))).toEqual(["2026-09-30", "2026-10-31"])
    const [first] = created
    expect(first).toMatchObject({ status: "planned", description: "Streaming", recurringId: RULE_ID, categoryId: "subscriptions", cardId: IDs.mastercardHolder, accountId: IDs.mastercard, isShared: false })
    expect(first?.exchangeRate).toEqual({ principal: "USD", second: "NIO", rate: "36.6243" })
    expect(dayKey(new Date(store.recurringRules[0]!.nextDate))).toBe("2026-11-30")
  })

  it("auto-confirm saves confirmed movements", async () => {
    const store = storeWith([rule({ autoConfirm: true, nextDate: occurrence(rule(), 9).toISOString() })])
    const [created] = await materializeRecurring(store, date(2026, 10, 31, 20))
    expect(created?.status).toBe("confirmed")
  })

  it("keeps only the latest 12 after a long absence", async () => {
    const store = storeWith([rule()])
    const created = await materializeRecurring(store, date(2028, 1, 15))
    expect(created).toHaveLength(12)
    expect(dayKey(new Date(created[0]!.date))).toBe("2027-01-31")
    expect(dayKey(new Date(created.at(-1)!.date))).toBe("2027-12-31")
    expect(dayKey(new Date(store.recurringRules[0]!.nextDate))).toBe("2028-01-31")
  })

  it("is idempotent: a movement from the rule that day is not created twice", async () => {
    const start = rule({ nextDate: occurrence(rule(), 9).toISOString() })
    const store = storeWith([start])
    const existing = transaction({ amount: "10", date: date(2026, 10, 31, 15), account: IDs.mastercard, card: IDs.mastercardHolder, category: "subscriptions" })
    store.transactions = [{ ...existing, recurringId: RULE_ID }]
    expect(await materializeRecurring(store, date(2026, 10, 31, 20))).toEqual([])
    expect(dayKey(new Date(store.recurringRules[0]!.nextDate))).toBe("2026-11-30")
    // A second run (another tab, a restore from the other device) finds nothing to do.
    store.recurringRules = [start]
    expect(await materializeRecurring(store, date(2026, 10, 31, 20))).toEqual([])
    expect(store.transactions).toHaveLength(1)
  })

  it("paused rules produce nothing and keep nextDate; resuming starts today without back-filling", async () => {
    const paused = rule({ isPaused: true, nextDate: occurrence(rule(), 2).toISOString() })
    const store = storeWith([paused])
    expect(await materializeRecurring(store, date(2026, 10, 31, 20))).toEqual([])
    expect(store.recurringRules[0]!.nextDate).toBe(paused.nextDate)

    await setRecurringRulePaused(store, RULE_ID, false, date(2026, 10, 15))
    expect(store.recurringRules[0]!.isPaused).toBe(false)
    expect(dayKey(new Date(store.recurringRules[0]!.nextDate))).toBe("2026-10-31")
    expect(store.transactions).toEqual([])

    await setRecurringRulePaused(store, RULE_ID, true, date(2026, 10, 15))
    expect(store.recurringRules[0]!.isPaused).toBe(true)
  })

  it("a rule whose category is gone is left for later instead of failing the run", async () => {
    const store = storeWith([rule({ categoryId: "nope", nextDate: occurrence(rule(), 9).toISOString() }), rule({ id: crypto.randomUUID(), name: "Gym", nextDate: occurrence(rule(), 9).toISOString() })])
    const created = await materializeRecurring(store, date(2026, 10, 31, 20))
    expect(created.map((tx) => tx.description)).toEqual(["Gym"])
    expect(dayKey(new Date(store.recurringRules[0]!.nextDate))).toBe("2026-10-31")
  })
})

describe("Recurring rule actions", () => {
  const draft = (overrides: Overrides<RecurringRuleDraft> = {}): RecurringRuleDraft =>
    defined<RecurringRuleDraft>({
    name: "  Gym ",
    kind: "expense",
    amount: d("25"),
    currency: "USD",
    categoryId: "health",
    source: { type: "card", id: IDs.savingsDebit },
    frequency: "monthly",
    interval: 1,
    startDate: date(2026, 11, 5, 9),
    isSubscription: false,
    autoConfirm: false,
    note: " ",
    ...overrides,
    })

  it("validates like a movement plus its own fields", async () => {
    const store = sampleStore()
    await expectDomainError(() => saveRecurringRule(store, draft({ name: " " })), "missingName")
    await expectDomainError(() => saveRecurringRule(store, draft({ amount: d(0) })), "invalidAmount")
    await expectDomainError(() => saveRecurringRule(store, draft({ interval: 0 })), "invalidInterval")
    await expectDomainError(() => saveRecurringRule(store, draft({ interval: 100 })), "invalidInterval")
    await expectDomainError(() => saveRecurringRule(store, draft({ endDate: date(2026, 11, 4) })), "invalidEndDate")
    await expectDomainError(() => saveRecurringRule(store, draft({ categoryId: "salary" })), "categoryKindMismatch")
    await expectDomainError(() => saveRecurringRule(store, draft({ currency: "EUR" })), "invalidCurrency")
    await expectDomainError(() => saveRecurringRule(store, draft({ kind: "transfer", categoryId: undefined })), "invalidTransferDestination")
    expect(store.recurringRules).toEqual([])
  })

  it("saves a new rule from its start (or today) and produces what's due", async () => {
    const store = sampleStore()
    const saved = await saveRecurringRule(store, draft({ startDate: date(2026, 9, 5, 9), endDate: date(2026, 9, 5) }), date(2026, 10, 22))
    expect(saved).toMatchObject({ name: "Gym", accountId: IDs.savings, cardId: IDs.savingsDebit, isPaused: false })
    expect(saved.note).toBeUndefined()
    expect(dayKey(new Date(saved.nextDate))).toBe("2026-11-05")

    const today = await saveRecurringRule(store, draft({ name: "Today", startDate: date(2026, 10, 22, 7) }), date(2026, 10, 22, 12))
    expect(store.transactions.filter((tx) => tx.recurringId === today.id).map((tx) => dayKey(new Date(tx.date)))).toEqual(["2026-10-22"])
  })

  it("only an expense is saved as a subscription", async () => {
    const store = sampleStore()
    const expense = await saveRecurringRule(store, draft({ isSubscription: true }), date(2026, 10, 22))
    expect(expense.isSubscription).toBe(true)
    const income = await saveRecurringRule(store, draft({ name: "Pay", kind: "income", categoryId: "salary", isSubscription: true }), date(2026, 10, 22))
    expect(income.isSubscription).toBe(false)
  })

  it("editing keeps where a rule came from", async () => {
    const store = sampleStore()
    store.recurringRules = [rule({ source: "mcp", isPaused: true })]
    const edited = await saveRecurringRule(store, draft({ id: RULE_ID }), date(2026, 10, 22))
    expect(edited.source).toBe("mcp")
  })

  it("editing the schedule recomputes nextDate; editing other fields keeps it", async () => {
    const store = sampleStore()
    const saved = await saveRecurringRule(store, draft(), date(2026, 10, 22))
    store.recurringRules = [{ ...saved, nextDate: date(2026, 12, 5, 9).toISOString() }]
    const renamed = await saveRecurringRule(store, draft({ id: saved.id, name: "Gym+" }), date(2026, 10, 22))
    expect(renamed.nextDate).toBe(date(2026, 12, 5, 9).toISOString())
    const weekly = await saveRecurringRule(store, draft({ id: saved.id, frequency: "weekly" }), date(2026, 10, 22))
    expect(dayKey(new Date(weekly.nextDate))).toBe("2026-11-05")
    const moved = await saveRecurringRule(store, draft({ id: saved.id, startDate: date(2026, 1, 10) }), date(2026, 10, 22))
    expect(dayKey(new Date(moved.nextDate))).toBe("2026-11-10")
  })

  it("deleting a rule removes its drafts and keeps confirmed movements", async () => {
    const store = sampleStore()
    const base = transaction({ amount: "10", account: IDs.mastercard, card: IDs.mastercardHolder, category: "subscriptions" })
    store.recurringRules = [rule()]
    store.transactions = [
      { ...base, id: crypto.randomUUID(), recurringId: RULE_ID, status: "planned" },
      { ...base, id: crypto.randomUUID(), recurringId: RULE_ID, status: "confirmed" },
    ]
    await deleteRecurringRule(store, RULE_ID)
    expect(store.recurringRules).toEqual([])
    expect(store.transactions.map((tx) => tx.status)).toEqual(["confirmed"])
    await expectDomainError(() => deleteRecurringRule(store, RULE_ID), "notFound")
  })

  it("deleting an account deletes rules from or to it", async () => {
    const store = sampleStore()
    store.recurringRules = [
      rule(),
      rule({ id: crypto.randomUUID(), kind: "transfer", categoryId: undefined, cardId: IDs.payrollTransfer, accountId: IDs.payroll, destinationAccountId: IDs.mastercard, isSubscription: false }),
      rule({ id: crypto.randomUUID(), accountId: IDs.savings, cardId: IDs.savingsDebit }),
    ]
    await deleteAccount(store, IDs.mastercard)
    expect(store.recurringRules.map((r) => r.accountId)).toEqual([IDs.savings])
  })

  it("Repeat on a new movement saves the rule and links the movement", async () => {
    const store = sampleStore()
    const { transaction: saved } = await saveRepeatingTransaction(
      store,
      { id: crypto.randomUUID(), kind: "expense", amount: d("16.79"), currency: "USD", categoryId: "subscriptions", source: { type: "card", id: IDs.mastercardHolder }, description: "Music", date: date(2026, 10, 1, 10), note: "", isDraft: false },
      "monthly",
      date(2026, 10, 22),
    )
    const [created] = store.recurringRules
    expect(saved.recurringId).toBe(created?.id)
    expect(created).toMatchObject({ name: "Music", frequency: "monthly", interval: 1, isSubscription: true, autoConfirm: false, startDate: saved.date })
    expect(dayKey(new Date(created!.nextDate))).toBe("2026-11-01")
    expect(ruleRepeating(saved, "weekly").nextDate).toBe(date(2026, 10, 8, 10).toISOString())
  })

  it("editing a movement keeps the rule it came from", async () => {
    const store = sampleStore()
    const { transaction: saved } = await saveTransaction(store, { id: crypto.randomUUID(), kind: "expense", amount: d("5"), currency: "USD", categoryId: "tools", source: { type: "card", id: IDs.savingsDebit }, description: "Tool", date: date(2026, 10, 2), note: "", isDraft: true, recurringId: RULE_ID })
    const { transaction: edited } = await saveTransaction(store, { id: saved.id, kind: "expense", amount: d("6"), currency: "USD", categoryId: "tools", source: { type: "card", id: IDs.savingsDebit }, description: "Tool", date: date(2026, 10, 2), note: "", isDraft: false })
    expect(edited.recurringId).toBe(RULE_ID)
  })

  it("subscriptions charged to a card include subscription rules paid with it, once", async () => {
    const card = IDs.mastercardHolder
    const charges = [transaction({ description: "Netflix", amount: "10", card, category: "subscriptions", rate: single("USD") })]
    const rules = [rule({ name: "netflix " }), rule({ id: crypto.randomUUID(), name: "Spotify" }), rule({ id: crypto.randomUUID(), name: "Rent", isSubscription: false }), rule({ id: crypto.randomUUID(), name: "Other card", cardId: IDs.visaHolder })]
    expect(subscriptionsCharged(card, charges, rules)).toEqual(["Netflix", "Spotify"])

    const store = sampleStore()
    store.recurringRules = rules
    const ledger = await loadLedger(store)
    const holder = store.cards.find((candidate) => candidate.id === card)!
    store.cards = store.cards.map((candidate) => (candidate.id === card ? { ...holder, expiry: { month: 10, year: 2026 } } : candidate))
    const overview = homeOverview({ ...ledger, cards: store.cards })
    expect(overview.cardSubscriptions.get(card)).toEqual(["Streaming", "Music", "netflix", "Spotify"])
  })
})

describe("Recurring rules in memory", () => {
  it("an InMemoryStore starts with no rules", async () => {
    expect(await new InMemoryStore().fetchRecurringRules()).toEqual([])
  })
})
