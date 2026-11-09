import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser"

import { api } from "./client"

/**
 * Passkeys for the Keepwell account (increment 22). The relying party is this site's host, so a
 * passkey made here also works in the iPhone app, which declares the site as an associated domain.
 */
export async function addPasskey(name: string): Promise<void> {
  const options = await api<PublicKeyCredentialCreationOptionsJSON>(
    "/api/auth/passkey/generate-register-options"
  )
  const response = await startRegistration({ optionsJSON: options })
  await api("/api/auth/passkey/verify-registration", {
    method: "POST",
    body: JSON.stringify({ response, name }),
  })
}

/** Signs in without Apple; `oauthQuery` resumes an MCP authorization, as on /connect. */
export async function signInWithPasskey(oauthQuery?: string): Promise<void> {
  const options = await api<PublicKeyCredentialRequestOptionsJSON>(
    "/api/auth/passkey/generate-authenticate-options"
  )
  const response = await startAuthentication({ optionsJSON: options })
  await api("/api/auth/passkey/verify-authentication", {
    method: "POST",
    body: JSON.stringify({
      response,
      ...(oauthQuery ? { oauth_query: oauthQuery } : {}),
    }),
  })
}

export const passkeysSupported = () =>
  typeof window !== "undefined" &&
  typeof window.PublicKeyCredential === "function"
