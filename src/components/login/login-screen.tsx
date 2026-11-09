"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, useSyncExternalStore } from "react"

import { KWButton } from "@/components/kw/design"
import { KWAppIconTile } from "@/components/kw/kw-icon"
import { Input } from "@/components/ui/input"
import { useAccount } from "@/hooks/use-account"
import { claimInvitation, signInWithApple } from "@/lib/api/account"
import { accountErrorCode, describeAccountError } from "@/lib/api/account-errors"
import { passkeysSupported, signInWithPasskey } from "@/lib/api/passkeys"
import { useT } from "@/lib/i18n"

/** Where a signed-in person goes, and where Apple sends them back on success. */
const AFTER_SIGN_IN = "/settings"

const noSubscription = () => () => {}

function AppleGlyph() {
  return (
    <svg
      viewBox="0 0 384 512"
      width="16"
      height="16"
      aria-hidden
      fill="currentColor"
    >
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  )
}

/**
 * /login: the Keepwell account, on a page of its own. Optional: everything works in this browser
 * without it; an account syncs with the iPhone. New accounts need an invitation.
 */
export function LoginScreen() {
  const t = useT()
  const router = useRouter()
  const { state } = useAccount()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<{
    message: string
    needsInvitation: boolean
  }>()
  const [invitationOpened, setInvitationOpened] = useState(false)
  const [invitation, setInvitation] = useState("")
  // WebAuthn exists only in the browser: false while rendering on the server, so hydration matches.
  const canUsePasskeys = useSyncExternalStore(noSubscription, passkeysSupported, () => false)
  // Apple's callback comes back here with ?error= when it fails.
  const callbackCode = useSearchParams().get("error")
  const shown =
    failure ?? (callbackCode ? describeAccountError(callbackCode, t) : undefined)
  const error = shown?.message
  const showInvitation = invitationOpened || Boolean(shown?.needsInvitation)

  useEffect(() => {
    if (state.status === "signed-in") router.replace(AFTER_SIGN_IN)
  }, [state.status, router])

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    setFailure(undefined)
    try {
      await work()
    } catch (caught) {
      setFailure(describeAccountError(accountErrorCode(caught), t))
      setBusy(false)
    }
  }

  const withApple = () =>
    run(async () => {
      const code = invitation.trim()
      if (code) await claimInvitation(code)
      await signInWithApple(
        `${window.location.origin}${AFTER_SIGN_IN}`,
        undefined,
        `${window.location.origin}/login`
      )
    })

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <KWAppIconTile size={56} />
        <div className="flex flex-col gap-2">
          <h1 className="type-title">{t.in("web", "Sign in to Keepwell")}</h1>
          <p className="type-body text-muted-foreground">
            {t.in(
              "web",
              "Sync this browser with Keepwell for iPhone. Without an account, everything keeps working here."
            )}
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="w-full rounded-xl bg-destructive/10 px-4 py-3 text-left type-caption text-destructive"
          >
            {error}
          </p>
        ) : null}

        <div className="flex w-full flex-col gap-3">
          {showInvitation ? (
            <label className="flex flex-col gap-1.5 text-left">
              <span className="type-caption text-muted-foreground">
                {t.in("web", "Invitation code")}
              </span>
              <Input
                value={invitation}
                onChange={(event) => setInvitation(event.target.value)}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="font-mono"
              />
            </label>
          ) : null}
          <KWButton
            fill
            disabled={busy || state.status === "loading"}
            onClick={() => void withApple()}
          >
            <span className="inline-flex items-center gap-2">
              <AppleGlyph />
              {t.in("web", "Continue with Apple")}
            </span>
          </KWButton>
          {canUsePasskeys ? (
            <>
              <div
                className="flex items-center gap-3 type-caption text-muted-foreground"
                aria-hidden
              >
                <span className="h-px flex-1 bg-border" />
                {t.in("web", "or")}
                <span className="h-px flex-1 bg-border" />
              </div>
              <KWButton
                fill
                variant="secondary"
                icon="faceID"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await signInWithPasskey()
                    router.replace(AFTER_SIGN_IN)
                  })
                }
              >
                {t.in("web", "Use a passkey")}
              </KWButton>
            </>
          ) : null}
        </div>

        {!showInvitation ? (
          <button
            type="button"
            className="type-caption text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setInvitationOpened(true)}
          >
            {t.in("web", "Have an invitation?")}
          </button>
        ) : null}

        <Link
          href="/"
          className="type-caption text-muted-foreground underline-offset-4 hover:underline"
        >
          {t.in("web", "Not now")}
        </Link>
      </div>
    </main>
  )
}
