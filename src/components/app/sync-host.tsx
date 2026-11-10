"use client"

import { useAccount } from "@/hooks/use-account"
import { useSync } from "@/hooks/use-sync"

import { SyncChoiceDialog } from "./sync-choice-dialog"

/**
 * Sync for the whole app once it's set up: runs while a signed-in account has `cloud_sync`, and asks
 * which data to keep when the first sync finds data on both sides.
 */
export function SyncHost() {
  const { state } = useAccount()
  const userId = state.status === "signed-in" && state.me.capabilities.includes("cloud_sync") ? state.me.user.id : undefined
  const { status } = useSync(userId)
  return <SyncChoiceDialog status={status} />
}
