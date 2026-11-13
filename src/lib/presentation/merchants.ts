import { normalizedDomain, type MerchantDraft } from "@/lib/domain/merchants"
import type { Merchant, Transaction } from "@/lib/schema"

import { BRANDS, brandFor, normalizeBrandText, type Brand } from "./brands"

/**
 * What a logo badge needs: the name its monogram comes from and the domain its logo is asked for.
 * Only a domain ever leaves the device: one from the app's brand table, or one a merchant was saved
 * with (from the brand table or Brandfetch's own search), never a description.
 */
export type LogoSubject = { name: string; domain: string }

export function brandById(id: string | undefined, brands: readonly Brand[] = BRANDS): Brand | undefined {
  return id === undefined ? undefined : brands.find((brand) => brand.id === id)
}

/** A merchant's logo: its own domain, else its brand's. `undefined` for a business without either. */
export function merchantLogo(merchant: Merchant, brands: readonly Brand[] = BRANDS): LogoSubject | undefined {
  if (merchant.domain) return { name: merchant.name, domain: merchant.domain }
  const brand = brandById(merchant.brandId, brands)
  return brand ? { name: merchant.name, domain: brand.domain } : undefined
}

/**
 * The logo a movement (or rule) shows: its merchant's first (domain, then brand), then the brand its
 * description names (`brandFor`), else none.
 */
export function movementLogo(
  movement: Pick<Transaction, "description" | "merchantId">,
  merchants: ReadonlyMap<string, Merchant> | readonly Merchant[],
  brands: readonly Brand[] = BRANDS
): LogoSubject | undefined {
  const merchant = movement.merchantId === undefined ? undefined : merchantIn(merchants, movement.merchantId)
  const own = merchant ? merchantLogo(merchant, brands) : undefined
  if (own) return own
  const brand = brandFor(movement.description, brands)
  return brand ? { name: brand.name, domain: brand.domain } : undefined
}

function merchantIn(merchants: ReadonlyMap<string, Merchant> | readonly Merchant[], id: string): Merchant | undefined {
  return "get" in merchants ? merchants.get(id) : merchants.find((merchant) => merchant.id === id)
}

/** The merchant to create when the person picks a brand of the table. */
export function merchantDraftFromBrand(brand: Brand): Omit<MerchantDraft, "id"> {
  return { name: brand.name, domain: brand.domain, brandId: brand.id }
}

/**
 * Brands of the table whose name or an alias starts a word with the query, the ones the person
 * already has as a merchant left out; names that start with it first. At most `limit`.
 */
export function brandSuggestions(query: string, merchants: readonly Merchant[], limit = 5, brands: readonly Brand[] = BRANDS): Brand[] {
  const needle = normalizeBrandText(query)
  if (needle === "") return []
  const taken = new Set(merchants.map((merchant) => merchant.brandId).filter((id) => id !== undefined))
  const startsWord = (text: string) => ` ${text}`.includes(` ${needle}`)
  const scored = brands
    .filter((brand) => !taken.has(brand.id))
    .map((brand) => {
      const name = normalizeBrandText(brand.name)
      const rank = name.startsWith(needle) ? 0 : startsWord(name) || brand.aliases.some(startsWord) || brand.exactAliases.includes(needle) ? 1 : -1
      return { brand, rank }
    })
    .filter(({ rank }) => rank >= 0)
  return scored.sort((a, b) => a.rank - b.rank).slice(0, limit).map(({ brand }) => brand)
}

/** What the "Business" field holds: a saved merchant, or one to create when the movement is saved. */
export type MerchantChoice = { type: "merchant"; id: string } | { type: "new"; draft: Omit<MerchantDraft, "id"> }

/** The merchant's name, or the one to create. */
export function choiceName(choice: MerchantChoice | undefined, merchants: readonly Merchant[]): string | undefined {
  if (!choice) return undefined
  if (choice.type === "new") return choice.draft.name
  return merchants.find((merchant) => merchant.id === choice.id)?.name
}

/** Two choices name the same merchant (or the same one to create). */
export function sameChoice(a: MerchantChoice | undefined, b: MerchantChoice | undefined): boolean {
  if (!a || !b) return a === b
  if (a.type === "merchant" && b.type === "merchant") return a.id === b.id
  if (a.type === "new" && b.type === "new") return a.draft.name === b.draft.name && a.draft.domain === b.draft.domain && a.draft.brandId === b.draft.brandId
  return false
}

/**
 * The business a new movement's description suggests: the person's merchant from the brand it names
 * (or with that name), else that brand as a merchant to create. `undefined` when it names no brand.
 */
export function suggestedMerchant(description: string, merchants: readonly Merchant[], brands: readonly Brand[] = BRANDS): MerchantChoice | undefined {
  const brand = brandFor(description, brands)
  if (!brand) return undefined
  const name = normalizeBrandText(brand.name)
  const existing = merchants.find((merchant) => merchant.brandId === brand.id) ?? merchants.find((merchant) => normalizeBrandText(merchant.name) === name)
  return existing ? { type: "merchant", id: existing.id } : { type: "new", draft: merchantDraftFromBrand(brand) }
}

/** A choice's logo, for a merchant to create too. */
export function choiceLogo(choice: MerchantChoice | undefined, merchants: readonly Merchant[], brands: readonly Brand[] = BRANDS): LogoSubject | undefined {
  if (!choice) return undefined
  if (choice.type === "merchant") {
    const merchant = merchants.find((candidate) => candidate.id === choice.id)
    return merchant ? merchantLogo(merchant, brands) : undefined
  }
  const domain = normalizedDomain(choice.draft.domain) ?? brandById(choice.draft.brandId, brands)?.domain
  return domain ? { name: choice.draft.name, domain } : undefined
}
