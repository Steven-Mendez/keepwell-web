import {
  createMerchant,
  firstMatchingRule,
  merchantCategory,
  searchMerchants,
  viaChoices,
  type LedgerStore,
} from "@/lib/domain"
import { folded } from "@/lib/domain/rules"
import type { BrandSearchResult } from "@/lib/presentation/brand-search"
import { brandSearchQuery } from "@/lib/presentation/brand-search"
import {
  brandSuggestions,
  choiceLogo,
  merchantDraftFromBrand,
  merchantLogo,
  suggestedMerchant,
  type LogoSubject,
  type MerchantChoice,
} from "@/lib/presentation/merchants"
import type { CategorizationRule, Merchant, Transaction, TransactionCategory, TransactionKind } from "@/lib/schema"

// The movement editor's "Business" and "Via" fields, kept free of React like editor-state.ts.

/** What the two fields hold, and whether the person chose the business (no suggestion replaces it then). */
export interface MerchantFields {
  merchant: MerchantChoice | undefined
  via: MerchantChoice | undefined
  /** The person picked or cleared the business; an edit starts so. */
  touched: boolean
  /** The category the business suggested, so another suggestion (or none) can take it back. */
  suggestedCategory: string | undefined
}

/** The fields an editor opens with: an edit's own links, nothing for a new movement. */
export function initialMerchantFields(existing: Pick<Transaction, "merchantId" | "viaMerchantId"> | undefined): MerchantFields {
  return {
    merchant: existing?.merchantId ? { type: "merchant", id: existing.merchantId } : undefined,
    via: existing?.viaMerchantId ? { type: "merchant", id: existing.viaMerchantId } : undefined,
    touched: existing !== undefined,
    suggestedCategory: undefined,
  }
}

/**
 * The business the typed text suggests while the person hasn't chosen one: a matching rule's merchant
 * first, else the person's merchant (or the table's brand) the description names. Only a suggestion:
 * once the person picks or clears the field it stays as they left it.
 */
export function suggestedBusiness(
  state: MerchantFields,
  text: { description: string; note: string },
  kind: TransactionKind,
  merchants: readonly Merchant[],
  rules: readonly CategorizationRule[]
): MerchantChoice | undefined {
  if (state.touched) return state.merchant
  const rule = kind === "transfer" ? undefined : firstMatchingRule(rules, kind, text.description, text.note)
  const ruleMerchant = rule?.merchantId
  if (ruleMerchant !== undefined && merchants.some((merchant) => merchant.id === ruleMerchant)) return { type: "merchant", id: ruleMerchant }
  return suggestedMerchant(text.description, merchants)
}

/**
 * The category after the business changed: the business's default when the person hasn't picked a
 * category (and no rule chose one), back to none when the category was the previous business's
 * suggestion, otherwise as it was.
 */
export function categoryAfterBusiness(
  current: { categoryId: string | undefined; suggestedCategory: string | undefined },
  choice: MerchantChoice | undefined,
  options: { mayChoose: boolean; kind: TransactionKind; merchants: readonly Merchant[]; categories: readonly TransactionCategory[] }
): { categoryId: string | undefined; suggestedCategory: string | undefined } {
  const ownedBySuggestion = current.suggestedCategory !== undefined && current.categoryId === current.suggestedCategory
  if (!options.mayChoose) return { categoryId: current.categoryId, suggestedCategory: ownedBySuggestion ? current.suggestedCategory : undefined }
  const merchant = choice?.type === "merchant" ? options.merchants.find((candidate) => candidate.id === choice.id) : undefined
  const suggested = merchantCategory(merchant, options.kind, options.categories)
  if (suggested !== undefined && (current.categoryId === undefined || ownedBySuggestion)) return { categoryId: suggested, suggestedCategory: suggested }
  if (ownedBySuggestion) return { categoryId: undefined, suggestedCategory: undefined }
  return { categoryId: current.categoryId, suggestedCategory: undefined }
}

