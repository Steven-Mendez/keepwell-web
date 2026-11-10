"use client"

import { useSearchParams } from "next/navigation"
import { useState, useSyncExternalStore } from "react"

import { KWButton } from "@/components/kw/design"
import { Input } from "@/components/ui/input"
import { claimInvitation, signInWithApple } from "@/lib/api/account"
import { accountErrorCode, describeAccountError } from "@/lib/api/account-errors"
import { passkeysSupported, signInWithPasskey } from "@/lib/api/passkeys"
import { useT } from "@/lib/i18n"

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
 * The ways into a Keepwell account: Apple, a passkey, and an invitation code for new accounts,
 * folded until asked for or the server wants one. Shared by /login and the welcome screen.
 *
 * Apple leaves the page and comes back to `returnPath` (with `?error=` on failure, read here); a
 * passkey signs in on the spot and calls `onPasskeySignedIn`.
 */
export function SignInOptions({
  returnPath,
  successPath = returnPath,
  disabled = false,
  onPasskeySignedIn,
}: {
  /** Where Apple sends the browser back when sign-in fails (and succeeds, unless `successPath`). */
  returnPath: string
  successPath?: string
  disabled?: boolean
  onPasskeySignedIn: () => void
}) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<{
    message: string
    needsInvitation: boolean
  }>()
  const [invitationOpened, setInvitationOpened] = useState(false)
  const [invitation, setInvitation] = useState("")
  // WebAuthn exists only in the browser: false while rendering on the server, so hydration matches.
  const canUsePasskeys = useSyncExternalStore(
    noSubscription,
    passkeysSupported,
    () => false
  )
  // Apple's callback comes back with ?error= when it fails.
  const callbackCode = useSearchParams().get("error")
  const shown =
    failure ??
    (callbackCode ? describeAccountError(callbackCode, t) : undefined)
  const error = shown?.message
  const showInvitation = invitationOpened || Boolean(shown?.needsInvitation)

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
      const origin = window.location.origin
      await signInWithApple(
        `${origin}${successPath}`,
        undefined,
        `${origin}${returnPath}`
      )
    })

  const withPasskey = () =>
    run(async () => {
      await signInWithPasskey()
      onPasskeySignedIn()
    })

  return (
    <div className="flex w-full flex-col gap-3">
      {error ? (
        <p
          role="alert"
          className="w-full rounded-xl bg-destructive/10 px-4 py-3 text-left type-caption text-destructive"
        >
          {error}
        </p>
      ) : null}
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
          <span className="type-caption-sm text-muted-foreground">
            {t.in(
              "web",
              "New accounts need one. Enter it, then sign in with Apple."
            )}
          </span>
        </label>
      ) : null}
      <KWButton
        fill
        disabled={busy || disabled}
        onClick={() => void withApple()}
      >
        <span className="inline-flex items-center gap-2">
          <AppleGlyph />
          {t.in("web", "Continue with Apple")}
        </span>
      </KWButton>
      {canUsePasskeys ? (
        <KWButton
          fill
          variant="secondary"
          icon="faceID"
          disabled={busy || disabled}
          onClick={() => void withPasskey()}
        >
          {t.in("web", "Use a passkey")}
        </KWButton>
      ) : null}
      {!showInvitation ? (
        <button
          type="button"
          className="self-center type-caption text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setInvitationOpened(true)}
        >
          {t.in("web", "Have an invitation?")}
        </button>
      ) : null}
    </div>
  )
}
