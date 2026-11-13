import { normalizedDomain } from "@/lib/domain/merchants"

import { BRAND_LOGOS_ENABLED, BRANDFETCH_CLIENT_ID, type BrandLogoConfig } from "./brand-logos"

// Brandfetch's Brand Search API, called straight from the browser with the same public client id as
// the logos, only while the person types in the "Business" field and nothing of their own matches.
// Brandfetch sees the device's IP address and that text, never a description, a note or an amount.
// No proxy and no cache of ours: the browser's own HTTP cache is all there is.

export const BRAND_SEARCH_HOST = "api.brandfetch.io"

/** Shorter queries match half the internet; the field waits for more. */
export const BRAND_SEARCH_MIN_LENGTH = 2
/** How long typing must pause before the request goes out. */
export const BRAND_SEARCH_DEBOUNCE_MS = 350
export const BRAND_SEARCH_LIMIT = 5

export type BrandSearchResult = { name: string; domain: string }

export function brandSearchURL(query: string, clientId: string): string {
  return `https://${BRAND_SEARCH_HOST}/v2/search/${encodeURIComponent(query.trim())}?c=${encodeURIComponent(clientId)}`
}

/** The query as sent, or `undefined` when it is too short to send. */
export function brandSearchQuery(text: string): string | undefined {
  const query = text.trim().replace(/\s+/g, " ")
  return [...query].length >= BRAND_SEARCH_MIN_LENGTH ? query : undefined
}

/**
 * The results worth offering: a name and a valid domain each, trademark signs dropped ("Subway®"),
 * one per domain, in Brandfetch's order, at most `BRAND_SEARCH_LIMIT`. Anything else is ignored.
 */
export function parseBrandSearch(body: unknown): BrandSearchResult[] {
  if (!Array.isArray(body)) return []
  const seen = new Set<string>()
  const results: BrandSearchResult[] = []
  for (const entry of body) {
    if (typeof entry !== "object" || entry === null) continue
    const { name, domain } = entry as { name?: unknown; domain?: unknown }
    if (typeof name !== "string" || typeof domain !== "string") continue
    const cleanName = name.replace(/[®™©℠]/g, "").replace(/\s+/g, " ").trim()
    const cleanDomain = normalizedDomain(domain)
    if (cleanName === "" || cleanDomain === undefined || seen.has(cleanDomain)) continue
    seen.add(cleanDomain)
    results.push({ name: cleanName, domain: cleanDomain })
    if (results.length === BRAND_SEARCH_LIMIT) break
  }
  return results
}

const DEFAULT_CONFIG: BrandLogoConfig = { enabled: BRAND_LOGOS_ENABLED, clientId: BRANDFETCH_CLIENT_ID }

/**
 * Brands Brandfetch knows by that name. Empty when the logos are off, without a client id, for a
 * short query or when the request fails: the field still offers creating the business by hand.
 */
export async function searchBrands(
  text: string,
  signal?: AbortSignal,
  config: BrandLogoConfig = DEFAULT_CONFIG,
  fetcher: typeof fetch = fetch
): Promise<BrandSearchResult[]> {
  const query = brandSearchQuery(text)
  if (!config.enabled || !config.clientId || query === undefined) return []
  try {
    const response = await fetcher(brandSearchURL(query, config.clientId), {
      ...(signal ? { signal } : {}),
      credentials: "omit",
      referrerPolicy: "strict-origin-when-cross-origin",
    })
    if (!response.ok) return []
    return parseBrandSearch(await response.json())
  } catch {
    return []
  }
}
