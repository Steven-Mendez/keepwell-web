// Tags and categorization rules: the same cases as iOS TagsAndRulesTests, the use cases, CSV import,
// and IndexedDB.
import "fake-indexeddb/auto"

import { describe, expect, it } from "vitest"

import {
  DomainError,
  InMemoryStore,
  applyRuleToPast,
  applyingRule,
  autoCategorized,
  firstMatchingRule,
  getTransactionContext,
  mergeTags,
  normalizedTag,
  normalizedTags,
  occurrenceTransaction,
  pastMatchCount,
  pastMatches,
  reorderCategorizationRules,
  ruleMatches,
  saveCategorizationRule,
  saveRecurringRule,
  saveTransaction,
  searchedTag,
  tagSuggestions,
  tagUsage,
  validatedRule,
} from "@/lib/domain"
import {
  exportCsv,
  parseCsvRows,
} from "@/lib/domain/csv"
import {
  DEFAULT_CATEGORIES,
  type CategorizationRule,
  type RecurringRule,
  type Transaction,
} from "@/lib/schema"

import { d, date, IDs, referenceDate, sampleData, sampleStore, transaction, ZONE } from "./fixtures"

async function expectDomainError(work: () => unknown, code: DomainError["code"]) {
  const error = await Promise.resolve()
    .then(work)
    .then(
      () => undefined,
      (thrown: unknown) => thrown
    )
  expect(error).toBeInstanceOf(DomainError)
  expect((error as DomainError).code).toBe(code)
}

describe("Tags", () => {
  it.each([
    ["#Viaje México", "viaje-méxico"],
    ["  ##boda  ", "boda"],
    ["Fin de  semana\tlargo", "fin-de-semana-largo"],
    ["ÑANDÚ", "ñandú"],
    ["méxico", "méxico"],
    ["# - boda - ", "boda"],
    ["a".repeat(40), "a".repeat(32)],
    ["a".repeat(31) + " b", "a".repeat(31)],
    ["café#2", "café#2"],
  ])("normalizes %j the same on both apps", (raw, expected) => {
    expect(normalizedTag(raw)).toBe(expected)
  })

  it.each(["", "   ", "#", "## ", " - "])("drops the blank tag %j", (raw) => {
    expect(normalizedTag(raw)).toBeUndefined()
  })

  it("keeps each tag once in the order first given", () => {
    expect(normalizedTags(["Boda", "#viaje", "#boda", " ", "VIAJE"])).toEqual(["boda", "viaje"])
    expect(mergeTags(["boda"], ["viaje", "Boda"])).toEqual(["boda", "viaje"])
  })

  it("puts the most used first and leaves out the chosen ones", () => {
    const usage = tagUsage([{ tags: ["viaje", "boda"] }, { tags: ["boda"] }, { tags: ["boda", "casa"] }, { tags: ["casa"] }, {}])
    expect(usage).toEqual(["boda", "casa", "viaje"])
    expect(tagSuggestions(usage, "", ["casa"])).toEqual(["boda", "viaje"])
    expect(tagSuggestions(usage, "#A", [])).toEqual(["boda", "casa", "viaje"])
    expect(tagSuggestions(usage, "vi", [])).toEqual(["viaje"])
  })

  it.each([
    ["#boda", "boda"],
    ["  # Viaje México ", "viaje-méxico"],
  ])("a hash search %j asks for that tag", (query, expected) => {
    expect(searchedTag(query)).toBe(expected)
  })

  it.each(["boda", "", "#", "café #boda"])("the search %j asks for no tag", (query) => {
    expect(searchedTag(query)).toBeUndefined()
  })

  it("a saved movement keeps its tags normalized, and none when empty", async () => {
    const store = sampleStore()
    const base = {
      kind: "expense" as const,
      amount: d(5),
      currency: "USD",
      categoryId: "transport",
      source: { type: "card" as const, id: IDs.savingsDebit },
      description: "Taxi",
      date: referenceDate,
      note: "",
      isDraft: false,
    }
    const tagged = await saveTransaction(store, { ...base, id: crypto.randomUUID(), tags: ["#Boda", "boda", "Viaje México"] })
    expect(tagged.transaction.tags).toEqual(["boda", "viaje-méxico"])
    const plain = await saveTransaction(store, { ...base, id: crypto.randomUUID(), tags: [] })
    expect(plain.transaction).not.toHaveProperty("tags")
  })

  it("a recurring rule hands its tags to the movements it records", async () => {
    const store = sampleStore()
    const rule: RecurringRule = {
      id: crypto.randomUUID(),
      name: "Gym",
      kind: "expense",
      categoryId: "health",
      amount: "30",
      currency: "USD",
      accountId: IDs.savings,
      cardId: IDs.savingsDebit,
      frequency: "monthly",
      interval: 1,
      startDate: date(2026, 1, 1).toISOString(),
      nextDate: date(2026, 1, 1).toISOString(),
      isSubscription: false,
      autoConfirm: true,
      isPaused: false,
      tags: ["salud"],
    }
    const movement = occurrenceTransaction(rule, date(2026, 1, 1), await getTransactionContext(store))
    expect(movement.tags).toEqual(["salud"])
    expect(movement.recurringId).toBe(rule.id)
  })
})

