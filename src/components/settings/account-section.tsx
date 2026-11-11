"use client"

import { KeyRoundIcon, LogOutIcon, RefreshCwIcon } from "lucide-react"
import { useState } from "react"

import { openSyncChoice } from "@/components/app/sync-choice-dialog"
import { KWButton, KWButtonLink } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { toast } from "@/components/ui/toast"
import type { AccountState } from "@/hooks/use-account"
import { signOutEverywhere, type Me } from "@/lib/api/account"
import { accountErrorCode, describeAccountError } from "@/lib/api/account-errors"
import { addPasskey, passkeysSupported } from "@/lib/api/passkeys"
import { syncScheduler } from "@/hooks/use-sync"
import type { Translator } from "@/lib/i18n"
import { relativeTime } from "@/lib/presentation/relative-time"
import type { RejectedEvent, SyncStatus } from "@/lib/sync/engine"
import { cn } from "@/lib/utils"

import { SettingsLinkRow, SettingsRow, SettingsSection } from "./settings-rows"

/** Runs an account call with a busy flag, refreshing /me after and toasting what went wrong. */
export function useAccountAction(t: Translator, refresh: () => void) {
  const [busy, setBusy] = useState(false)
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await work()
      refresh()
    } catch (error) {
      toast.add({
        title: describeAccountError(accountErrorCode(error), t, t.in("web", "Couldn't complete that. Try again.")).message,
        type: "error",
      })
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}

export type AccountRun = ReturnType<typeof useAccountAction>

export const canSync = (me: Me | undefined) => me?.capabilities.includes("cloud_sync") ?? false

/** The sync state in one sentence, for the sync row. */
function syncDescription(t: Translator, me: Me, sync: SyncStatus | undefined): string {
  if (!canSync(me) || sync?.state === "needs_plan")
    return t.in("web", "Sync isn't included in your plan. Get it with the coffee in Keepwell for iPhone; everything keeps working in this browser.")
  if (sync?.state === "needs_choice") return t.in("cloudaccount", "Sync is paused until you choose.")
  if (sync?.state === "offline") return t.in("cloudaccount", "Offline. Changes sync when you're back online.")
  if (sync?.state === "error") return t.in("cloudaccount", "Couldn't sync. Keepwell will try again.")
  if (sync?.state === "syncing") return t.in("cloudaccount", "Syncing…")
  if (sync?.state === "idle" && sync.lastSyncAt) return t.in("cloudaccount", "Last synced %@", relativeTime(sync.lastSyncAt, new Date(), t.locale))
  return t.in("cloudaccount", "Synced")
}

/** A short state for the header's pill. */
function syncPill(t: Translator, me: Me, sync: SyncStatus | undefined): { text: string; tone: "positive" | "pending" | "neutral" } {
  if (!canSync(me) || sync?.state === "needs_plan") return { text: t.in("cloudaccount", "Sync off"), tone: "neutral" }
  if (sync?.state === "needs_choice") return { text: t.in("cloudaccount", "Sync paused"), tone: "pending" }
  if (sync?.state === "offline") return { text: t.in("cloudaccount", "Offline"), tone: "pending" }
  if (sync?.state === "error") return { text: t.in("cloudaccount", "Couldn't sync"), tone: "pending" }
  if (sync?.state === "syncing" || sync === undefined) return { text: t.in("cloudaccount", "Syncing…"), tone: "neutral" }
  return { text: t.in("cloudaccount", "Synced"), tone: "positive" }
}

/** A state on its 14 % tint, as iOS shows state next to a value. */
export function StatusPill({ tone, children }: { tone: "positive" | "pending" | "neutral"; children: React.ReactNode }) {
  const look = { positive: "bg-positive-tint text-positive", pending: "bg-pending-tint text-pending", neutral: "bg-secondary text-muted-foreground" }[tone]
  return <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 type-caption font-semibold whitespace-nowrap", look)}>{children}</span>
}

function Avatar({ name }: { name: string | undefined }) {
  const initial = name?.trim().charAt(0).toUpperCase()
  return (
    <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground type-heading" aria-hidden>
      {initial || <KWIcon name="person" size={24} />}
    </span>
  )
}

/**
 * The top of Settings (Mobbin: Wise, Monarch): who this is and whether the data syncs. Signed in, the
 * account's name, email and sync state; local only, the invitation to sign in; a build without an
 * API, the name for the greeting and where the data lives.
 */
