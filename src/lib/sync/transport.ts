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

export const httpTransport: SyncTransport = {
  push: (body) => api("/sync/push", { method: "POST", body: JSON.stringify(body) }),
  pull: (clientId, cursor) => api(`/sync/pull?client_id=${clientId}&cursor=${cursor}&limit=500`),
  snapshot: (entity, after) => api(`/sync/snapshot?entity=${entity}&after=${encodeURIComponent(after)}&limit=500`),
}

export { ApiError }