describe("Categorization rules", () => {
  const uber: CategorizationRule = { id: "r-uber", match: "uber", categoryId: "transport", kind: "expense", tags: ["trabajo"] }
  const cafe: CategorizationRule = { id: "r-cafe", match: "Cafe", categoryId: "restaurants", kind: "expense" }
  const anyTrip: CategorizationRule = { id: "r-trip", match: "trip", categoryId: "travel", kind: "expense" }
  const payroll: CategorizationRule = { id: "r-pay", match: "payroll", categoryId: "salary", kind: "income" }

  it("matches without case or accents in the description or note", () => {
    expect(ruleMatches(uber, "expense", "UBER *TRIP 1234", undefined)).toBe(true)
    expect(ruleMatches(cafe, "expense", "Café París", undefined)).toBe(true)
    expect(ruleMatches(cafe, "expense", "Breakfast", "at the café")).toBe(true)
    expect(ruleMatches(cafe, "income", "Café París", undefined)).toBe(false)
    expect(ruleMatches({ match: "  ", kind: "expense" }, "expense", "x", undefined)).toBe(false)
  })

  it("lets the first rule in order win", () => {
    const rules = [anyTrip, uber, payroll]
    expect(firstMatchingRule(rules, "expense", "Uber trip", undefined)).toBe(anyTrip)
    expect(firstMatchingRule([uber, anyTrip], "expense", "Uber trip", undefined)).toBe(uber)
    expect(firstMatchingRule(rules, "income", "ACME PAYROLL", undefined)).toBe(payroll)
    expect(firstMatchingRule(rules, "expense", "Groceries", undefined)).toBeUndefined()
  })

  it("validating trims the text and checks the category and kind", async () => {
    const categories = DEFAULT_CATEGORIES
    expect(validatedRule({ id: "x", match: "  Uber  ", categoryId: "transport", kind: "expense", tags: ["#Trabajo"] }, categories)).toEqual({
      id: "x",
      match: "Uber",
      categoryId: "transport",
      kind: "expense",
      tags: ["trabajo"],
    })
    await expectDomainError(() => validatedRule({ id: "x", match: " ", categoryId: "transport", kind: "expense" }, categories), "missingName")
    await expectDomainError(() => validatedRule({ id: "x", match: "x", categoryId: "transport", kind: "income" }, categories), "categoryKindMismatch")
    await expectDomainError(() => validatedRule({ id: "x", match: "x", categoryId: "transport", kind: "transfer" }, categories), "unsupportedTransactionKind")
    expect(validatedRule({ id: "x", match: "x".repeat(80), categoryId: "transport", kind: "expense" }, categories).match).toHaveLength(60)
  })

  it("applying to past changes only uncategorized matching movements of its kind", () => {
    const movement = (description: string, category: string | null, kind: "expense" | "income" = "expense"): Transaction => ({
      ...transaction({ amount: "5", kind, category, description }),
      tags: ["boda"],
    })
    const other = movement("Uber home", "other-expense")
    const none = movement("uber", null)
    const categorized = movement("Uber eats", "restaurants")
    const unrelated = movement("Bus", "other-expense")
    const income = movement("Uber refund", "other-income", "income")
    const matches = pastMatches({ ...uber, tags: ["trabajo"] }, [other, none, categorized, unrelated, income])
    expect(matches.map((t) => t.id)).toEqual([other.id, none.id])
    const applied = applyingRule(uber, other, [])
    expect(applied.categoryId).toBe("transport")
    expect(applied.tags).toEqual(["boda", "trabajo"])
    expect(applied.id).toBe(other.id)
  })

  it("saves, orders and applies rules to past movements", async () => {
    const store = new InMemoryStore(ZONE, { transactions: [transaction({ amount: "8", description: "Uber to work" }), transaction({ amount: "9", description: "Uber eats", category: "restaurants" })] })
    const first = await saveCategorizationRule(store, { match: " Uber ", categoryId: "transport", kind: "expense" })
    const second = await saveCategorizationRule(store, { match: "eats", categoryId: "restaurants", kind: "expense" })
    await reorderCategorizationRules(store, [second.id])
    expect((await store.fetchCategorizationRules()).map((rule) => rule.id)).toEqual([second.id, first.id])
    await expectDomainError(() => saveCategorizationRule(store, { id: "missing", match: "x", categoryId: "transport", kind: "expense" }), "notFound")
    expect(await pastMatchCount(store, first)).toBe(1)
    expect(await applyRuleToPast(store, first)).toBe(1)
    expect(store.transactions.find((t) => t.description === "Uber to work")?.categoryId).toBe("transport")
    expect(await pastMatchCount(store, first)).toBe(0)
  })

  it("keeps an edited rule's business this device doesn't have yet, and refuses a new unknown one", async () => {
    const store = new InMemoryStore(ZONE, { categorizationRules: [{ id: "r1", match: "uber", categoryId: "transport", kind: "expense", merchantId: "m-elsewhere" }] })
    const edited = await saveCategorizationRule(store, { id: "r1", match: "uber eats", categoryId: "transport", kind: "expense", merchantId: "m-elsewhere" })
    expect(edited.merchantId).toBe("m-elsewhere")
    expect((await store.fetchCategorizationRules())[0]).toMatchObject({ match: "uber eats", merchantId: "m-elsewhere" })
    await expectDomainError(() => saveCategorizationRule(store, { id: "r1", match: "uber", categoryId: "transport", kind: "expense", merchantId: "m-other" }), "notFound")
    await expectDomainError(() => saveCategorizationRule(store, { match: "lyft", categoryId: "transport", kind: "expense", merchantId: "m-elsewhere" }), "notFound")
  })
})


