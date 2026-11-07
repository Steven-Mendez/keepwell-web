"use client"

import { useEffect, useState } from "react"

import { KWButton } from "@/components/kw/design"
import { signInWithApple } from "@/lib/api/account"
import { ApiError } from "@/lib/api/client"
import {
  answerConsent,
  publicClient,
  SCOPE_TEXT,
  type PublicClient,
} from "@/lib/api/connect"
import { useT } from "@/lib/i18n"

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-2xl bg-card p-6">
        {children}
      </div>
    </main>
  )
}

/** The signed query the authorization server put on this URL; sent back untouched. */
function oauthQuery(): string {
  return typeof window === "undefined" ? "" : window.location.search.slice(1)
}

/**
 * /connect: the authorization server's login page. Signing in with Apple from here carries the
 * signed request along, so Better Auth resumes the authorization (usually on to the consent page).
 */
export function ConnectSignIn() {
  const t = useT()
  const [error, setError] = useState<string>()
  return (
    <Frame>
      <h1 className="type-title">{t.in("web", "Connect Keepwell")}</h1>
      <p className="type-body text-muted-foreground">
        {t.in(
          "web",
          "Sign in to let an assistant see your Keepwell data. You'll choose what it can do next."
        )}
      </p>
      <KWButton
        onClick={() =>
          void signInWithApple(window.location.href, oauthQuery()).catch(
            (e: unknown) =>
              setError(
                e instanceof ApiError && e.code === "NOT_INVITED"
                  ? t.in("web", "Keepwell accounts are invite-only for now.")
                  : t.in("web", "Couldn't reach Keepwell. Try again.")
              )
          )
        }
      >
        {t.in("web", "Sign in with Apple")}
      </KWButton>
      {error ? <p className="type-caption text-destructive">{error}</p> : null}
    </Frame>
  )
}

/**
 * /connect/consent: names the client, where it comes from and every scope it asks for, and asks
 * explicitly. Nothing is remembered across different clients.
 */
export function ConnectConsent() {
  const t = useT()
  const [client, setClient] = useState<PublicClient>()
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const params =
    typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search)
  const scopes = (params.get("scope") ?? "").split(" ").filter(Boolean)
  const clientId = params.get("client_id") ?? ""

  useEffect(() => {
    if (!clientId) return
    publicClient(clientId).then(setClient, () => setFailed(true))
  }, [clientId])

  const answer = async (accept: boolean) => {
    setBusy(true)
    try {
      window.location.assign(await answerConsent(accept, oauthQuery()))
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  if (failed || !clientId) {
    return (
      <Frame>
        <h1 className="type-title">
          {t.in("web", "This connection can't continue")}
        </h1>
        <p className="type-body text-muted-foreground">
          {t.in("web", "Start again from the app that asked to connect.")}
        </p>
      </Frame>
    )
  }
  const host = client?.client_uri ? new URL(client.client_uri).host : undefined
  return (
    <Frame>
      <h1 className="type-title">
        {t.in(
          "web",
          "Allow %@ to use your Keepwell?",
          client?.client_name ?? clientId
        )}
      </h1>
      {host ? (
        <p className="type-caption text-muted-foreground">{host}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {scopes.map((scope) => (
          <li key={scope} className="type-body">
            {t.in("web", SCOPE_TEXT[scope] ?? scope)}
          </li>
        ))}
      </ul>
      <p className="type-caption text-muted-foreground">
        {t.in("web", "You can disconnect it any time in Settings.")}
      </p>
      <div className="flex gap-3">
        <KWButton
          variant="secondary"
          disabled={busy}
          onClick={() => void answer(false)}
        >
          {t.in("web", "Deny")}
        </KWButton>
        <KWButton disabled={busy || !client} onClick={() => void answer(true)}>
          {t.in("web", "Allow")}
        </KWButton>
      </div>
    </Frame>
  )
}
