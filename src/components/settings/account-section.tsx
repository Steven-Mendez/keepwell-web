"use client"

import { useState } from "react"

import { KWButton } from "@/components/kw/design"
import { toast } from "@/components/ui/toast"
import { useAccount } from "@/hooks/use-account"
import { signInWithApple, signOut, signOutEverywhere } from "@/lib/api/account"
import { ApiError } from "@/lib/api/client"
import type { Translator } from "@/lib/i18n"

import { SettingsRow, SettingsSection } from "./settings-rows"

/**
 * The Keepwell account, for builds that have an API. Local use never needs it: everything else in
 * settings works the same signed in or not.
 */
export function AccountSection({ t }: { t: Translator }) {
  const { state, refresh } = useAccount()
  const [busy, setBusy] = useState(false)
  if (state.status === "unavailable") return null

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try {
      await work()
      refresh()
    } catch (error) {
      toast.add({ title: error instanceof ApiError && error.code === "NOT_INVITED" ? t.in("web", "Keepwell accounts are invite-only for now.") : t.in("web", "Couldn't reach Keepwell. Try again."), type: "error" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsSection title={t.in("web", "Account")} footnote={t.in("web", "An account syncs this browser with Keepwell for iPhone. Without one, your data stays only here.")}>
      {state.status === "signed-in" ? (
        <>
          <SettingsRow label={state.me.user.name || state.me.user.email} description={state.me.user.email}>
            <KWButton variant="secondary" size="small" disabled={busy} onClick={() => run(signOut)}>
              {t.in("web", "Sign out")}
            </KWButton>
          </SettingsRow>
          <SettingsRow label={t.in("web", "Sign out on all devices")}>
            <KWButton variant="secondary" size="small" disabled={busy} onClick={() => run(signOutEverywhere)}>
              {t.in("web", "Sign out everywhere")}
            </KWButton>
          </SettingsRow>
        </>
      ) : (
        <SettingsRow label={t.in("web", "Keepwell account")} description={state.status === "error" ? t.in("web", "Couldn't reach Keepwell. Try again.") : undefined}>
          <KWButton size="small" disabled={busy || state.status === "loading"} onClick={() => run(() => signInWithApple(window.location.href))}>
            {t.in("web", "Sign in with Apple")}
          </KWButton>
        </SettingsRow>
      )}
    </SettingsSection>
  )
}