describe("Categorization rules on every path", () => {
  const uber: CategorizationRule = { id: "r-uber", match: "uber", categoryId: "transport", kind: "expense", tags: ["trabajo"] }
  const anyTrip: CategorizationRule = { id: "r-trip", match: "trip", categoryId: "travel", kind: "expense" }
  const draft = (overrides: Partial<Parameters<typeof saveTransaction>[1]> = {}) => ({
    id: crypto.randomUUID(),
    kind: "expense" as const,
    amount: d(5),
    currency: "USD",
    source: { type: "card" as const, id: IDs.savingsDebit },
    description: "Uber home",
    date: referenceDate,
    note: "",
    isDraft: false,
    ...overrides,
  })

  it("a new movement in Other takes the rule's category and tags; a chosen category and a transfer stay", () => {
    const other: Transaction = { ...transaction({ amount: "5", category: "other-expense", description: "Uber home" }), tags: ["boda"] }
    const categorized = autoCategorized(other, [uber], [])
    expect(categorized.categoryId).toBe("transport")
    expect(categorized.tags).toEqual(["boda", "trabajo"])
    const chosen = transaction({ amount: "5", category: "restaurants", description: "Uber eats" })
    expect(autoCategorized(chosen, [uber], [])).toBe(chosen)
    const transfer: Transaction = { ...transaction({ amount: "5", description: "Uber" }), kind: "transfer" }
    delete (transfer as Partial<Transaction>).categoryId
    expect(autoCategorized(transfer, [uber], [])).toBe(transfer)
  })

  it("with two matching rules the first in the person's order wins", () => {
    const other = transaction({ amount: "5", category: "other-expense", description: "Uber trip" })
    expect(autoCategorized(other, [anyTrip, uber], []).categoryId).toBe("travel")
    expect(autoCategorized(other, [uber, anyTrip], []).categoryId).toBe("transport")
  })

  it("saving a new movement without a category takes the rule, or Other when none matches", async () => {
    const store = new InMemoryStore(ZONE, sampleData())
    store.categorizationRules = [uber]
    const ruled = await saveTransaction(store, draft())
    expect(ruled.transaction.categoryId).toBe("transport")
    expect(ruled.transaction.tags).toEqual(["trabajo"])
    expect(ruled.rule?.id).toBe(uber.id)
    const unmatched = await saveTransaction(store, draft({ description: "Groceries" }))
    expect(unmatched.transaction.categoryId).toBe("other-expense")
    expect(unmatched.rule).toBeUndefined()
    const chosen = await saveTransaction(store, draft({ categoryId: "restaurants", description: "Uber eats" }))
    expect(chosen.transaction.categoryId).toBe("restaurants")
  })

  it("the rule reads the text as typed, not the name the safety net fills in", async () => {
    const store = new InMemoryStore(ZONE, sampleData())
    store.categorizationRules = [{ id: "r-other", match: "other", categoryId: "transport", kind: "expense" }]
    const saved = await saveTransaction(store, draft({ description: "", categoryId: "other-expense" }))
    expect(saved.transaction.categoryId).toBe("other-expense")
    expect(saved.transaction.description).not.toBe("")
  })

  it("an edit in Other never goes through the rules", async () => {
    const store = new InMemoryStore(ZONE, sampleData())
    const first = await saveTransaction(store, draft({ categoryId: "other-expense" }))
    expect(first.transaction.categoryId).toBe("other-expense")
    store.categorizationRules = [uber]
    const edited = await saveTransaction(store, draft({ id: first.transaction.id, categoryId: "other-expense", note: "edited" }))
    expect(edited.transaction.categoryId).toBe("other-expense")
    expect(edited.rule).toBeUndefined()
  })

  it("a rule whose category is gone is ignored", async () => {
    const store = new InMemoryStore(ZONE, sampleData())
    store.categorizationRules = [{ ...uber, categoryId: "deleted-category" }]
    const context = await getTransactionContext(store)
    expect(context.rules).toEqual([])
    const saved = await saveTransaction(store, draft())
    expect(saved.transaction.categoryId).toBe("other-expense")
  })

  it("a recurring rule still needs its own category", async () => {
    const store = new InMemoryStore(ZONE, sampleData())
    await expectDomainError(
      () =>
        saveRecurringRule(store, {
          name: "Uber pass",
          kind: "expense",
          amount: d(5),
          currency: "USD",
          source: { type: "card", id: IDs.savingsDebit },
          frequency: "monthly",
          interval: 1,
          startDate: referenceDate,
          isSubscription: false,
          autoConfirm: true,
          note: "",
        }),
      "notFound",
    )
  })
})


