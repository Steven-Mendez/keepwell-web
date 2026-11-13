// Merchants: the business a movement was with and the platform it went through. Use cases, the
// default category a merchant suggests, categorization rules that set one, recurring rules that carry
// one, and the repair after a pull.
import { describe, expect, it } from "vitest"

import {
  DomainError,
  InMemoryStore,
  applyingRule,
  createMerchant,
  deleteMerchant,
  draftFrom,
  equivalentMerchant,
  mergeMerchants,
  merchantCategory,
  merchantLinks,
  merchantName,
  normalizedDomain,
  saveCategorizationRule,
  saveMerchant,
  saveRecurringRule,
  saveRepeatingTransaction,
  saveTransaction,
  searchMerchants,
  unlinkDeletedMerchants,
  validatedRule,
  viaChoices,
  type TransactionDraft,
} from "@/lib/domain"
import { DEFAULT_CATEGORIES, Merchant, type CategorizationRule, type Transaction } from "@/lib/schema"

import { d, IDs, referenceDate, sampleData, sampleStore, transaction } from "./fixtures"

const SUBWAY = "66666666-6666-4666-8666-666666666666"
const UBER_EATS = "77777777-7777-4777-8777-777777777777"
const PULPERIA = "88888888-8888-4888-8888-888888888888"

const subway: Merchant = { id: SUBWAY, name: "Subway", domain: "subway.com", brandId: "subway", defaultCategoryId: "restaurants", isPlatform: false }
const uberEats: Merchant = { id: UBER_EATS, name: "Uber Eats", domain: "ubereats.com", isPlatform: true }
const pulperia: Merchant = { id: PULPERIA, name: "Pulpería La Esquina", isPlatform: false }

function store(merchants: Merchant[] = [subway, uberEats, pulperia]): InMemoryStore {
  const result = sampleStore()
  result.merchants = [...merchants]
  return result
}

const draft = (overrides: Partial<TransactionDraft> = {}): TransactionDraft => ({
  id: crypto.randomUUID(),
  kind: "expense",
  amount: d(8),
  currency: "USD",
  source: { type: "card", id: IDs.savingsDebit },
  description: "Lunch",
  date: referenceDate,
  note: "",
  isDraft: false,
  ...overrides,
})

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

describe("Merchant text", () => {
  it("normalizes a domain or address to its host, and refuses what isn't one", () => {
    expect(normalizedDomain("https://www.Subway.com/en?x=1")).toBe("subway.com")
    expect(normalizedDomain(" ubereats.com. ")).toBe("ubereats.com")
    expect(normalizedDomain("claro.com.ni:443")).toBe("claro.com.ni")
    expect(normalizedDomain("")).toBeUndefined()
    expect(normalizedDomain("subway")).toBeUndefined()
    expect(normalizedDomain("sub way.com")).toBeUndefined()
  })

  it("trims and collapses a name and cuts it to 60 characters", () => {
    expect(merchantName("  Pulpería   La  Esquina ")).toBe("Pulpería La Esquina")
    expect([...merchantName("x".repeat(80))]).toHaveLength(60)
  })

  it("searches without case or accents, names that start with the text first", () => {
    const merchants = [subway, uberEats, pulperia, { id: crypto.randomUUID(), name: "La Subasta", isPlatform: false }]
    expect(searchMerchants(merchants, "SUB").map((m) => m.name)).toEqual(["Subway", "La Subasta"])
    expect(searchMerchants(merchants, "pulperia").map((m) => m.id)).toEqual([PULPERIA])
    expect(searchMerchants(merchants, "").map((m) => m.name)).toEqual(["La Subasta", "Pulpería La Esquina", "Subway", "Uber Eats"])
  })

  it("offers platforms first for via, never the business itself", () => {
    expect(viaChoices([subway, uberEats, pulperia], "", SUBWAY).map((m) => m.id)).toEqual([UBER_EATS, PULPERIA])
  })

  it("finds the merchant a draft already names: by brand, by domain without a brand, else by name", () => {
    const merchants = [subway, uberEats, pulperia]
    expect(equivalentMerchant(merchants, { name: "Subway®", brandId: "subway" })?.id).toBe(SUBWAY)
    expect(equivalentMerchant(merchants, { name: "Uber Eats Nicaragua", domain: "https://ubereats.com" })?.id).toBe(UBER_EATS)
    expect(equivalentMerchant(merchants, { name: "pulperia la esquina" })?.id).toBe(PULPERIA)
    expect(equivalentMerchant(merchants, { name: "Apple", brandId: "apple-music" })).toBeUndefined()
  })
})

