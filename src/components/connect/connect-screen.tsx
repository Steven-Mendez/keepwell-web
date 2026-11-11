"use client"

import {
  BotIcon,
  EyeIcon,
  Link2Icon,
  PencilLineIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  SlidersHorizontalIcon,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useState } from "react"

import { KWButton } from "@/components/kw/design"
import { KWAppIconTile } from "@/components/kw/kw-icon"
import { useAccount } from "@/hooks/use-account"
import { signInWithApple } from "@/lib/api/account"
import { ApiError } from "@/lib/api/client"
import {
  answerConsent,
  publicClient,
  SCOPES,
  type PublicClient,
} from "@/lib/api/connect"
import { passkeysSupported, signInWithPasskey } from "@/lib/api/passkeys"
import { useT, type Translator } from "@/lib/i18n"
import { cn } from "cn"

// The two screens an assistant's connection goes through: sign in (/connect), then allow
// (/connect/consent). Shaped after the consent screens people already know (GitHub, Google): the two
// apps joined at the top, who is signed in, each permission with what it allows, and where "Allow"
// leads.

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6">{children}</div>
    </main>
  )
}

/** Keepwell and the assistant, joined by a shield: who is asking whom. */
function Pairing({ client }: { client?: PublicClient | undefined }) {
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden>
      <span className="flex size-14 items-center justify-center overflow-hidden rounded-2xl border bg-card">
        {client?.logo_uri ? (
          // eslint-disable-next-line @next/next/no-img-element -- a client's own logo, any origin
          <img src={client.logo_uri} alt="" className="size-14 object-cover" />
        ) : (
          <BotIcon className="size-6 text-text-secondary" strokeWidth={1.75} />
        )}
      </span>
      <span className="flex items-center gap-1.5 text-text-faint">
        <span className="h-px w-6 border-t border-dashed border-current" />
        <span className="flex size-8 items-center justify-center rounded-full border bg-card text-positive">
          <ShieldCheckIcon className="size-4" strokeWidth={2} />
        </span>
        <span className="h-px w-6 border-t border-dashed border-current" />
      </span>
      <KWAppIconTile size={56} className="rounded-2xl" />
    </div>
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
  // Passkey support is a browser fact: checked after mounting so the server's HTML matches.
  const [passkeys, setPasskeys] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- only known in the browser
    setPasskeys(passkeysSupported())
  }, [])
  return (
    <Frame>
      <Pairing />
      <header className="flex flex-col gap-2 text-center">
        <h1 className="type-title">{t.in("web", "Connect Keepwell")}</h1>
        <p className="type-body text-text-secondary">
          {t.in(
            "web",
            "Sign in to let an assistant see your Keepwell data. You'll choose what it can do next."
          )}
        </p>
      </header>
      <div className="flex flex-col gap-3 rounded-2xl bg-card p-5">
        <KWButton
          fill
          size="large"
          onClick={() =>
            void signInWithApple(window.location.href, oauthQuery()).catch(
              (e: unknown) =>
                setError(
                  e instanceof ApiError && e.code === "NOT_INVITED"
                    ? t.in("cloudaccount", "Keepwell accounts are invite-only for now.")
                    : t.in("cloudaccount", "Couldn't reach Keepwell. Try again.")
                )
            )
          }
        >
          {t.in("web", "Sign in with Apple")}
        </KWButton>
        {passkeys ? (
          <KWButton
            fill
            size="large"
            variant="secondary"
            onClick={() =>
              // After a passkey sign-in Better Auth resumes the authorization on its own.
              void signInWithPasskey(oauthQuery()).then(
                () => window.location.reload(),
                () =>
                  setError(t.in("cloudaccount", "Couldn't reach Keepwell. Try again."))
              )
            }
          >
            {t.in("cloudaccount", "Use a passkey")}
          </KWButton>
        ) : null}
        {error ? (
          <p role="alert" className="type-caption text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <p className="text-center type-caption text-text-faint">
        {t.in("web", "Keepwell never shares your password with the assistant.")}
      </p>
    </Frame>
  )
}

const SCOPE_ICON: Record<string, LucideIcon> = {
  read: EyeIcon,
  write: PencilLineIcon,
  manage: SlidersHorizontalIcon,
  offline_access: Link2Icon,
}

function levelLabel(t: Translator, level: (typeof SCOPES)[string]["level"]) {
  return level === "read"
    ? t.in("web", "Read")
    : level === "write"
      ? t.in("web", "Write")
      : level === "manage"
        ? t.in("web", "Write and delete")
        : t.in("web", "Session")
}

/** One permission: what it allows in a line, and a tag with how far it goes. */
function ScopeRow({ t, scope }: { t: Translator; scope: string }) {
  const detail = SCOPES[scope]
  const Icon = SCOPE_ICON[scope] ?? ShieldCheckIcon
  const manage = detail?.level === "manage"
  return (
    <li className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          manage
            ? "bg-amber-500/12 text-amber-600 dark:text-amber-400"
            : "bg-secondary text-text-secondary"
        )}
      >
        <Icon className="size-4" strokeWidth={2} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-3">
          <span className="type-label text-foreground">
            {detail ? t.in("web", detail.title) : scope}
          </span>
          {detail ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 type-micro font-semibold",
                manage
                  ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
                  : "bg-secondary text-text-secondary"
              )}
            >
              {levelLabel(t, detail.level)}
            </span>
          ) : null}
        </div>
        {detail ? (
          <span className="type-caption text-text-secondary">
            {t.in("web", detail.description)}
          </span>
        ) : null}
      </div>
    </li>
  )
}