describe("filtering by tag", () => {
  it("narrows a #tag search to that tag and keeps plain searches as text", async () => {
    const { filterTransactions } = await import("@/lib/domain")
    const { transaction } = await import("./fixtures")
    const boda = { ...transaction({ kind: "expense", amount: "10" }), id: "a", description: "Flowers", tags: ["boda"] }
    const viaje = { ...transaction({ kind: "expense", amount: "5" }), id: "b", description: "boda gift", tags: ["viaje"] }
    const query = (text: string) => ({ kind: "all" as const, scope: { kind: "all" as const }, text })
    const text = (tx: { description: string }) => tx.description
    expect(filterTransactions([boda, viaje], query(" #Boda "), text).map((tx) => tx.id)).toEqual(["a"])
    expect(filterTransactions([boda, viaje], query("boda"), text).map((tx) => tx.id)).toEqual(["b"])
  })

  it("CSV tags go out as the last column", async () => {
    const tagged = transaction({ amount: "900", currency: "NIO", account: IDs.cash, category: "travel", description: "Hotel" })
    const csv = exportCsv([{ ...tagged, tags: ["viaje-mexico", "boda"] }], sampleData().accounts, [], DEFAULT_CATEGORIES, ZONE)
    const rows = parseCsvRows(csv)
    expect(rows[0]?.at(-1)).toBe("tags")
    expect(rows[1]?.at(-1)).toBe("#viaje-mexico #boda")
  })
})