describe("Merchant use cases", () => {
  it("creates a merchant once: picking the same brand again gives the same one", async () => {
    const ledger = store([])
    const first = await createMerchant(ledger, { name: " Subway ", domain: "https://www.subway.com", brandId: "subway" })
    expect(first).toMatchObject({ name: "Subway", domain: "subway.com", brandId: "subway", isPlatform: false })
    expect(Merchant.safeParse(first).success).toBe(true)
    const again = await createMerchant(ledger, { name: "Subway", brandId: "subway" })
    expect(again.id).toBe(first.id)
    expect(ledger.merchants).toHaveLength(1)
  })

  it("renames and updates one: domain, brand, default category and platform", async () => {
    const ledger = store()
    const updated = await saveMerchant(ledger, { id: PULPERIA, name: "La Esquina", domain: "laesquina.com.ni", defaultCategoryId: "groceries", isPlatform: true })
    expect(updated).toEqual({ id: PULPERIA, name: "La Esquina", domain: "laesquina.com.ni", defaultCategoryId: "groceries", isPlatform: true })
    expect(ledger.merchants.find((m) => m.id === PULPERIA)).toEqual(updated)
    // Left out: removed, except the platform flag, which stays.
    const cleared = await saveMerchant(ledger, { id: PULPERIA, name: "La Esquina" })
    expect(cleared).toEqual({ id: PULPERIA, name: "La Esquina", isPlatform: true })
  })

  it("refuses a blank name, a domain that isn't one, an unknown category or merchant", async () => {
    const ledger = store()
    await expectDomainError(() => saveMerchant(ledger, { name: "   " }), "missingName")
    await expectDomainError(() => saveMerchant(ledger, { name: "X", domain: "not a domain" }), "corruptedData")
    await expectDomainError(() => saveMerchant(ledger, { name: "X", defaultCategoryId: "nope" }), "notFound")
    await expectDomainError(() => saveMerchant(ledger, { id: crypto.randomUUID(), name: "X" }), "notFound")
  })

  it("deleting one unlinks it everywhere and leaves the rest of each record as it was", async () => {
    const ledger = store()
    const lunch: Transaction = { ...transaction({ amount: "8", category: "restaurants" }), merchantId: SUBWAY, viaMerchantId: UBER_EATS }
    const viaOnly: Transaction = { ...transaction({ amount: "3" }), merchantId: PULPERIA, viaMerchantId: UBER_EATS }
    ledger.transactions = [lunch, viaOnly]
    const rule: CategorizationRule = { id: crypto.randomUUID(), match: "Subway", categoryId: "restaurants", kind: "expense", merchantId: SUBWAY }
    ledger.categorizationRules = [rule]
    await deleteMerchant(ledger, SUBWAY)
    await deleteMerchant(ledger, UBER_EATS)
    expect(ledger.merchants.map((m) => m.id)).toEqual([PULPERIA])
    const [first, second] = [ledger.transactions.find((t) => t.id === lunch.id)!, ledger.transactions.find((t) => t.id === viaOnly.id)!]
    const { merchantId: _m, viaMerchantId: _v, ...unlinked } = lunch
    expect(first).toEqual(unlinked)
    expect(first.merchantId).toBeUndefined()
    expect(first.viaMerchantId).toBeUndefined()
    expect(first.categoryId).toBe("restaurants")
    expect(second.merchantId).toBe(PULPERIA)
    expect(second.viaMerchantId).toBeUndefined()
    expect(ledger.categorizationRules[0]).toEqual({ id: rule.id, match: "Subway", categoryId: "restaurants", kind: "expense" })
    await expectDomainError(() => deleteMerchant(ledger, SUBWAY), "notFound")
  })

  it("merging repoints movements, recurring rules and categorization rules, and fills what the target lacks", async () => {
    const ledger = store()
    const typo: Merchant = { id: crypto.randomUUID(), name: "Subwey", defaultCategoryId: "groceries", isPlatform: false }
    const bare: Merchant = { id: crypto.randomUUID(), name: "Subway Centro", isPlatform: false }
    ledger.merchants.push(typo, bare)
    const asBusiness: Transaction = { ...transaction({ amount: "8" }), merchantId: typo.id }
    const asVia: Transaction = { ...transaction({ amount: "9" }), merchantId: bare.id, viaMerchantId: typo.id }
    ledger.transactions = [asBusiness, asVia]
    const recurring = await saveRecurringRule(ledger, {
      name: "Sub del mes",
      kind: "expense",
      amount: d(10),
      currency: "USD",
      categoryId: "restaurants",
      source: { type: "card", id: IDs.savingsDebit },
      frequency: "monthly",
      interval: 1,
      startDate: new Date(Date.UTC(2030, 0, 1, 18)),
      isSubscription: false,
      autoConfirm: true,
      note: "",
      merchantId: typo.id,
    })
    ledger.categorizationRules = [{ id: crypto.randomUUID(), match: "Subwey", categoryId: "restaurants", kind: "expense", merchantId: typo.id }]

    const merged = await mergeMerchants(ledger, typo.id, bare.id)
    expect(merged).toEqual({ ...bare, defaultCategoryId: "groceries" })
    expect(ledger.merchants.some((m) => m.id === typo.id)).toBe(false)
    expect(ledger.transactions.find((t) => t.id === asBusiness.id)?.merchantId).toBe(bare.id)
    // The platform would be the business itself: dropped.
    const via = ledger.transactions.find((t) => t.id === asVia.id)!
    expect(via.merchantId).toBe(bare.id)
    expect(via.viaMerchantId).toBeUndefined()
    expect(ledger.recurringRules.find((r) => r.id === recurring.id)?.merchantId).toBe(bare.id)
    expect(ledger.categorizationRules[0]?.merchantId).toBe(bare.id)
    // Into itself: nothing happens.
    expect(await mergeMerchants(ledger, bare.id, bare.id)).toEqual(merged)
  })

  it("is all or nothing", async () => {
    const ledger = store()
    ledger.transactions = [{ ...transaction({ amount: "8" }), merchantId: SUBWAY }]
    ledger.deleteMerchant = async () => {
      throw DomainError.notFound("boom")
    }
    await expect(deleteMerchant(ledger, SUBWAY)).rejects.toThrow()
    expect(ledger.transactions[0]?.merchantId).toBe(SUBWAY)
  })

  it("after a pull, unlinks whatever still names a deleted merchant", async () => {
    const ledger = store([pulperia])
    const both: Transaction = { ...transaction({ amount: "8" }), merchantId: SUBWAY, viaMerchantId: UBER_EATS }
    const kept: Transaction = { ...transaction({ amount: "9" }), merchantId: PULPERIA }
    ledger.transactions = [both, kept]
    ledger.categorizationRules = [{ id: crypto.randomUUID(), match: "x", categoryId: "restaurants", kind: "expense", merchantId: SUBWAY }]
    expect(await unlinkDeletedMerchants(ledger, new Set())).toBe(0)
    expect(await unlinkDeletedMerchants(ledger, new Set([SUBWAY, UBER_EATS]))).toBe(2)
    const repaired = ledger.transactions.find((t) => t.id === both.id)!
    expect(repaired.merchantId).toBeUndefined()
    expect(repaired.viaMerchantId).toBeUndefined()
    expect(ledger.transactions.find((t) => t.id === kept.id)?.merchantId).toBe(PULPERIA)
    expect(ledger.categorizationRules[0]?.merchantId).toBeUndefined()
    expect(await unlinkDeletedMerchants(ledger, new Set([SUBWAY]))).toBe(0)
  })
})

