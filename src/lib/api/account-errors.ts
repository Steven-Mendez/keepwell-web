import type { Translator } from "@/lib/i18n"

import { ApiError } from "./client"

/**
 * One code for every way an account action can fail: the API's codes (`NOT_INVITED`), Better
 * Auth's callback codes through `?error=` (`state_mismatch`), the browser's WebAuthn refusals and
 * the network. Only `NETWORK` means Keepwell could not be reached.
 */
export function accountErrorCode(error: unknown): string {
  if (error instanceof ApiError) return error.code
  const name = (error as { name?: string } | null)?.name
  const code = (error as { code?: string } | null)?.code
  // SimpleWebAuthn rethrows the browser's DOMException names, with its own code beside them.
  if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" || name === "InvalidStateError") return "PASSKEY_EXISTS"
  if (name === "NotAllowedError" || name === "AbortError" || code === "ERROR_CEREMONY_ABORTED") return "PASSKEY_CANCELLED"
  if (error instanceof TypeError) return "NETWORK"
  return "UNKNOWN"
}

export interface AccountErrorText {
  message: string
  /** The sign-in page opens the invitation field. */
  needsInvitation: boolean
}

export function describeAccountError(code: string, t: Translator, fallback?: string): AccountErrorText {
  const text = (message: string, needsInvitation = false) => ({ message, needsInvitation })
  switch (code.toUpperCase()) {
    case "NOT_INVITED":
      return text(t.in("web", "Keepwell accounts are invite-only for now. If you have an invitation, enter it below."), true)
    case "INVALID_INVITATION":
    case "INVITATION_NOT_FOUND":
      return text(t.in("cloudaccount", "That invitation is not valid. It may have expired or been used."), true)
    case "ACCESS_DENIED":
    case "USER_CANCELLED":
      return text(t.in("web", "Sign-in was cancelled."))
    case "STATE_MISMATCH":
    case "STATE_NOT_FOUND":
    case "PLEASE_RESTART_THE_PROCESS":
      return text(t.in("web", "Sign-in took too long or was interrupted. Try again."))
    case "PASSKEY_CANCELLED":
      return text(t.in("web", "No passkey was used. If you don't have one yet, continue with Apple and add it in Settings."))
    case "PASSKEY_EXISTS":
      return text(t.in("web", "This device already has a Keepwell passkey."))
    case "PASSKEY_NOT_FOUND":
    case "AUTHENTICATION_FAILED":
    case "FAILED_TO_VERIFY_AUTHENTICATION":
      return text(t.in("web", "That passkey doesn't belong to a Keepwell account. Continue with Apple instead."))
    case "NETWORK":
      return text(t.in("web", "Couldn't reach Keepwell. Check your connection and try again."))
    default:
      return text(fallback ?? t.in("web", "Couldn't sign in. Try again."))
  }
}
