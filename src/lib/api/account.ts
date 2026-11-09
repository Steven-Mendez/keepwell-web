import { api, API_URL, ApiError } from "./client"

export interface AccountUser {
  id: string
  name: string
  email: string
}

export type Capability = "cloud_sync" | "mcp"

export interface Me {
  user: AccountUser
  plan: "free" | "supporter" | "pro" | "grandfathered"
  capabilities: Capability[]
  /** Capabilities that come only from early access ("included during early access"). */
  early_access: Capability[]
}

/** The signed-in person, or `null` when there is no session. */
export async function fetchMe(): Promise<Me | null> {
  try {
    return await api<Me>("/me")
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

/**
 * Starts Sign in with Apple through the API (Better Auth's redirect flow). Apple posts back to the
 * API, which sets the shared session cookie and sends the browser to `returnTo`.
 */
export async function signInWithApple(returnTo: string, oauthQuery?: string): Promise<void> {
  const { url } = await api<{ url: string; redirect: boolean }>("/api/auth/sign-in/social", {
    method: "POST",
    // From /connect: the signed authorization request, so Better Auth resumes it after sign-in.
    body: JSON.stringify({ provider: "apple", callbackURL: returnTo, errorCallbackURL: returnTo, ...(oauthQuery ? { oauth_query: oauthQuery } : {}) }),
  })
  window.location.assign(url)
}

/**
 * Checks an invitation and has the API keep it in a short-lived cookie, which Apple's redirect then
 * brings back to the API. The code is used up only when the account is created.
 */
export async function claimInvitation(code: string): Promise<void> {
  await api<void>("/invitations/claim", { method: "POST", body: JSON.stringify({ code }) })
}

export async function signOut(): Promise<void> {
  await api("/api/auth/sign-out", { method: "POST", body: "{}" })
}

/** Ends every session of this account, on every device (Better Auth's revoke-sessions). */
export async function signOutEverywhere(): Promise<void> {
  await api("/api/auth/revoke-sessions", { method: "POST", body: "{}" })
}

/**
 * Deletes the Keepwell account: sessions end at once and the server erases the data in the
 * background. Backups keep it up to `backups_retained_days` more. Data in this browser stays.
 */
export async function deleteAccount(): Promise<{ backups_retained_days: number }> {
  return api("/me", { method: "DELETE" })
}

export const hasApi = API_URL !== undefined
