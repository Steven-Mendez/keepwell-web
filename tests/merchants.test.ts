// Merchants on screen: where a movement's logo comes from, the brand table's suggestions, Brandfetch's
// brand search, how a movement reads, and the movement editor's "Business" and "Via" fields.
import { describe, expect, it, vi } from "vitest"

import {
  categoryAfterBusiness,
  initialMerchantFields,
  merchantDraftLinks,
  merchantOptions,
  needsBrandSearch,
  resolveChoice,
  suggestedBusiness,
} from "@/components/movement-editor/merchant-state"
import { choiceKey } from "@/components/movement-editor/merchant-field"
import { InMemoryStore } from "@/lib/domain"
import { makeTranslator } from "@/lib/i18n"
import { brandSearchURL, parseBrandSearch, searchBrands } from "@/lib/presentation/brand-search"
import { BRANDS } from "@/lib/presentation/brands"
import { TransactionDisplay } from "@/lib/presentation/display"
import {
  brandSuggestions,
  choiceLogo,
  merchantLogo,
  movementLogo,
  suggestedMerchant,
} from "@/lib/presentation/merchants"
import { DEFAULT_CATEGORIES, type CategorizationRule, type Merchant, type Transaction } from "@/lib/schema"

const SUBWAY = "66666666-6666-4666-8666-666666666666"
const UBER_EATS = "77777777-7777-4777-8777-777777777777"
const PULPERIA = "88888888-8888-4888-8888-888888888888"

const subway: Merchant = { id: SUBWAY, name: "Subway Metrocentro", brandId: "subway", defaultCategoryId: "restaurants", isPlatform: false }
const uberEats: Merchant = { id: UBER_EATS, name: "Uber Eats", domain: "ubereats.com", isPlatform: true }
const pulperia: Merchant = { id: PULPERIA, name: "Pulpería La Esquina", isPlatform: false }
const merchants = [subway, uberEats, pulperia]

const movement = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "44444444-4444-4444-8444-444444444444",
  date: "2026-11-01T18:00:00.000Z",
  status: "confirmed",
  description: "Almuerzo",
  kind: "expense",
  categoryId: "restaurants",
  amount: "8",
  currency: "USD",
  accountId: "11111111-1111-4111-8111-111111111111",
  exchangeRate: { principal: "USD", second: "USD", rate: "1" },
  isShared: false,
  ...overrides,
})

describe("logo resolution", () => {
  it("takes the merchant's domain first, then its brand, then the description", () => {
    const subwayBrand = BRANDS.find((brand) => brand.id === "subway")!
    expect(movementLogo(movement({ merchantId: UBER_EATS, description: "Netflix" }), merchants)).toEqual({ name: "Uber Eats", domain: "ubereats.com" })
    expect(movementLogo(movement({ merchantId: SUBWAY, description: "Netflix" }), merchants)).toEqual({ name: "Subway Metrocentro", domain: subwayBrand.domain })
    // A merchant without a logo, or one that no longer exists, falls back to the description's brand.
    expect(movementLogo(movement({ merchantId: PULPERIA, description: "Netflix" }), merchants)?.domain).toBe("netflix.com")
    expect(movementLogo(movement({ merchantId: crypto.randomUUID(), description: "Netflix" }), new Map())?.domain).toBe("netflix.com")
    expect(movementLogo(movement({ merchantId: PULPERIA }), merchants)).toBeUndefined()
    expect(merchantLogo(pulperia)).toBeUndefined()
  })
})

describe("brand table suggestions", () => {
  it("offers brands by the start of a word, leaving out the ones the person already has", () => {
    expect(brandSuggestions("netf", []).map((brand) => brand.id)).toContain("netflix")
    expect(brandSuggestions("subw", merchants).map((brand) => brand.id)).not.toContain("subway")
    expect(brandSuggestions("", [])).toEqual([])
    expect(brandSuggestions("e", [], 3)).toHaveLength(3)
  })

  it("prefills from the description: the person's merchant of that brand, else the brand to create", () => {
    expect(suggestedMerchant("SUBWAY 0042 MANAGUA", merchants)).toEqual({ type: "merchant", id: SUBWAY })
    expect(suggestedMerchant("Netflix", merchants)).toEqual({ type: "new", draft: { name: "Netflix", domain: "netflix.com", brandId: "netflix" } })
    expect(suggestedMerchant("Almuerzo", merchants)).toBeUndefined()
    expect(choiceLogo({ type: "new", draft: { name: "Netflix", brandId: "netflix" } }, [])).toEqual({ name: "Netflix", domain: "netflix.com" })
  })
})

