import { db, SYNC_TABLES } from "@/lib/db"
import { applyRemote } from "@/lib/repositories/shared"
import { SYNC_ENTITIES, type SyncEntity } from "@/lib/schema"

import { getClientId } from "./client-id"
import { ApiError, type PushResult, type SyncTransport } from "./transport"

// The web's sync loop (ADR 0005 in keepwell-api): push the outbox, then pull. The outbox already
// holds every local change, written in the same transaction as the change itself.

const CURSOR = "sync_cursor"
const REJECTED = "sync_rejected"
const LAST_SYNC = "sync_last_at"
const PUSH_BATCH = 200
const MAX_REJECTED_KEPT = 50

export type SyncStatus =
  | { state: "idle"; lastSyncAt: string | null; pending: number }
  | { state: "syncing" }
  /** The account lacks `cloud_sync`; local use goes on, and nothing is retried until /me changes. */
  | { state: "needs_plan" }
  | { state: "signed_out" }
  | { state: "offline"; pending: number }
  | { state: "error"; message: string; requestId?: string }

export interface RejectedEvent {
  event_id: string
  entity: SyncEntity
  entity_id: string
  reason: string
  at: string
}

async function meta(key: string): Promise<string | undefined> {
  return (await db.meta.get(key))?.value
}

async function setMeta(key: string, value: string) {
  await db.meta.put({ key, value })
}

async function hasPending(entity: SyncEntity, entityId: string): Promise<boolean> {
  return (await db.sync_outbox.where("entity_id").equals(entityId).filter((event) => event.entity === entity).count()) > 0
}

/** Adopts the server's answer for a row unless a newer local change for it is still waiting. */
async function adopt(entity: SyncEntity, entityId: string, change: (row: Record<string, unknown>) => Record<string, unknown> | undefined) {
  if (await hasPending(entity, entityId)) return
  const table = db.table(SYNC_TABLES[entity])
  const existing = (await table.get(entityId)) as Record<string, unknown> | undefined
  const next = change(existing ?? {})
  if (next) await applyRemote(entity, next as never)
}

export async function rejectedEvents(): Promise<RejectedEvent[]> {
  return JSON.parse((await meta(REJECTED)) ?? "[]") as RejectedEvent[]
}

export async function pendingCount(): Promise<number> {
  return db.sync_outbox.count()
}

/** One full round: push everything pending, then pull until caught up. Throws ApiError as is. */
export async function syncOnce(transport: SyncTransport): Promise<{ pushed: number; pulled: number }> {
  const clientId = await getClientId()
  let pushed = 0
  for (;;) {
    const events = await db.sync_outbox.orderBy("created_at").limit(PUSH_BATCH).toArray()
    if (events.length === 0) break
    const { results, partial } = await transport.push({
      client_id: clientId,
      platform: "web",
      events: events.map((event) => ({ event_id: event.id, entity: event.entity, entity_id: event.entity_id, operation: event.operation, payload: event.payload, created_at: event.created_at })),
    })
    const byId = new Map(events.map((event) => [event.id, event]))
    const rejected: RejectedEvent[] = []
    for (const result of results) {
      const event = byId.get(result.event_id)
      if (!event) continue
      // Every answered event leaves the outbox, rejected ones included: retrying them forever would
      // block everything behind. They stay listed in settings with the reason.
      await db.sync_outbox.delete(event.id)
      await settle(event.entity, event.entity_id, result)
      if (result.status === "rejected") rejected.push({ event_id: event.id, entity: event.entity, entity_id: event.entity_id, reason: result.reason ?? "rejected", at: new Date().toISOString() })
      pushed++
    }
    if (rejected.length > 0) await setMeta(REJECTED, JSON.stringify([...rejected, ...(await rejectedEvents())].slice(0, MAX_REJECTED_KEPT)))
    if (partial || results.length < events.length) break
  }

  let pulled = 0
  let cursorText = await meta(CURSOR)
  if (cursorText === undefined) {
    // A new installation (or one that lost its cursor): load today's state, then follow from there.
    let serverSeq = Infinity
    for (const entity of SYNC_ENTITIES) {
      let after = ""
      for (;;) {
        const page = await transport.snapshot(entity, after)
        serverSeq = Math.min(serverSeq, page.server_seq)
        for (const row of page.rows) {
          await adopt(entity, row.id, () => row)
          pulled++
        }
        if (!page.next_after) break
        after = page.next_after
      }
    }
    // The lowest sequence any page reflected: changes after it are pulled again, which is harmless.
    cursorText = String(serverSeq === Infinity ? 0 : serverSeq)
    await setMeta(CURSOR, cursorText)
  }

  let cursor = Number(cursorText)
  for (;;) {
    const page = await transport.pull(clientId, cursor)
    for (const change of page.changes) {
      await adopt(change.entity, change.entity_id, () => change.row)
      pulled++
    }
    cursor = page.next_cursor
    // Saved only after the page is applied: a crash midway pulls the page again.
    await setMeta(CURSOR, String(cursor))
    if (!page.has_more) break
  }
  await setMeta(LAST_SYNC, new Date().toISOString())
  return { pushed, pulled }
}

async function settle(entity: SyncEntity, entityId: string, result: PushResult) {
  if (result.current) {
    const current = result.current
    await adopt(entity, entityId, () => current)
  } else if (result.status === "applied" && result.updated_at) {
    const updatedAt = result.updated_at
    await adopt(entity, entityId, (row) => (row.id && row.updated_at !== updatedAt ? { ...row, updated_at: updatedAt } : undefined))
  }
}

/** Status for the UI, from an error the loop got (or none). */
export async function statusAfter(error: unknown): Promise<SyncStatus> {
  if (error === undefined) return { state: "idle", lastSyncAt: (await meta(LAST_SYNC)) ?? null, pending: await pendingCount() }
  if (error instanceof ApiError) {
    if (error.status === 403 && error.code === "needs_plan") return { state: "needs_plan" }
    if (error.status === 401) return { state: "signed_out" }
    if (error.status === 0 && error.code !== "no_api") return { state: "offline", pending: await pendingCount() }
    return { state: "error", message: error.message, ...(error.requestId ? { requestId: error.requestId } : {}) }
  }
  return { state: "offline", pending: await pendingCount() }
}
