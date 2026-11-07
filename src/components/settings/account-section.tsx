"use client"

import { useState } from "react"

import { KWButton } from "@/components/kw/design"
import { toast } from "@/components/ui/toast"
import { useAccount } from "@/hooks/use-account"
import { useSync } from "@/hooks/use-sync"
import {
  deleteAccount,
  signInWithApple,
  signOut,
  signOutEverywhere,
} from "@/lib/api/account"
import { ApiError } from "@/lib/api/client"
import { addPasskey, passkeysSupported, signInWithPasskey } from "@/lib/api/passkeys"
import type { Translator } from "@/lib/i18n"

import { ConfirmDialog } from "./confirm-dialog"
import { ConnectedAppsSection } from "./connected-apps-section"
import { SettingsRow, SettingsSection } from "./settings-rows"

/**
 * The Keepwell account, for builds that have an API. Local use never needs it: everything else in
 * settings works the same signed in or not.
 */
export function AccountSection({ t }: { t: Translator }) {
  const { state, refresh } = useAccount()
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const canSync =
    state.status === "signed-in" && state.me.capabilities.includes("cloud_sync")
  const { status: sync, rejected } = useSync(canSync)
  if (state.status === "unavailable") return null

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    try {
      await work()
      refresh()
    } catch (error) {
      toast.add({
        title:
          error instanceof ApiError && error.code === "NOT_INVITED"
            ? t.in("web", "Keepwell accounts are invite-only for now.")
            : t.in("web", "Couldn't reach Keepwell. Try again."),
        type: "error",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SettingsSection
        title={t.in("web", "Account")}
        footnote={t.in(
          "web",
          "An account syncs this browser with Keepwell for iPhone. Without one, your data stays only here."
        )}
      >
        {state.status === "signed-in" ? (
          <>
            <SettingsRow
              label={state.me.user.name || state.me.user.email}
              description={state.me.user.email}
            >
              <KWButton
                variant="secondary"
                size="small"
                disabled={busy}
                onClick={() => run(signOut)}
              >
                {t.in("web", "Sign out")}
              </KWButton>
            </SettingsRow>
            <SettingsRow
              label={t.in("web", "Sync")}
              description={
                !canSync || sync?.state === "needs_plan"
                  ? t.in(
                      "web",
                      "Sync isn't included in your plan. Everything keeps working in this browser."
                    )
                  : sync?.state === "offline"
                    ? t.in(
                        "web",
                        "Offline. Changes sync when you're back online."
                      )
                    : sync?.state === "error"
                      ? t.in("web", "Couldn't sync. Keepwell will try again.")
                      : sync?.state === "syncing"
                        ? t.in("web", "Syncing…")
                        : state.me.early_access.includes("cloud_sync")
                          ? t.in("web", "Sync included during early access.")
                          : t.in("web", "Up to date.")
              }
            />
            {rejected.length > 0 ? (
              <SettingsRow
                label={t.in("web", "Changes the server refused")}
                description={t.in(
                  "web",
                  "%@ changes couldn't sync and stay only in this browser.",
                  String(rejected.length)
                )}
              />
            ) : null}
            {passkeysSupported() ? (
              <SettingsRow
                label={t.in("web", "Passkey")}
                description={t.in(
                  "web",
                  "Sign in with Face ID, Touch ID or your device's lock instead of Apple."
                )}
              >
                <KWButton
                  variant="secondary"
                  size="small"
                  disabled={busy}
                  onClick={() => run(() => addPasskey("Keepwell"))}
                >
                  {t.in("web", "Add a passkey")}
                </KWButton>
              </SettingsRow>
            ) : null}
            <SettingsRow label={t.in("web", "Sign out on all devices")}>
              <KWButton
                variant="secondary"
                size="small"
                disabled={busy}
                onClick={() => run(signOutEverywhere)}
              >
                {t.in("web", "Sign out everywhere")}
              </KWButton>
            </SettingsRow>
            <SettingsRow
              label={t.in("web", "Delete account")}
              description={t.in(
                "web",
                "Erases your account and its synced data from Keepwell's servers."
              )}
            >
              <KWButton
                variant="destructive"
                size="small"
                disabled={busy}
                onClick={() => setConfirmingDelete(true)}
              >
                {t.in("web", "Delete account")}
              </KWButton>
            </SettingsRow>
            <ConfirmDialog
              open={confirmingDelete}
              onOpenChange={setConfirmingDelete}
              title={t.in("web", "Delete your Keepwell account?")}
              description={t.in(
                "web",
                "You're signed out everywhere at once and your synced data is erased from Keepwell's servers. Backups keep it up to 35 more days. What's in this browser stays here."
              )}
              action={t.in("web", "Delete account")}
              destructive
              onConfirm={() => run(async () => void (await deleteAccount()))}
            />
          </>
        ) : (
          <SettingsRow
            label={t.in("web", "Keepwell account")}
            description={
              state.status === "error"
                ? t.in("web", "Couldn't reach Keepwell. Try again.")
                : undefined
            }
          >
            <KWButton
              size="small"
              disabled={busy || state.status === "loading"}
              onClick={() => run(() => signInWithApple(window.location.href))}
            >
              {t.in("web", "Sign in with Apple")}
            </KWButton>
            {passkeysSupported() ? (
              <KWButton
                size="small"
                variant="secondary"
                disabled={busy || state.status === "loading"}
                onClick={() => run(() => signInWithPasskey())}
              >
                {t.in("web", "Use a passkey")}
              </KWButton>
            ) : null}
          </SettingsRow>
        )}
      </SettingsSection>
      {state.status === "signed-in" && state.me.capabilities.includes("mcp") ? (
        <ConnectedAppsSection t={t} />
      ) : null}
    </>
  )
}
