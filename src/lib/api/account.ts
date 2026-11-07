import { api, API_URL, ApiError } from "./client"

export interface AccountUser {
  id: string
  name: string
  email: string
}

export interface Me {
  user: AccountUser
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
export async function signInWithApple(returnTo: string): Promise<void> {
  const { url } = await api<{ url: string; redirect: boolean }>("/api/auth/sign-in/social", {
    method: "POST",
    body: JSON.stringify({ provider: "apple", callbackURL: returnTo, errorCallbackURL: returnTo }),
  })
  window.location.assign(url)
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
