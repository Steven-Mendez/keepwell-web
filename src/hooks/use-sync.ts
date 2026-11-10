"use client"

import { useEffect, useState } from "react"

import { rejectedEvents, type RejectedEvent, type SyncStatus } from "@/lib/sync/engine"
import { SyncScheduler } from "@/lib/sync/scheduler"
import { httpTransport } from "@/lib/sync/transport"

let scheduler: SyncScheduler | undefined
/** Mounted hooks that want sync; when the last one goes (onboarding, signed out) sync pauses. */
let holders = 0

/** The tab's one scheduler, created (not started) on first use. */
export function syncScheduler(): SyncScheduler {
  scheduler ??= new SyncScheduler(httpTransport)
  return scheduler
}

let started = false

/**
 * Keeps sync running while mounted for `userId` (a signed-in account with `cloud_sync`), and
 * returns its status. `undefined` neither starts it nor reports anything.
 */
export function useSync(userId: string | undefined): { status: SyncStatus | undefined; rejected: RejectedEvent[] } {
  const [status, setStatus] = useState<SyncStatus>()
  const [rejected, setRejected] = useState<RejectedEvent[]>([])

  useEffect(() => {
    if (!userId) return
    const sync = syncScheduler()
    sync.setUser(userId)
    holders++
    if (!started) {
      started = true
      sync.start()
    } else {
      sync.resume()
    }
    const unsubscribe = sync.subscribe((next) => {
      setStatus(next)
      if (next.state === "idle") void rejectedEvents().then(setRejected)
    })
    return () => {
      unsubscribe()
      holders--
      if (holders === 0) sync.pause()
    }
  }, [userId])

  return { status: userId ? status : undefined, rejected }
}
