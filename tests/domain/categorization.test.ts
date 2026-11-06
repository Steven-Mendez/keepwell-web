// Tags and categorization rules: the same cases as iOS TagsAndRulesTests, the use cases, CSV import,
// IndexedDB and the backup file. The pinned JSON is the same text iOS TagsAndRulesBackupTests checks.
import "fake-indexeddb/auto"

import { describe, expect, it } from "vitest"

import {
  DomainError,
  InMemoryStore,
  applyRuleToPast,
  applyingRule,
  exportCsv,
  firstMatchingRule,
  getTransactionContext,
  importCsv,
  mergeTags,
  normalizedTag,
  normalizedTags,
  occurrenceTransaction,
  parseCsvRows,
  pastMatchCount,
  pastMatches,
  reorderCategorizationRules,
  ruleMatches,
  saveCategorizationRule,
  saveTransaction,
  searchedTag,
  tagSuggestions,
  tagUsage,
  validatedRule,
} from "@/lib/domain"
import {
  backupRepository,
  categorizationRuleRepository,
  settingsRepository,
  transactionRepository,
} from "@/lib/repositories"
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  parseBackupFile,
  serializeBackupFile,
  type BackupFile,
  type CategorizationRule,
  type RecurringRule,
  type Transaction,
} from "@/lib/schema"

import { IDs, d, date, referenceDate, sampleData, sampleStore, transaction } from "./fixtures"

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
    const applied = applyingRule(uber, other)
    expect(applied.categoryId).toBe("transport")
    expect(applied.tags).toEqual(["boda", "trabajo"])
    expect(applied.id).toBe(other.id)
  })

  it("saves, orders and applies rules to past movements", async () => {
    const store = new InMemoryStore({ transactions: [transaction({ amount: "8", description: "Uber to work" }), transaction({ amount: "9", description: "Uber eats", category: "restaurants" })] })
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

  it("CSV import fills rows without a known category from the first matching rule", async () => {
    const store = sampleStore()
    store.categorizationRules = [uber]
    const csv = [
      "date,amount,account,category,type,currency,description",
      "2026-10-20,71.11,Bank One Savings,,expense,USD,UBER 123",
      "2026-10-20,81.11,Bank One Savings,Restaurants,expense,USD,Uber eats",
      "2026-10-20,91.11,Bank One Savings,,expense,USD,Bus",
    ].join("\n")
    expect(await importCsv(store, csv)).toEqual({ imported: 3, skipped: 0 })
    const byAmount = (amount: string) => store.transactions.find((t) => t.amount === amount)!
    expect(byAmount("71.11")).toMatchObject({ categoryId: "transport", tags: ["trabajo"] })
    expect(byAmount("81.11").categoryId).toBe("restaurants")
    expect(byAmount("81.11")).not.toHaveProperty("tags")
    expect(byAmount("91.11").categoryId).toBe("other-expense")
  })
})

