// The public page of a shared split stands alone: an anonymous visitor's empty browser database must
// not send it to onboarding, and its API path is forwarded, never cached.
import { describe, expect, it } from "vitest"

import { isStandalonePath } from "@/components/app/navigation"
import { isApiPath } from "@/lib/api/proxied-paths"

describe("the shared split route", () => {
  it("is standalone, without catching other pages that start with s", () => {
    expect(isStandalonePath("/s/AbCdEfGhIjKlMnOpQrSt_-")).toBe(true)
    expect(isStandalonePath("/settings")).toBe(false)
    expect(isStandalonePath("/summary")).toBe(false)
  })

  it("reads from an API path", () => {
    expect(isApiPath("/shared/AbCdEfGhIjKlMnOpQrSt_-")).toBe(true)
  })
})
