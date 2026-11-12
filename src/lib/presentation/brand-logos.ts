// Brand logos come from Brandfetch's Logo API, linked live from an <img>: its terms forbid fetching
// them from code, storing them or serving them ourselves, so nothing here downloads an image. This is
// the one third party the app calls from the client; Brandfetch sees the device's IP address and
// the domain of each brand shown, never a description, a rule's name or anything else typed.

/** Off switch: `false` makes no request to Brandfetch at all, and rows keep their monograms. */
export const BRAND_LOGOS_ENABLED = true

/**
 * Brandfetch's client id. Public by design (it travels in every logo URL); not the account's API
 * key, which is secret and unused. Without it the logos stay off, as with the switch.
 */
export const BRANDFETCH_CLIENT_ID = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID?.trim() || undefined

export const BRANDFETCH_HOST = "cdn.brandfetch.io"

/** Distinct domains in a row that may fail before the logos stop for the session. */
export const BRAND_LOGO_FAILURE_LIMIT = 3

/** Square icon, 128 px (the 40 px badge at 3×), and a 404 for an unknown brand instead of a blank image. */
export function brandLogoURL(domain: string, theme: "light" | "dark", clientId: string): string {
  return `https://${BRANDFETCH_HOST}/domain/${encodeURIComponent(domain)}/w/128/h/128/theme/${theme}/fallback/404/type/icon?c=${encodeURIComponent(clientId)}`
}

export type BrandLogoConfig = { enabled: boolean; clientId: string | undefined }

const DEFAULT_CONFIG: BrandLogoConfig = { enabled: BRAND_LOGOS_ENABLED, clientId: BRANDFETCH_CLIENT_ID }

/**
 * What one <img> told us. An image that loads with a size is the logo. Anything else is a failure:
 * a 404, no network, a timeout, or one of Brandfetch's refusals, which answer with a 302 to its
 * guidelines page (an HTML page, so the <img> fails to decode it).
 */
export type BrandLogoEvent = { type: "load"; naturalWidth: number } | { type: "error" }

export function brandLogoLoaded(event: BrandLogoEvent): boolean {
  return event.type === "load" && event.naturalWidth > 0
}

/**
 * The page's memory of Brandfetch for this session (nothing is stored): a domain that failed is not
 * asked again, and after a few failures of different domains in a row the logos stop altogether.
 * Failures while the browser is offline are not remembered, so the logos come back with the network.
 */
export class BrandLogoSession {
  private readonly failed = new Set<string>()
  private readonly loaded = new Set<string>()
  private failuresInARow = 0

  constructor(private readonly config: BrandLogoConfig = DEFAULT_CONFIG) {}

  /** The logo's URL, or `undefined` when nothing may be requested for this domain. */
  logoURL(domain: string, theme: "light" | "dark"): string | undefined {
    const { enabled, clientId } = this.config
    if (!enabled || !clientId) return undefined
    // A logo already shown stays, even after the session stops asking for new ones.
    if (!this.loaded.has(domain) && (this.stopped || this.failed.has(domain))) return undefined
    return brandLogoURL(domain, theme, clientId)
  }

  get stopped(): boolean {
    return this.failuresInARow >= BRAND_LOGO_FAILURE_LIMIT
  }

  /** Records how a logo request ended; returns whether the logo should show. */
  record(domain: string, event: BrandLogoEvent, online = true): boolean {
    if (brandLogoLoaded(event)) {
      this.failuresInARow = 0
      this.loaded.add(domain)
      return true
    }
    if (online && !this.failed.has(domain)) {
      this.failed.add(domain)
      this.failuresInARow += 1
    }
    return false
  }
}

/** The one session the screens share, so a failure in one row spares the others the request. */
export const brandLogoSession = new BrandLogoSession()
