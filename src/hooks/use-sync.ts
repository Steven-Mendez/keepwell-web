"use client"

import { useEffect, useState } from "react"

import { rejectedEvents, type RejectedEvent, type SyncStatus } from "@/lib/sync/engine"
import { SyncScheduler } from "@/lib/sync/scheduler"
import { httpTransport } from "@/lib/sync/transport"

let scheduler: SyncScheduler | undefined

/** One scheduler per tab, started once the account has `cloud_sync`. */
export function useSync(enabled: boolean): { status: SyncStatus | undefined; rejected: RejectedEvent[] } {
  const [status, setStatus] = useState<SyncStatus>()
  const [rejected, setRejected] = useState<RejectedEvent[]>([])

  useEffect(() => {
    if (!enabled) return
    if (!scheduler) {
      scheduler = new SyncScheduler(httpTransport)
      scheduler.start()
    } else {
      scheduler.resume()
    }
    return scheduler.subscribe((next) => {
      setStatus(next)
      if (next.state === "idle") void rejectedEvents().then(setRejected)
    })
  }, [enabled])

  return { status, rejected }
}
