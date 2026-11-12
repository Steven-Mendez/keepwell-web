import { describe, expect, it } from "vitest"

import { isApiPath, isNetworkOnly } from "@/lib/api/proxied-paths"

describe("proxied API paths", () => {
  it("covers the API and nothing of the app", () => {
    for (const path of ["/me", "/sync/pull", "/api/auth/callback/apple", "/mcp", "/.well-known/oauth-authorization-server/api/auth", "/invitations/claim"]) {
      expect(isApiPath(path)).toBe(true)
    }
    for (const path of ["/", "/settings", "/connect", "/connect/consent", "/.well-known/apple-app-site-association", "/media", "/summary"]) {
      expect(isApiPath(path)).toBe(false)
    }
  })

  it("keeps Brandfetch's logos out of the service worker's caches", () => {
    const logo = new URL("https://cdn.brandfetch.io/domain/spotify.com/w/128/h/128/theme/dark/fallback/404/type/icon?c=id")
    expect(isNetworkOnly(logo, false)).toBe(true)
    expect(isNetworkOnly(new URL("https://keepwell.app/summary"), true)).toBe(false)
  })
})
