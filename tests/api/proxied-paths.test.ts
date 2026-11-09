import { describe, expect, it } from "vitest"

import { isApiPath } from "@/lib/api/proxied-paths"

describe("proxied API paths", () => {
  it("covers the API and nothing of the app", () => {
    for (const path of ["/me", "/sync/pull", "/api/auth/callback/apple", "/mcp", "/.well-known/oauth-authorization-server/api/auth", "/invitations/claim"]) {
      expect(isApiPath(path)).toBe(true)
    }
    for (const path of ["/", "/settings", "/connect", "/connect/consent", "/.well-known/apple-app-site-association", "/media", "/summary"]) {
      expect(isApiPath(path)).toBe(false)
    }
  })
})