/**
 * /connect/consent: names the client, where it comes from and every scope it asks for, and asks
 * explicitly. Nothing is remembered across different clients.
 */
export function ConnectConsent() {
  const t = useT()
  const { state } = useAccount()
  const [client, setClient] = useState<PublicClient>()
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<"allow" | "deny">()
  // The query is only known in the browser: read after mounting, so the server and the first client
  // render agree (a hydration mismatch otherwise).
  const [params, setParams] = useState<URLSearchParams>()
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is only known after hydration
    setParams(new URLSearchParams(window.location.search))
  }, [])
  const scopes = (params?.get("scope") ?? "").split(" ").filter(Boolean)
  const clientId = params?.get("client_id") ?? ""

  useEffect(() => {
    if (!clientId) return
    publicClient(clientId).then(setClient, () => setFailed(true))
  }, [clientId])

  const answer = async (accept: boolean) => {
    setBusy(accept ? "allow" : "deny")
    try {
      window.location.assign(await answerConsent(accept, oauthQuery()))
    } catch {
      setFailed(true)
      setBusy(undefined)
    }
  }

  if (!params)
    return (
      <Frame>
        <Pairing />
      </Frame>
    )

  if (failed || !clientId) {
    return (
      <Frame>
        <Pairing />
        <header className="flex flex-col gap-2 text-center">
          <h1 className="type-title">
            {t.in("web", "This connection can't continue")}
          </h1>
          <p className="type-body text-text-secondary">
            {t.in("web", "Start again from the app that asked to connect.")}
          </p>
        </header>
      </Frame>
    )
  }

  const name = client?.client_name ?? clientId
  const host = client?.client_uri ? new URL(client.client_uri).host : undefined
  const email = state.status === "signed-in" ? state.me.user.email : undefined
  // Permissions first, the session last: it isn't something the assistant does with the data.
  const ordered = [...scopes].sort(
    (a, b) => Number(a === "offline_access") - Number(b === "offline_access")
  )

  return (
    <Frame>
      <Pairing client={client} />
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="type-title">
          {t.in("web", "%@ wants to use your Keepwell", name)}
        </h1>
        <p className="type-caption text-text-secondary">
          {host ? (
            <span className="font-medium text-foreground">{host}</span>
          ) : null}
          {host && email ? " · " : null}
          {email ? t.in("web", "Signed in as %@", email) : null}
        </p>
      </header>

      <section
        className="flex flex-col gap-4 rounded-2xl bg-card p-5"
        aria-label={t.in("web", "What it will be able to do")}
      >
        <p className="type-caption font-semibold text-text-secondary">
          {t.in("web", "%@ will be able to", name)}
        </p>
        <ul className="flex flex-col divide-y">
          {ordered.map((scope) => (
            <ScopeRow key={scope} t={t} scope={scope} />
          ))}
        </ul>
        {scopes.includes("manage") ? (
          <div
            role="note"
            className="flex gap-2.5 rounded-xl bg-amber-500/8 px-3.5 py-3"
          >
            <ShieldAlertIcon
              className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
              strokeWidth={2}
              aria-hidden
            />
            <p className="type-caption text-text-secondary">
              {t.in(
                "web",
                "It can change and delete your data. It asks you in the chat before each delete, and deletes can be undone for 30 days."
              )}
            </p>
          </div>
        ) : null}
      </section>

      <div className="flex flex-col gap-3">
        <KWButton
          fill
          size="large"
          disabled={busy !== undefined || !client}
          onClick={() => void answer(true)}
        >
          {busy === "allow" ? t.in("web", "Connecting…") : t.in("web", "Allow")}
        </KWButton>
        <KWButton
          fill
          size="large"
          variant="secondary"
          disabled={busy !== undefined}
          onClick={() => void answer(false)}
        >
          {t.in("web", "Deny")}
        </KWButton>
      </div>

      <ul className="flex flex-col gap-1.5 text-center type-caption text-text-faint">
        <li>{t.in("web", "You can disconnect it any time in Settings.")}</li>
        {host ? (
          <li>{t.in("web", "Allowing takes you back to %@.", host)}</li>
        ) : null}
      </ul>
    </Frame>
  )
}