export function AccountHeader({ t, state, sync, preferredName }: { t: Translator; state: AccountState; sync: SyncStatus | undefined; preferredName: string | undefined }) {
  if (state.status === "signed-in") {
    const { user } = state.me
    const pill = syncPill(t, state.me, sync)
    return (
      <div className="flex items-center gap-4 rounded-[var(--radius-surface)] bg-card p-4 sm:p-5">
        <Avatar name={user.name || preferredName || user.email} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate type-heading text-foreground">{user.name || preferredName || user.email}</p>
          <p className="truncate type-caption text-muted-foreground">{user.email}</p>
        </div>
        <StatusPill tone={pill.tone}>{pill.text}</StatusPill>
      </div>
    )
  }
  if (state.status === "unavailable") {
    return (
      <div className="flex items-center gap-4 rounded-[var(--radius-surface)] bg-card p-4 sm:p-5">
        <Avatar name={preferredName} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate type-heading text-foreground">{preferredName ?? "Keepwell"}</p>
          <p className="type-caption text-muted-foreground">{t.in("web", "Your data stays only in this browser.")}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius-surface)] bg-card p-4 sm:p-5">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground" aria-hidden>
        <KWIcon name="cloud" size={24} />
      </span>
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
        <p className="type-heading text-foreground">{t.in("cloudaccount", "Sign in to sync")}</p>
        <p className="type-caption leading-snug text-muted-foreground">
          {state.status === "error" ? t.in("cloudaccount", "Couldn't reach Keepwell. Try again.") : t.in("web", "Sync this browser with Keepwell for iPhone. Without an account, your data stays only here.")}
        </p>
      </div>
      <KWButtonLink size="regular" href="/login" className="max-sm:w-full" aria-disabled={state.status === "loading"}>
        {t.in("web", "Sign in")}
      </KWButtonLink>
    </div>
  )
}

/** The sync rows of "Data & sync", for a signed-in account. */
export function SyncRows({ t, me, sync, rejected }: { t: Translator; me: Me; sync: SyncStatus | undefined; rejected: RejectedEvent[] }) {
  return (
    <>
      {sync?.state === "needs_choice" ? (
        <SettingsLinkRow icon="cloud" label={t.in("cloudaccount", "Choose which data to keep")} description={syncDescription(t, me, sync)} onClick={openSyncChoice} />
      ) : canSync(me) && sync?.state !== "needs_plan" ? (
        <SettingsLinkRow icon={<RefreshCwIcon strokeWidth={2} />} label={t.in("cloudaccount", "Sync now")} description={syncDescription(t, me, sync)} disabled={sync?.state === "syncing"} onClick={() => void syncScheduler().runNow()} />
      ) : (
        <SettingsRow icon="cloud" label={t.in("cloudaccount", "Sync")} description={syncDescription(t, me, sync)}>
          <StatusPill tone="neutral">{t.in("cloudaccount", "Off")}</StatusPill>
        </SettingsRow>
      )}
      {rejected.length > 0 ? (
        <SettingsRow icon="close" label={t.in("web", "Changes the server refused")} description={t.in("web", "%@ changes couldn't sync and stay only in this browser.", String(rejected.length))} />
      ) : null}
    </>
  )
}

/** Signing in with a passkey and ending every session (Wise's "Security and privacy"). */
export function SecuritySection({ t, action }: { t: Translator; action: AccountRun }) {
  const { busy, run } = action
  return (
    <SettingsSection id="security" title={t.in("settings", "Security")}>
      {passkeysSupported() ? (
        <SettingsRow icon={<KeyRoundIcon strokeWidth={2} />} label={t.in("web", "Passkey")} description={t.in("web", "Sign in with Face ID, Touch ID or your device's lock instead of Apple.")}>
          <KWButton variant="secondary" size="small" disabled={busy} onClick={() => void run(() => addPasskey("Keepwell"))}>
            {t.in("web", "Add a passkey")}
          </KWButton>
        </SettingsRow>
      ) : null}
      <SettingsRow icon={<LogOutIcon strokeWidth={2} />} label={t.in("cloudaccount", "Sign out on all devices")} description={t.in("cloudaccount", "Every iPhone and browser will need to sign in again.")}>
        <KWButton variant="secondary" size="small" disabled={busy} onClick={() => void run(signOutEverywhere)}>
          {t.in("cloudaccount", "Sign out everywhere")}
        </KWButton>
      </SettingsRow>
    </SettingsSection>
  )
}
