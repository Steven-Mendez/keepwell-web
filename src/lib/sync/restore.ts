import type { Me } from "@/lib/api/account"
import { settingsRepository } from "@/lib/repositories"

import { DEFAULT_SETTINGS } from "@/lib/schema"

import { ChoiceNeeded, cloudCounts, localCounts, syncOnce } from "./engine"
import { hasUserData } from "./first-sync"
import type { SyncTransport } from "./transport"

/** What the welcome's restore found. */
export type RestoreResult = "restored" | "no-data" | "failed"

/**
 * Signing in on the welcome. Looks at the account's data before anything syncs: with the person's
 * data there (accounts, movements…, not just the categories and settings every device seeds) it
 * comes down into this browser, onboarding is marked complete (the data proves the setup was done,
 * even if the flag came down false) and the result is "restored". An account without data (or
 * without cloud sync) is "no-data": onboarding runs in full and what it saves syncs up afterwards
 * (AppShell's sync). Offline or a server error is "failed", never "no-data": the person is asked to
 * try again instead of being dropped into onboarding.
 */
export async function restoreFromAccountResult(me: Pick<Me, "user" | "capabilities">, transport: SyncTransport): Promise<RestoreResult> {
  if (!me.capabilities.includes("cloud_sync")) return "no-data"
  try {
    if (!hasUserData(await cloudCounts(transport))) return "no-data"
    await syncOnce(transport, { userId: me.user.id })
  } catch (error) {
    // A first sync that waits for the person's choice (this browser has data too) isn't a failure:
    // the data is here, and the setup is done as far as the checks below go.
    if (!(error instanceof ChoiceNeeded)) return "failed"
  }
  // The download may have been skipped (this browser already synced with the account): only call it
  // restored when user data is here.
  if (!hasUserData(await localCounts())) return "failed"
  const settings = await settingsRepository.load()
  if (!settings?.hasCompletedOnboarding) await settingsRepository.save({ ...(settings ?? DEFAULT_SETTINGS), hasCompletedOnboarding: true })
  return "restored"
}

/** `restoreFromAccountResult` as the old boolean: the account's data is here and the setup is done. */
export async function restoreFromAccount(me: Pick<Me, "user" | "capabilities">, transport: SyncTransport): Promise<boolean> {
  return (await restoreFromAccountResult(me, transport)) === "restored"
}
