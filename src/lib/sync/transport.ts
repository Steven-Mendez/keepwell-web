import { api, ApiError } from "@/lib/api/client"
import type { SyncEntity } from "@/lib/schema"

export interface PushResult {
  event_id: string
  status: "applied" | "stale" | "rejected"
  reason?: string
  server_seq?: number
  updated_at?: string
  current?: Record<string, unknown> & { id: string; updated_at: string; deleted_at: string | null }
}

export interface PulledChange {
  server_seq: number
  entity: SyncEntity
  entity_id: string
  operation: "create" | "update" | "delete"
  row: Record<string, unknown> & { id: string; updated_at: string; deleted_at: string | null }
}

/** The three sync endpoints (ADR 0005 in keepwell-api). Injected so tests can run a fake server. */
export interface SyncTransport {
  push(body: { client_id: string; platform: "web"; events: unknown[] }): Promise<{ results: PushResult[]; partial: boolean }>
  pull(clientId: string, cursor: number): Promise<{ changes: PulledChange[]; next_cursor: number; has_more: boolean }>
  snapshot(entity: SyncEntity, after: string): Promise<{ rows: PulledChange["row"][]; server_seq: number; next_after: string | null }>
}

/** Statuses that mean "busy, try again": throttled, or the function couldn't start in time. */
const TRANSIENT = new Set([429, 502, 503, 504])
const RETRY_DELAYS_MS = [400, 1200, 3000]

/**
 * Reads that are safe to repeat, retried with backoff when the API is momentarily busy (a burst over
 * the function's concurrency answers 503). Push is never retried here: the engine owns its events.
 */
export async function withRetry<T>(read: () => Promise<T>, delays: readonly number[] = RETRY_DELAYS_MS): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await read()
    } catch (error) {
      const transient = error instanceof ApiError && TRANSIENT.has(error.status)
      const delay = delays[attempt]
      if (!transient || delay === undefined) throw error
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

export const httpTransport: SyncTransport = {
  push: (body) => api("/sync/push", { method: "POST", body: JSON.stringify(body) }),
  pull: (clientId, cursor) => withRetry(() => api(`/sync/pull?client_id=${clientId}&cursor=${cursor}&limit=500`)),
  snapshot: (entity, after) => withRetry(() => api(`/sync/snapshot?entity=${entity}&after=${encodeURIComponent(after)}&limit=500`)),
}

export { ApiError }
