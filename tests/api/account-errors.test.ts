import { describe, expect, it } from "vitest"

import { accountErrorCode, describeAccountError } from "@/lib/api/account-errors"
import { ApiError } from "@/lib/api/client"
import { makeTranslator } from "@/lib/i18n"

const t = makeTranslator("en")
const dom = (name: string) => Object.assign(new Error(name), { name })

describe("account errors", () => {
  it("never call a refused or missing passkey a network failure", () => {
    expect(accountErrorCode(dom("NotAllowedError"))).toBe("PASSKEY_CANCELLED")
    expect(accountErrorCode(Object.assign(dom("InvalidStateError"), { code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" }))).toBe("PASSKEY_EXISTS")
    expect(describeAccountError("PASSKEY_CANCELLED", t).message).not.toMatch(/reach/i)
  })

  it("keep the API's codes and call only a failed fetch a network problem", () => {
    expect(accountErrorCode(new ApiError(403, "NOT_INVITED", "invite-only"))).toBe("NOT_INVITED")
    expect(accountErrorCode(new TypeError("Failed to fetch"))).toBe("NETWORK")
    expect(accountErrorCode(new Error("odd"))).toBe("UNKNOWN")
  })

  it("open the invitation field only when an invitation would help", () => {
    expect(describeAccountError("NOT_INVITED", t).needsInvitation).toBe(true)
    expect(describeAccountError("state_mismatch", t).needsInvitation).toBe(false)
    expect(describeAccountError("UNKNOWN", t, "Fallback").message).toBe("Fallback")
  })
})