/** One line of the field's list. */
export interface MerchantOption {
  key: string
  label: string
  /** "Your businesses", "Suggestions", "From the web", or creating one by hand. */
  group: "mine" | "brands" | "web" | "new"
  /** The domain a found brand comes with. */
  detail?: string
  choice: MerchantChoice
  logo?: LogoSubject | undefined
}

const MAX_MINE = 6
const MAX_BRANDS = 4

/**
 * What the field offers for the typed text: the person's merchants (platforms first for "via"), then
 * the table's brands they don't have yet, then Brandfetch's results (`remote`) for domains not offered
 * already, then creating it by hand when no merchant has that name. A merchant created from "via" is
 * a platform.
 */
export function merchantOptions(
  query: string,
  merchants: readonly Merchant[],
  remote: readonly BrandSearchResult[],
  role: "business" | "via" = "business",
  excludeId?: string
): MerchantOption[] {
  const platform = role === "via" ? { isPlatform: true } : {}
  const mine = (role === "via" ? viaChoices(merchants, query, excludeId) : searchMerchants(merchants, query).filter((merchant) => merchant.id !== excludeId)).slice(0, MAX_MINE)
  const options: MerchantOption[] = mine.map((merchant) => ({
    key: `m:${merchant.id}`,
    label: merchant.name,
    group: "mine",
    choice: { type: "merchant", id: merchant.id },
    logo: merchantLogo(merchant),
  }))
  const text = query.trim()
  if (text === "") return options
  const offered = new Set(merchants.map((merchant) => merchant.domain).filter((domain) => domain !== undefined))
  for (const brand of brandSuggestions(text, merchants, MAX_BRANDS)) {
    offered.add(brand.domain)
    const choice: MerchantChoice = { type: "new", draft: { ...merchantDraftFromBrand(brand), ...platform } }
    options.push({ key: `b:${brand.id}`, label: brand.name, group: "brands", choice, logo: choiceLogo(choice, merchants) })
  }
  for (const result of remote) {
    if (offered.has(result.domain)) continue
    offered.add(result.domain)
    const choice: MerchantChoice = { type: "new", draft: { name: result.name, domain: result.domain, ...platform } }
    options.push({ key: `w:${result.domain}`, label: result.name, group: "web", detail: result.domain, choice, logo: { name: result.name, domain: result.domain } })
  }
  const name = text.replace(/\s+/g, " ")
  if (!merchants.some((merchant) => folded(merchant.name) === folded(name))) {
    options.push({ key: `n:${name}`, label: name, group: "new", choice: { type: "new", draft: { name, ...platform } } })
  }
  return options
}

/** Brandfetch is asked only for a query long enough that matches none of the person's merchants or the table's brands. */
export function needsBrandSearch(query: string, local: readonly MerchantOption[]): boolean {
  return brandSearchQuery(query) !== undefined && !local.some((option) => option.group === "mine" || option.group === "brands")
}

/** The merchant id a choice saves with, creating the merchant it names when it is new. */
export async function resolveChoice(store: LedgerStore, choice: MerchantChoice | undefined): Promise<string | undefined> {
  if (!choice) return undefined
  if (choice.type === "merchant") return choice.id
  return (await createMerchant(store, choice.draft)).id
}

/**
 * The links a movement saves: the business and the platform, `null` for an empty field so clearing
 * one unlinks it. A transfer names neither and keeps what it had.
 */
export async function merchantDraftLinks(
  store: LedgerStore,
  state: Pick<MerchantFields, "merchant" | "via">,
  kind: TransactionKind
): Promise<{ merchantId?: string | null; viaMerchantId?: string | null }> {
  if (kind === "transfer") return {}
  const merchantId = await resolveChoice(store, state.merchant)
  const viaMerchantId = await resolveChoice(store, state.via)
  return { merchantId: merchantId ?? null, viaMerchantId: viaMerchantId === merchantId ? null : (viaMerchantId ?? null) }
}
