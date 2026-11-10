"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { KWButtonLink } from "@/components/kw/design"
import { KWAppIconTile } from "@/components/kw/kw-icon"
import { useAccount } from "@/hooks/use-account"
import { useT } from "@/lib/i18n"

import { SignInOptions } from "./sign-in-options"

/** Where a signed-in person goes, and where Apple sends them back on success. */
const AFTER_SIGN_IN = "/settings"

/**
 * /login: the Keepwell account, on a page of its own (from Settings, once Keepwell is set up).
 * Optional: "Continue without an account" keeps everything in this browser; an account syncs with
 * the iPhone. New accounts need an invitation.
 */
export function LoginScreen() {
  const t = useT()
  const router = useRouter()
  const { state } = useAccount()

  useEffect(() => {
    if (state.status === "signed-in") router.replace(AFTER_SIGN_IN)
  }, [state.status, router])

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

        <SignInOptions
          returnPath="/login"
          successPath={AFTER_SIGN_IN}
          disabled={state.status === "loading"}
          onPasskeySignedIn={() => router.replace(AFTER_SIGN_IN)}
        />

        <div className="flex w-full flex-col gap-1.5">
          <KWButtonLink href="/" fill variant="surface">
            {t.in("web", "Continue without an account")}
          </KWButtonLink>
          <p className="type-caption-sm text-muted-foreground">
            {t.in("web", "Your data stays only in this browser.")}
          </p>
        </div>
        <Link
          href="/privacy"
          className="type-caption-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t.in("web", "Privacy Policy")}
        </Link>
      </div>
    </main>
  )
}