describe("Movements with a merchant", () => {
  it("a new movement without a category takes its merchant's default category", async () => {
    const ledger = store()
    const saved = await saveTransaction(ledger, draft({ merchantId: SUBWAY, viaMerchantId: UBER_EATS }))
    expect(saved.transaction).toMatchObject({ categoryId: "restaurants", merchantId: SUBWAY, viaMerchantId: UBER_EATS })
    // A chosen category wins; an income doesn't take an expense category.
    const chosen = await saveTransaction(ledger, draft({ merchantId: SUBWAY, categoryId: "groceries" }))
    expect(chosen.transaction.categoryId).toBe("groceries")
    const income = await saveTransaction(ledger, draft({ kind: "income", merchantId: SUBWAY }))
    expect(income.transaction.categoryId).toBe("other-income")
    expect(merchantCategory(subway, "transfer", DEFAULT_CATEGORIES)).toBeUndefined()
  })

  it("an edit keeps the links unless the draft says otherwise; null removes one", async () => {
    const ledger = store()
    const { transaction: saved } = await saveTransaction(ledger, draft({ merchantId: SUBWAY, viaMerchantId: UBER_EATS }))
    const edit = draftFrom(saved)
    expect(edit).toMatchObject({ merchantId: SUBWAY, viaMerchantId: UBER_EATS })
    const { merchantId: _m, viaMerchantId: _v, ...unaware } = edit
    expect((await saveTransaction(ledger, { ...unaware, note: "x" })).transaction).toMatchObject({ merchantId: SUBWAY, viaMerchantId: UBER_EATS })
    const cleared = (await saveTransaction(ledger, { ...edit, viaMerchantId: null })).transaction
    expect(cleared.merchantId).toBe(SUBWAY)
    expect(cleared.viaMerchantId).toBeUndefined()
  })

  it("only links merchants that exist, and never the business as its own platform", () => {
    const merchants = [subway, uberEats]
    expect(merchantLinks({ merchantId: SUBWAY, viaMerchantId: SUBWAY }, merchants)).toEqual({ merchantId: SUBWAY })
    expect(merchantLinks({ merchantId: crypto.randomUUID(), viaMerchantId: UBER_EATS }, merchants)).toEqual({ viaMerchantId: UBER_EATS })
    expect(merchantLinks({}, merchants, { merchantId: SUBWAY })).toEqual({ merchantId: SUBWAY })
    expect(merchantLinks({ merchantId: null }, merchants, { merchantId: SUBWAY })).toEqual({})
  })

  it("Repeat carries the merchant to the rule and its occurrences", async () => {
    const ledger = store()
    const saved = await saveRepeatingTransaction(ledger, draft({ merchantId: PULPERIA, viaMerchantId: UBER_EATS, date: new Date(2026, 6, 1, 12) }), "monthly", referenceDate)
    const rule = ledger.recurringRules.find((candidate) => candidate.id === saved.transaction.recurringId)!
    expect(rule).toMatchObject({ merchantId: PULPERIA, viaMerchantId: UBER_EATS })
    const occurrences = ledger.transactions.filter((t) => t.recurringId === rule.id && t.id !== saved.transaction.id)
    expect(occurrences.length).toBeGreaterThan(0)
    for (const occurrence of occurrences) expect(occurrence).toMatchObject({ merchantId: PULPERIA, viaMerchantId: UBER_EATS })
  })
})

