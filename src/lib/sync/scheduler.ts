import { db } from "@/lib/db"

import { statusAfter, syncOnce, type SyncStatus } from "./engine"
import type { SyncTransport } from "./transport"

const DEBOUNCE_MS = 2_000
const PERIODIC_MS = 60_000
const MAX_BACKOFF_MS = 5 * 60_000

/**
 * When to sync: on start, when the network or the tab comes back, a moment after each local change,
 * and every minute while open. One round at a time. Errors back off exponentially; `needs_plan` and
 * a lost session stop the loop until `resume()` (after GET /me changes or the person signs in).
 */
export class SyncScheduler {
  private status: SyncStatus = { state: "idle", lastSyncAt: null, pending: 0 }
  private listeners = new Set<(status: SyncStatus) => void>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private running = false
  private again = false
  private failures = 0
  private halted = false
  private cleanup: (() => void)[] = []

  constructor(private readonly transport: SyncTransport) {}

  start() {
    const soon = () => this.schedule(DEBOUNCE_MS)
    const now = () => this.schedule(0)
    const visible = () => document.visibilityState === "visible" && now()
    window.addEventListener("online", now)
    document.addEventListener("visibilitychange", visible)
    const hook = () => soon()
    db.sync_outbox.hook("creating", hook)
    const periodic = setInterval(now, PERIODIC_MS)
    this.cleanup = [
      () => window.removeEventListener("online", now),
      () => document.removeEventListener("visibilitychange", visible),
      () => db.sync_outbox.hook("creating").unsubscribe(hook),
      () => clearInterval(periodic),
    ]
    now()
  }

  stop() {
    for (const undo of this.cleanup) undo()
    clearTimeout(this.timer)
  }

  resume() {
    this.halted = false
    this.failures = 0
    this.schedule(0)
  }

  subscribe(listener: (status: SyncStatus) => void) {
    this.listeners.add(listener)
    listener(this.status)
    return () => void this.listeners.delete(listener)
  }

  private publish(status: SyncStatus) {
    this.status = status
    for (const listener of this.listeners) listener(status)
  }

  private schedule(delay: number) {
    if (this.halted) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.run(), delay)
  }

  private async run() {
    if (this.running) {
      this.again = true
      return
    }
    this.running = true
    this.publish({ state: "syncing" })
    let error: unknown
    try {
      await syncOnce(this.transport)
      this.failures = 0
    } catch (caught) {
      error = caught
    }
    const status = await statusAfter(error)
    this.running = false
    this.publish(status)
    if (status.state === "needs_plan" || status.state === "signed_out") {
      this.halted = true
      return
    }
    if (error !== undefined) {
      this.failures++
      this.schedule(Math.min(MAX_BACKOFF_MS, 2_000 * 2 ** this.failures))
    } else if (this.again) {
      this.again = false
      this.schedule(0)
    }
  }
}
