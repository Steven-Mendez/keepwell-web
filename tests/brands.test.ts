// Brand logos (T16): the brand table and its matching rules, shared with keepwell-ios, and the
// Brandfetch chain the rows follow (logo, or the monogram when anything goes wrong).
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  BRAND_LOGO_FAILURE_LIMIT,
  BrandLogoSession,
  brandLogoURL,
  type BrandLogoEvent,
} from "@/lib/presentation/brand-logos"
import { BRANDS, brandFor, brandMonogram, normalizeBrandText } from "@/lib/presentation/brands"

const root = join(__dirname, "..")
const shared = join(root, "src/lib/presentation/brands")
const cases = JSON.parse(readFileSync(join(shared, "brand-cases.json"), "utf8")) as {
  normalize: { text: string; normalized: string }[]
  brandFor: { text: string; brand: string | null }[]
}

describe("brandFor (cases shared with keepwell-ios)", () => {
  it.each(cases.normalize)("normalizes $text", ({ text, normalized }) => {
    expect(normalizeBrandText(text)).toBe(normalized)
  })

  it.each(cases.brandFor)("$text gives $brand", ({ text, brand }) => {
    expect(brandFor(text)?.id ?? null).toBe(brand)
  })
})

describe("brand table", () => {
  it("has unique ids, a host name per brand and normalized aliases no two brands share", () => {
    expect(BRANDS.length).toBeGreaterThanOrEqual(60)
    expect(new Set(BRANDS.map((brand) => brand.id)).size).toBe(BRANDS.length)
    const owners = new Map<string, string>()
    for (const brand of BRANDS) {
      expect(brand.domain, brand.id).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/)
      expect(brand.name.trim(), brand.id).not.toBe("")
      const aliases = [...brand.aliases, ...brand.exactAliases]
      expect(aliases.length, brand.id).toBeGreaterThan(0)
      for (const alias of aliases) {
        // Plain ASCII words, so both platforms compare and measure them the same way.
        expect(alias, brand.id).toMatch(/^[a-z0-9]+( [a-z0-9]+)*$/)
        expect(normalizeBrandText(alias)).toBe(alias)
        expect(owners.get(alias), `${alias} is in ${owners.get(alias)} and ${brand.id}`).toBeUndefined()
        owners.set(alias, brand.id)
      }
    }
  })

  it("knows Claro and Tigo by their Nicaraguan sites", () => {
    expect(brandFor("Claro")?.domain).toBe("claro.com.ni")
    expect(brandFor("Tigo")?.domain).toBe("tigo.com.ni")
  })

  // keepwell-ios ships the same two files; from a worktree, KEEPWELL_IOS points at its checkout.
  const ios = process.env.KEEPWELL_IOS ?? join(root, "../keepwell-ios")
  const iosResources = join(ios, "Packages/Features/Sources/SharedPresentation/Resources/brands.json")
  const iosCases = join(ios, "Packages/Features/Tests/SharedPresentationTests/Fixtures/brand-cases.json")
  it.runIf(existsSync(iosResources))("is the same file in keepwell-ios, with the same cases", () => {
    expect(readFileSync(iosResources, "utf8")).toBe(readFileSync(join(shared, "brands.json"), "utf8"))
    expect(readFileSync(iosCases, "utf8")).toBe(readFileSync(join(shared, "brand-cases.json"), "utf8"))
  })
})

describe("Brandfetch chain", () => {
  const on = { enabled: true, clientId: "client" }
  const loaded: BrandLogoEvent = { type: "load", naturalWidth: 128 }
  const failed: BrandLogoEvent = { type: "error" }

  it("asks only for the domain of a table brand, never the text", () => {
    const session = new BrandLogoSession(on)
    const brand = brandFor("Spotify Premium familia Pérez")!
    const url = session.logoURL(brand.domain, "dark")!
    expect(url).toBe("https://cdn.brandfetch.io/domain/spotify.com/w/128/h/128/theme/dark/fallback/404/type/icon?c=client")
    expect(url).not.toMatch(/premium|familia|perez/i)
    // A movement with no brand has nothing to ask for.
    expect(brandFor("Almuerzo con Pérez")).toBeUndefined()
  })

  it("Brandfetch answers: the logo shows", () => {
    const session = new BrandLogoSession(on)
    expect(session.record("spotify.com", loaded)).toBe(true)
    expect(session.logoURL("spotify.com", "light")).toBeDefined()
  })

  it("Brandfetch gives 404 (unknown brand): the monogram stays and the domain isn't asked again", () => {
    const session = new BrandLogoSession(on)
    expect(session.record("tigo.com.ni", failed)).toBe(false)
    expect(session.logoURL("tigo.com.ni", "light")).toBeUndefined()
    expect(session.logoURL("spotify.com", "light")).toBeDefined()
  })

  it("Brandfetch redirects (blocked): its HTML page fails as an image, or loads empty, and counts as a failure", () => {
    const session = new BrandLogoSession(on)
    expect(session.record("netflix.com", failed)).toBe(false)
    expect(session.record("youtube.com", { type: "load", naturalWidth: 0 })).toBe(false)
    expect(session.logoURL("netflix.com", "dark")).toBeUndefined()
    expect(session.logoURL("youtube.com", "dark")).toBeUndefined()
  })

  it("no network: the monogram stays, and the domain is asked again once online", () => {
    const session = new BrandLogoSession(on)
    for (const domain of ["a.com", "b.com", "c.com", "d.com"]) expect(session.record(domain, failed, false)).toBe(false)
    expect(session.stopped).toBe(false)
    expect(session.logoURL("a.com", "light")).toBeDefined()
  })

  it("stops for the session after failures of different domains in a row, keeping logos already shown", () => {
    const session = new BrandLogoSession(on)
    session.record("spotify.com", loaded)
    session.record("a.com", failed)
    session.record("a.com", failed)
    session.record("b.com", failed)
    expect(session.stopped).toBe(false)
    session.record("c.com", failed)
    expect(BRAND_LOGO_FAILURE_LIMIT).toBe(3)
    expect(session.stopped).toBe(true)
    expect(session.logoURL("netflix.com", "light")).toBeUndefined()
    expect(session.logoURL("spotify.com", "light")).toBeDefined()
  })

  it("a success in between resets the count", () => {
    const session = new BrandLogoSession(on)
    session.record("a.com", failed)
    session.record("b.com", failed)
    session.record("spotify.com", loaded)
    session.record("c.com", failed)
    expect(session.stopped).toBe(false)
  })

  it("asks for nothing with the switch off or without a client id", () => {
    expect(new BrandLogoSession({ enabled: false, clientId: "client" }).logoURL("spotify.com", "light")).toBeUndefined()
    expect(new BrandLogoSession({ enabled: true, clientId: undefined }).logoURL("spotify.com", "light")).toBeUndefined()
  })

  it("escapes what goes in the URL", () => {
    expect(brandLogoURL("claro.com.ni", "light", "a b")).toBe(
      "https://cdn.brandfetch.io/domain/claro.com.ni/w/128/h/128/theme/light/fallback/404/type/icon?c=a%20b"
    )
  })

  it("the monogram is the brand's first letter or digit", () => {
    expect(brandMonogram({ name: "Spotify" })).toBe("S")
    expect(brandMonogram({ name: "1Password" })).toBe("1")
    expect(brandMonogram({ name: "eBay" })).toBe("E")
  })
})