describe("Categorization rules with a merchant", () => {
  const rule: CategorizationRule = { id: crypto.randomUUID(), match: "Subway", categoryId: "restaurants", kind: "expense", merchantId: SUBWAY }

  it("applying it sets the merchant when the movement names none; one the person chose stays", () => {
    const movement = transaction({ amount: "8", description: "SUBWAY 123" })
    expect(applyingRule(rule, movement)).toMatchObject({ categoryId: "restaurants", merchantId: SUBWAY })
    const chosen: Transaction = { ...movement, merchantId: PULPERIA }
    expect(applyingRule(rule, chosen).merchantId).toBe(PULPERIA)
    // The rule's merchant would be the movement's own platform: the platform goes.
    const viaSubway: Transaction = { ...movement, viaMerchantId: SUBWAY }
    const applied = applyingRule(rule, viaSubway)
    expect(applied.merchantId).toBe(SUBWAY)
    expect(applied.viaMerchantId).toBeUndefined()
  })

  it("a new movement it matches gets the rule's merchant when saved", async () => {
    const ledger = store()
    ledger.categorizationRules = [rule]
    const saved = await saveTransaction(ledger, draft({ description: "Subway Metrocentro" }))
    expect(saved.transaction).toMatchObject({ categoryId: "restaurants", merchantId: SUBWAY })
    expect(saved.rule?.id).toBe(rule.id)
  })

  it("is saved with its merchant, which must exist", async () => {
    const ledger = store()
    expect(validatedRule({ id: rule.id, match: "Subway", categoryId: "restaurants", kind: "expense", merchantId: SUBWAY }, DEFAULT_CATEGORIES).merchantId).toBe(SUBWAY)
    const saved = await saveCategorizationRule(ledger, { match: "Subway", categoryId: "restaurants", kind: "expense", merchantId: SUBWAY })
    expect(ledger.categorizationRules.find((r) => r.id === saved.id)?.merchantId).toBe(SUBWAY)
    await expectDomainError(() => saveCategorizationRule(ledger, { match: "x", categoryId: "restaurants", kind: "expense", merchantId: crypto.randomUUID() }), "notFound")
  })
})

it("sample data still loads without merchants", () => {
  expect(new InMemoryStore("America/Managua", sampleData()).merchants).toEqual([])
})
