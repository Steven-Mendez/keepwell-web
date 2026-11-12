import table from "./brands/brands.json"

/**
 * A merchant or service Keepwell knows, so its row can show the brand's logo. The table
 * (`brands/brands.json`) ships with the app and is the same file in keepwell-ios
 * (`SharedPresentation/Resources/brands.json`); `tests/brands.test.ts` fails when they diverge.
 * Only `domain` ever leaves the device, and only for a brand of this table.
 */
export type Brand = {
  id: string
  name: string
  domain: string
  /** Normalized word sequences that name the brand anywhere in a text. */
  aliases: string[]
  /** Normalized words too short or too common to match unless they are the whole text ("max"). */
  exactAliases: string[]
}

export const BRANDS: readonly Brand[] = table.brands

/** A single-word alias this short only matches the whole text, even when the table doesn't say so. */
const SHORT_ALIAS_LENGTH = 4

/**
 * Lowercase, accents and other marks removed, anything but letters and digits as a space, and
 * spaces collapsed: "SPOTIFY  Premium" and "spotify premium" read the same, as do "Palí" and "Pali".
 * The Swift port (`BrandCatalog.normalize`) works on the same Unicode categories.
 */
export function normalizeBrandText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

/**
 * The brand a rule's name or a movement's description names, or `undefined`. Aliases match whole
 * words, never part of one ("max" is not in "Maxi Palí"); when several match, the longest alias
 * wins ("Uber Eats" over "Uber"), then the table's order; a short or common one-word alias only
 * matches the entire text.
 */
export function brandFor(text: string, brands: readonly Brand[] = BRANDS): Brand | undefined {
  const normalized = normalizeBrandText(text)
  if (!normalized) return undefined
  const words = normalized.split(" ")
  let best: { brand: Brand; words: number; length: number } | undefined
  for (const brand of brands) {
    for (const alias of [...brand.aliases, ...brand.exactAliases]) {
      const aliasWords = alias.split(" ")
      const wholeTextOnly =
        brand.exactAliases.includes(alias) || (aliasWords.length === 1 && alias.length < SHORT_ALIAS_LENGTH)
      const matches = wholeTextOnly ? alias === normalized : containsRun(words, aliasWords)
      if (!matches) continue
      if (!best || aliasWords.length > best.words || (aliasWords.length === best.words && alias.length > best.length)) {
        best = { brand, words: aliasWords.length, length: alias.length }
      }
    }
  }
  return best?.brand
}

/** Whether `run` appears in `words` as consecutive whole words. */
function containsRun(words: readonly string[], run: readonly string[]): boolean {
  for (let start = 0; start + run.length <= words.length; start++) {
    if (run.every((word, offset) => words[start + offset] === word)) return true
  }
  return false
}

/** The brand's first letter or digit, as its badge shows it before (or instead of) the logo. */
export function brandMonogram(brand: Pick<Brand, "name">): string {
  const first = [...brand.name].find((character) => /[\p{L}\p{N}]/u.test(character))
  return (first ?? "·").toUpperCase()
}
