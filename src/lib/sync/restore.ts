import type { Me } from "@/lib/api/account"
import { settingsRepository } from "@/lib/repositories"

import { cloudCounts, syncOnce } from "./engine"
import { hasUserData } from "./first-sync"
import type { SyncTransport } from "./transport"

/**
 * Signing in on the welcome. Looks at the account's data before anything syncs: with the person's
 * data there (accounts, movements…, not just the categories and settings every device seeds) it
 * comes down into this browser and `true` says there is nothing left to set up. An account without
 * data, offline or a server error leaves onboarding to run in full; what it saves syncs up
 * afterwards (AppShell's sync). Settings alone never end onboarding: they may come from a device
 * that finished its setup without entering anything.
 */
export async function restoreFromAccount(me: Pick<Me, "user" | "capabilities">, transport: SyncTransport): Promise<boolean> {
  if (!me.capabilities.includes("cloud_sync")) return false
  try {
    if (!hasUserData(await cloudCounts(transport))) return false
    await syncOnce(transport, { userId: me.user.id })
  } catch {
    return false
  }
  const settings = await settingsRepository.load()
  return settings?.hasCompletedOnboarding ?? false
}
