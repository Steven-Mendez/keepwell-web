import { api } from "./client"

export interface PublicClient {
  client_id: string
  client_name?: string
  client_uri?: string
  logo_uri?: string
}

export interface ConnectedClient {
  client_id: string
  name: string | null
  uri: string | null
  scopes: string[]
  connected_at: string
}

/** What an MCP client is called and where it comes from, for the consent screen. Needs a session. */
export function publicClient(clientId: string): Promise<PublicClient> {
  return api(
    `/api/auth/oauth2/public-client?client_id=${encodeURIComponent(clientId)}`
  )
}

/**
 * Answers the consent screen. `oauthQuery` is the signed query the authorization server put on this
 * page's URL; the answer says where to send the browser (back to the client, with a code or an error).
 */
export async function answerConsent(
  accept: boolean,
  oauthQuery: string
): Promise<string> {
  const { url } = await api<{ url: string }>("/api/auth/oauth2/consent", {
    method: "POST",
    body: JSON.stringify({ accept, oauth_query: oauthQuery }),
  })
  return url
}

export async function connectedClients(): Promise<ConnectedClient[]> {
  return (await api<{ clients: ConnectedClient[] }>("/mcp/clients")).clients
}

export async function revokeClient(clientId: string): Promise<void> {
  await api(`/mcp/clients/${encodeURIComponent(clientId)}`, {
    method: "DELETE",
  })
}

export async function disconnectAll(): Promise<void> {
  await api("/mcp/disconnect-all", { method: "POST", body: "{}" })
}

/** The scopes a client can ask for, as the person reads them. */
export const SCOPE_TEXT: Record<string, string> = {
  read: "See your accounts, balances, movements, budgets and upcoming payments",
  write:
    "Record movements and recurring payments, which wait for you to confirm them",
  offline_access: "Stay connected until you disconnect it",
}