describe("Backup file version 4: tags and categorization rules", () => {
  const audit = { createdAt: "2026-10-26T07:33:20.000Z", updatedAt: "2026-10-26T07:33:20.500Z" }
  const settings = {
    ...DEFAULT_SETTINGS,
    currencies: { principal: "USD", second: "NIO", rate: "36.6243" },
    hasCompletedOnboarding: true,
    updatedAt: audit.updatedAt,
  }

  function file(): BackupFile {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: audit.createdAt,
      settings,
      accounts: [],
      cards: [],
      categories: [],
      transactions: [
        {
          id: "7d8e9fa0-b1c2-4d3e-8f40-5162738495a6",
          date: "2026-11-14T18:00:00.000Z",
          status: "confirmed",
          description: "Uber to the airport",
          kind: "expense",
          categoryId: "transport",
          amount: "12.5",
          currency: "USD",
          accountId: IDs.savings,
          exchangeRate: { principal: "USD", second: "NIO", rate: "36.6243" },
          isShared: false,
          tags: normalizedTags(["#Viaje México", "boda", "viaje méxico"]),
          ...audit,
        },
      ],
      recurringRules: [],
      savingsGoals: [],
      loans: [],
      personalDebts: [],
      categorizationRules: [
        { id: "8e9fa0b1-c2d3-4e4f-9051-62738495a6b7", match: "Uber", categoryId: "transport", kind: "expense", tags: normalizedTags(["Viaje México"]), sortIndex: 0, ...audit },
        { id: "9fa0b1c2-d3e4-4f50-a162-738495a6b7c8", match: "Payroll", categoryId: "salary", kind: "income", sortIndex: 1, ...audit, deletedAt: audit.updatedAt },
      ],
    }
  }

  it("writes the same text as iOS: sorted keys, empty tags left out", () => {
    const text = serializeBackupFile(file())
    expect(text).toContain(
      '"transactions":[{"accountId":"00000000-0000-0000-0000-00000000a001","amount":"12.5","categoryId":"transport",' +
        '"createdAt":"2026-10-26T07:33:20.000Z","currency":"USD","date":"2026-11-14T18:00:00.000Z",' +
        '"description":"Uber to the airport","exchangeRate":{"principal":"USD","rate":"36.6243","second":"NIO"},' +
        '"id":"7d8e9fa0-b1c2-4d3e-8f40-5162738495a6","isShared":false,"kind":"expense","status":"confirmed",' +
        '"tags":["viaje-méxico","boda"],"updatedAt":"2026-10-26T07:33:20.500Z"}]'
    )
    expect(text).toContain(
      '"categorizationRules":[{"categoryId":"transport","createdAt":"2026-10-26T07:33:20.000Z",' +
        '"id":"8e9fa0b1-c2d3-4e4f-9051-62738495a6b7","kind":"expense","match":"Uber","sortIndex":0,' +
        '"tags":["viaje-méxico"],"updatedAt":"2026-10-26T07:33:20.500Z"},' +
        '{"categoryId":"salary","createdAt":"2026-10-26T07:33:20.000Z","deletedAt":"2026-10-26T07:33:20.500Z",' +
        '"id":"9fa0b1c2-d3e4-4f50-a162-738495a6b7c8","kind":"income","match":"Payroll","sortIndex":1,' +
        '"updatedAt":"2026-10-26T07:33:20.500Z"}]'
    )
    const parsed = parseBackupFile(text)
    expect(parsed).toEqual(file())
    expect(serializeBackupFile(parsed)).toBe(text)
  })

  it("a file without tags or rules still reads, with none", () => {
    const { categorizationRules: _, ...older } = file()
    const { tags: __, ...movement } = older.transactions[0]!
    const parsed = parseBackupFile(JSON.stringify({ ...older, schemaVersion: 3, transactions: [movement] }))
    expect(parsed.categorizationRules).toEqual([])
    expect(parsed.transactions[0]).not.toHaveProperty("tags")
  })

  it("refuses a rule for transfers", () => {
    const damaged = JSON.parse(serializeBackupFile(file()))
    damaged.categorizationRules[0].kind = "transfer"
    expect(() => parseBackupFile(JSON.stringify(damaged))).toThrow("Not a valid Keepwell backup")
  })

  it("exports and restores tags and rules through IndexedDB, in order and with deletions", async () => {
    await settingsRepository.save({ ...DEFAULT_SETTINGS, currencies: { principal: "USD", second: "NIO", rate: "36.6243" }, hasCompletedOnboarding: true })
    const uber = await categorizationRuleRepository.save({ id: crypto.randomUUID(), match: "Uber", categoryId: "transport", kind: "expense", tags: ["Viaje México"] })
    const cafe = await categorizationRuleRepository.save({ id: crypto.randomUUID(), match: "Café", categoryId: "restaurants", kind: "expense" })
    const gone = await categorizationRuleRepository.save({ id: crypto.randomUUID(), match: "Payroll", categoryId: "salary", kind: "income" })
    await categorizationRuleRepository.save({ ...uber, match: "UBER" })
    await categorizationRuleRepository.reorder([cafe.id, uber.id])
    await categorizationRuleRepository.remove(gone.id)
    await expect(categorizationRuleRepository.remove(gone.id)).rejects.toThrow()
    expect((await categorizationRuleRepository.list()).map((rule) => rule.match)).toEqual(["Café", "UBER"])
    expect((await categorizationRuleRepository.list())[1]!.tags).toEqual(["viaje-méxico"])
    const movement = await transactionRepository.save({ ...transaction({ amount: "3", account: IDs.savings }), tags: ["#Boda", "boda"] })
    expect(movement.tags).toEqual(["boda"])
    expect((await transactionRepository.list()).find((row) => row.id === movement.id)?.tags).toEqual(["boda"])

    const text = await backupRepository.export()
    const exported = parseBackupFile(text)
    expect(exported.categorizationRules.map((rule) => [rule.match, rule.sortIndex, rule.deletedAt !== undefined])).toEqual([
      ["Café", 0, false],
      ["UBER", 1, false],
      ["Payroll", 2, true],
    ])
    await backupRepository.import(text)
    expect((await categorizationRuleRepository.list()).map((rule) => rule.match)).toEqual(["Café", "UBER"])
    expect((await transactionRepository.list()).find((row) => row.id === movement.id)?.tags).toEqual(["boda"])
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

  it("CSV tags go out as the last column and come back", async () => {
    const tagged = transaction({ amount: "900", currency: "NIO", account: IDs.cash, category: "travel", description: "Hotel" })
    const csv = exportCsv([{ ...tagged, tags: ["viaje-mexico", "boda"] }], sampleData().accounts, [], DEFAULT_CATEGORIES)
    const rows = parseCsvRows(csv)
    expect(rows[0]?.at(-1)).toBe("tags")
    expect(rows[1]?.at(-1)).toBe("#viaje-mexico #boda")
    const store = sampleStore()
    expect(await importCsv(store, csv)).toEqual({ imported: 1, skipped: 0 })
    expect(store.transactions.find((t) => t.description === "Hotel")?.tags).toEqual(["viaje-mexico", "boda"])
  })

  it("CSV import splits tags on spaces or commas and normalizes them, the file's before the rule's", async () => {
    const store = sampleStore()
    store.categorizationRules = [{ id: "r-taxi", match: "taxi", categoryId: "transport", kind: "expense", tags: ["trabajo"] }]
    const csv = [
      "date,type,description,category,amount,currency,account,Tags",
      '2026-10-04,expense,Flowers,Gifts,50,NIO,Wallet,"#Boda, Viaje  #boda"',
      "2026-10-04,expense,Taxi,,70,NIO,Wallet,#viaje",
    ].join("\n")
    expect(await importCsv(store, csv)).toEqual({ imported: 2, skipped: 0 })
    expect(store.transactions.find((t) => t.description === "Flowers")?.tags).toEqual(["boda", "viaje"])
    expect(store.transactions.find((t) => t.description === "Taxi")?.tags).toEqual(["viaje", "trabajo"])
  })
})