describe("Brandfetch brand search", () => {
  it("builds the search URL with the public client id", () => {
    expect(brandSearchURL(" pollo campero ", "abc")).toBe("https://api.brandfetch.io/v2/search/pollo%20campero?c=abc")
  })

  it("keeps a name and a valid domain per result, once per domain, without trademark signs", () => {
    const body = [
      { brandId: "a", name: "Subway®", domain: "subway.com", icon: "x" },
      { name: "Subway again", domain: "SUBWAY.com" },
      { name: "No domain" },
      { name: "", domain: "empty.com" },
      { name: "Bad", domain: "not a domain" },
      { name: "Subway Australia", domain: "subway.com.au" },
    ]
    expect(parseBrandSearch(body)).toEqual([
      { name: "Subway", domain: "subway.com" },
      { name: "Subway Australia", domain: "subway.com.au" },
    ])
    expect(parseBrandSearch({ error: "nope" })).toEqual([])
  })

  it("asks only when on, with a client id and a long enough query, and fails quietly", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([{ name: "Subway", domain: "subway.com" }]), { status: 200 }))
    const on = { enabled: true, clientId: "abc" }
    expect(await searchBrands("subway", undefined, on, fetcher)).toEqual([{ name: "Subway", domain: "subway.com" }])
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(String((fetcher.mock.calls[0] as unknown[])[0])).toBe("https://api.brandfetch.io/v2/search/subway?c=abc")
    expect(await searchBrands("s", undefined, on, fetcher)).toEqual([])
    expect(await searchBrands("subway", undefined, { enabled: false, clientId: "abc" }, fetcher)).toEqual([])
    expect(await searchBrands("subway", undefined, { enabled: true, clientId: undefined }, fetcher)).toEqual([])
    expect(fetcher).toHaveBeenCalledTimes(1)
    const failing = vi.fn(async () => new Response("", { status: 500 }))
    expect(await searchBrands("subway", undefined, on, failing)).toEqual([])
    const offline = vi.fn(async () => {
      throw new TypeError("offline")
    })
    expect(await searchBrands("subway", undefined, on, offline)).toEqual([])
  })
})

describe("how a movement reads", () => {
  it("names its business and the platform it went through", () => {
    const en = new TransactionDisplay(makeTranslator("en"), { accounts: [], cards: [], categories: DEFAULT_CATEGORIES, merchants })
    const es = new TransactionDisplay(makeTranslator("es"), { accounts: [], cards: [], categories: DEFAULT_CATEGORIES, merchants })
    expect(en.merchantLine(movement({ merchantId: PULPERIA, viaMerchantId: UBER_EATS }))).toBe("Pulpería La Esquina · via Uber Eats")
    expect(es.merchantLine(movement({ merchantId: PULPERIA, viaMerchantId: UBER_EATS }))).toBe("Pulpería La Esquina · vía Uber Eats")
    expect(en.merchantLine(movement({ viaMerchantId: UBER_EATS }))).toBe("via Uber Eats")
    expect(en.merchantLine(movement())).toBeUndefined()
    expect(en.merchantLine(movement({ merchantId: crypto.randomUUID() }))).toBeUndefined()
    expect(en.searchableText(movement({ merchantId: PULPERIA }))).toContain("Pulpería")
  })
})

describe("the editor's Business and Via fields", () => {
  const rule: CategorizationRule = { id: crypto.randomUUID(), match: "almuerzo", categoryId: "restaurants", kind: "expense", merchantId: PULPERIA }

  it("opens with an edit's links (chosen), empty for a new movement", () => {
    expect(initialMerchantFields(movement({ merchantId: SUBWAY, viaMerchantId: UBER_EATS }))).toEqual({
      merchant: { type: "merchant", id: SUBWAY },
      via: { type: "merchant", id: UBER_EATS },
      touched: true,
      suggestedCategory: undefined,
    })
    expect(initialMerchantFields(undefined)).toEqual({ merchant: undefined, via: undefined, touched: false, suggestedCategory: undefined })
  })

  it("suggests the business from a matching rule first, then from the description; never over the person's choice", () => {
    const fresh = initialMerchantFields(undefined)
    expect(suggestedBusiness(fresh, { description: "Almuerzo", note: "" }, "expense", merchants, [rule])).toEqual({ type: "merchant", id: PULPERIA })
    expect(suggestedBusiness(fresh, { description: "Subway", note: "" }, "expense", merchants, [rule])).toEqual({ type: "merchant", id: SUBWAY })
    expect(suggestedBusiness(fresh, { description: "Taxi", note: "" }, "expense", merchants, [])).toBeUndefined()
    const cleared = { ...fresh, touched: true }
    expect(suggestedBusiness(cleared, { description: "Subway", note: "" }, "expense", merchants, [])).toBeUndefined()
  })

  it("suggests the business's default category until the person picks one, and takes it back", () => {
    const options = { mayChoose: true, kind: "expense" as const, merchants, categories: DEFAULT_CATEGORIES }
    const picked = categoryAfterBusiness({ categoryId: undefined, suggestedCategory: undefined }, { type: "merchant", id: SUBWAY }, options)
    expect(picked).toEqual({ categoryId: "restaurants", suggestedCategory: "restaurants" })
    // Another business without a default: the suggestion goes.
    expect(categoryAfterBusiness(picked, { type: "merchant", id: PULPERIA }, options)).toEqual({ categoryId: undefined, suggestedCategory: undefined })
    // A category already there stays.
    expect(categoryAfterBusiness({ categoryId: "groceries", suggestedCategory: undefined }, { type: "merchant", id: SUBWAY }, options)).toEqual({ categoryId: "groceries", suggestedCategory: undefined })
    // Picked by the person (or a rule): nothing changes.
    expect(categoryAfterBusiness({ categoryId: undefined, suggestedCategory: undefined }, { type: "merchant", id: SUBWAY }, { ...options, mayChoose: false }).categoryId).toBeUndefined()
    // An income doesn't take an expense category.
    expect(categoryAfterBusiness({ categoryId: undefined, suggestedCategory: undefined }, { type: "merchant", id: SUBWAY }, { ...options, kind: "income" }).categoryId).toBeUndefined()
  })

  it("lists the person's merchants, then the table's brands, then Brandfetch's, then adding it by hand", () => {
    const options = merchantOptions("sub", merchants, [{ name: "Subway Surfers", domain: "subwaysurfers.com" }])
    const order = ["mine", "brands", "web", "new"]
    const groups = options.map((option) => order.indexOf(option.group))
    expect(groups).toEqual([...groups].sort((a, b) => a - b))
    expect(options.filter((option) => option.group === "brands").map((option) => option.key)).not.toContain("b:subway")
    expect(options.some((option) => option.group === "web" && option.detail === "subwaysurfers.com")).toBe(true)
    expect(options[0]!.choice).toEqual({ type: "merchant", id: SUBWAY })
    expect(options.at(-1)!.choice).toEqual({ type: "new", draft: { name: "sub" } })
    const brands = merchantOptions("netfl", [], [{ name: "Netflix", domain: "netflix.com" }])
    // Brandfetch's result for a domain the table already offers isn't repeated.
    expect(brands.map((option) => option.group)).toEqual(["brands", "new"])
    expect(brands[0]!.choice).toEqual({ type: "new", draft: { name: "Netflix", domain: "netflix.com", brandId: "netflix" } })
    // No "add" line for a name the person already has.
    expect(merchantOptions("uber eats", merchants, []).some((option) => option.group === "new")).toBe(false)
    expect(merchantOptions("", merchants, []).every((option) => option.group === "mine")).toBe(true)
  })

  it("offers platforms first in Via, and a merchant created there is a platform", () => {
    const options = merchantOptions("", merchants, [], "via", SUBWAY)
    expect(options.map((option) => option.label)).toEqual(["Uber Eats", "Pulpería La Esquina"])
    const added = merchantOptions("Rappi", [], [], "via")
    expect(added.at(-1)!.choice).toEqual({ type: "new", draft: { name: "Rappi", isPlatform: true } })
  })

  it("searches Brandfetch only when nothing of the person's or the table matches", () => {
    expect(needsBrandSearch("pollo campero", merchantOptions("pollo campero", merchants, []))).toBe(true)
    expect(needsBrandSearch("sub", merchantOptions("sub", merchants, []))).toBe(false)
    expect(needsBrandSearch("netf", merchantOptions("netf", [], []))).toBe(false)
    expect(needsBrandSearch("p", merchantOptions("p", [], []))).toBe(false)
  })

  it("creates a new choice's merchant when saving, once, and sends null for an empty field", async () => {
    const store = new InMemoryStore("America/Managua", { merchants: [...merchants] })
    const netflix = { type: "new" as const, draft: { name: "Netflix", domain: "netflix.com", brandId: "netflix" } }
    const id = await resolveChoice(store, netflix)
    expect(store.merchants.find((merchant) => merchant.id === id)).toMatchObject({ name: "Netflix", brandId: "netflix" })
    expect(await resolveChoice(store, netflix)).toBe(id)
    expect(await merchantDraftLinks(store, { merchant: { type: "merchant", id: SUBWAY }, via: undefined }, "expense")).toEqual({ merchantId: SUBWAY, viaMerchantId: null })
    expect(await merchantDraftLinks(store, { merchant: { type: "merchant", id: SUBWAY }, via: { type: "merchant", id: SUBWAY } }, "expense")).toEqual({ merchantId: SUBWAY, viaMerchantId: null })
    expect(await merchantDraftLinks(store, { merchant: undefined, via: undefined }, "transfer")).toEqual({})
  })

  it("gives each choice a key, so a suggestion made elsewhere shows in the field", () => {
    expect(choiceKey(undefined)).toBe("none")
    expect(choiceKey({ type: "merchant", id: SUBWAY })).not.toBe(choiceKey({ type: "merchant", id: PULPERIA }))
    expect(choiceKey({ type: "new", draft: { name: "Netflix", brandId: "netflix" } })).not.toBe(choiceKey({ type: "new", draft: { name: "Netflix" } }))
  })
})
