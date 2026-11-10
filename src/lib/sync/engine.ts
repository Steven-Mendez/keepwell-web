import { db, SYNC_TABLES, toWire } from "@/lib/db"
import { applyRemote } from "@/lib/repositories/shared"
import { SYNC_ENTITIES, type SyncEntity } from "@/lib/schema"
import { newID } from "@/lib/schema/id"

import { getClientId } from "./client-id"
import { EMPTY_COUNTS, firstSyncDecision, USER_DATA_ENTITIES, type DataCounts, type PendingChoice } from "./first-sync"
import { ApiError, type PulledChange, type PushResult, type SyncTransport } from "./transport"

// The web's sync loop (ADR 0005 in keepwell-api): push the outbox, then pull. The outbox already
// holds every local change, written in the same transaction as the change itself.

const CURSOR = "sync_cursor"
const REJECTED = "sync_rejected"
const LAST_SYNC = "sync_last_at"
/** The account this browser syncs with; another account starts over with a first sync. */
const SYNC_USER = "sync_user"
/** A first sync found data on both sides and waits for the person (`PendingChoice` as JSON). */
const CHOICE = "sync_choice"
/** This browser's data was cleared for the account's and the download hasn't finished yet. */
const DOWNLOADING = "sync_downloading"
/** Everything about the sync with one account; `client_id` is this browser's and stays. */
const ACCOUNT_SYNC_KEYS = [CURSOR, REJECTED, LAST_SYNC, CHOICE, DOWNLOADING]
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
  /** First sync with data on both sides: paused (nothing pushed or pulled) until the person chooses. */
  | { state: "needs_choice"; choice: PendingChoice }

/** Thrown by `syncOnce` while a first sync waits for the person to keep one side. */
export class ChoiceNeeded extends Error {
  override readonly name = "ChoiceNeeded"

  constructor(readonly choice: PendingChoice) {
    super("Choose which data to keep")
  }
}

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

type Row = PulledChange["row"]

const SNAPSHOT_ORDER: readonly SyncEntity[] = ["settings", ...SYNC_ENTITIES.filter((entity) => entity !== "settings")]

/** Every row the account holds for each entity (tombstones too), and the sequence they reflect. */
async function cloudRows(transport: SyncTransport, entities: readonly SyncEntity[]): Promise<{ rows: Map<SyncEntity, Row[]>; serverSeq: number }> {
  const rows = new Map<SyncEntity, Row[]>()
  let serverSeq = Infinity
  for (const entity of entities) {
    const list: Row[] = []
    let after = ""
    for (;;) {
      const page = await transport.snapshot(entity, after)
      serverSeq = Math.min(serverSeq, page.server_seq)
      list.push(...page.rows)
      if (!page.next_after) break
      after = page.next_after
    }
    rows.set(entity, list)
  }
  return { rows, serverSeq: serverSeq === Infinity ? 0 : serverSeq }
}

/** The person's data in this browser: live rows per entity. */
export async function localCounts(): Promise<DataCounts> {
  const counts = { ...EMPTY_COUNTS }
  for (const entity of USER_DATA_ENTITIES) {
    counts[entity] = await db.table<{ deleted_at: string | null }>(SYNC_TABLES[entity]).filter((row) => row.deleted_at === null).count()
  }
  return counts
}

/** The person's data in the account, read from the snapshot without applying anything. */
export async function cloudCounts(transport: SyncTransport): Promise<DataCounts> {
  const { rows } = await cloudRows(transport, USER_DATA_ENTITIES)
  const counts = { ...EMPTY_COUNTS }
  for (const entity of USER_DATA_ENTITIES) counts[entity] = (rows.get(entity) ?? []).filter((row) => row.deleted_at === null).length
  return counts
}

export async function pendingChoice(): Promise<PendingChoice | undefined> {
  const text = await meta(CHOICE)
  return text ? (JSON.parse(text) as PendingChoice) : undefined
}

/**
 * Follows the signed-in account. A browser that synced before this was recorded keeps its cursor
 * (it can only have been this account); another account than the recorded one starts over.
 */
async function followUser(userId: string | undefined) {
  if (!userId) return
  const stored = await meta(SYNC_USER)
  if (stored === userId) return
  await db.transaction("rw", db.meta, async () => {
    if (stored !== undefined) await db.meta.bulkDelete(ACCOUNT_SYNC_KEYS)
    await setMeta(SYNC_USER, userId)
  })
}

const syncedTables = (withSettings: boolean) => SYNC_ENTITIES.filter((entity) => withSettings || entity !== "settings").map((entity) => db.table(SYNC_TABLES[entity]))

/**
 * Empties this browser's synced data and the outbox so the next round downloads the account's.
 * Settings stay until the account's arrive (a browser is never left without them); this device's
 * own things (client id, unlock and relock, hiding amounts, language, name) are untouched.
 */
async function clearForDownload() {
  await db.transaction("rw", [...syncedTables(false), db.sync_outbox, db.meta], async () => {
    for (const table of syncedTables(false)) await table.clear()
    await db.sync_outbox.clear()
    await db.meta.bulkDelete(ACCOUNT_SYNC_KEYS)
    await setMeta(DOWNLOADING, "1")
  })
}

/** One outbox event per stored row, so all of this browser's data goes up (parents first). */
async function enqueueEverything() {
  await db.transaction("rw", [...syncedTables(true), db.sync_outbox], async () => {
    await db.sync_outbox.clear()
    const base = Date.now()
    let sequence = 0
    for (const entity of SYNC_ENTITIES) {
      for (const row of (await db.table(SYNC_TABLES[entity]).toArray()) as Row[]) {
        await db.sync_outbox.add({ id: newID(), entity, entity_id: row.id, operation: row.deleted_at ? "delete" : "create", payload: toWire(entity, row), created_at: new Date(base + sequence++).toISOString() })
      }
    }
  })
}

/**
 * Decides the first sync with an account (no cursor yet) before anything moves: only one side with
 * data syncs on its own; both sides with data pause sync until the person chooses (`ChoiceNeeded`).
 */
async function beginFirstSync(transport: SyncTransport, userId: string | undefined) {
  // A download that stopped halfway starts again: what came down so far is the account's, not ours.
  if (await meta(DOWNLOADING)) return clearForDownload()
  const waiting = await pendingChoice()
  if (waiting) throw new ChoiceNeeded(waiting)
  const local = await localCounts()
  const cloud = await cloudCounts(transport)
  const decision = firstSyncDecision(local, cloud)
  if (decision === "choose") {
    const choice: PendingChoice = { userId: userId ?? null, local, cloud }
    await setMeta(CHOICE, JSON.stringify(choice))
    throw new ChoiceNeeded(choice)
  }
  // Only the account has data: nothing this browser seeded (default categories) may overwrite it.
  if (decision === "download") await clearForDownload()
  // Otherwise every local row goes up, also rows an earlier account already took from the outbox.
  else await enqueueEverything()
}

/**
 * One sync at a time per tab, whoever starts it (the scheduler, the welcome's restore, the choice):
 * two first syncs at once would each see the other's half-downloaded rows as this browser's data.
 */
let queue: Promise<unknown> = Promise.resolve()
function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work)
  queue = run.catch(() => undefined)
  return run
}

/** "Use your account's data": this browser's data is replaced by the account's on the next round. */
export function takeAccountData(): Promise<void> {
  return exclusive(clearForDownload)
}

/** A moment after `at` and not before now, so a row sent to replace the account's is the newest. */
function laterThan(at: string, now: number): string {
  return new Date(Math.max(now, Date.parse(at) + 1)).toISOString()
}

/**
 * "Keep this browser's data": the account ends up holding exactly what is here. Through the normal
 * push: a delete for every live row of the account that this browser doesn't have alive, and every
 * local row sent again, stamped after the account's version of it so it wins (ADR 0005: a delete
 * always applies over a live row; otherwise the later `updated_at` wins). Other devices get the
 * deletions on their next pull. Sync goes on from the snapshot read here.
 */
export function keepBrowserData(transport: SyncTransport): Promise<void> {
  return exclusive(() => replaceAccountData(transport))
}

async function replaceAccountData(transport: SyncTransport): Promise<void> {
  const choice = await pendingChoice()
  const { rows: cloud, serverSeq } = await cloudRows(transport, SYNC_ENTITIES)
  await db.transaction("rw", [...syncedTables(true), db.sync_outbox, db.meta], async () => {
    await db.sync_outbox.clear()
    const now = Date.now()
    let sequence = 0
    const add = (entity: SyncEntity, row: Row, operation: "create" | "update" | "delete") =>
      db.sync_outbox.add({ id: newID(), entity, entity_id: row.id, operation, payload: toWire(entity, row), created_at: new Date(now + sequence++).toISOString() })
    for (const entity of SYNC_ENTITIES) {
      const table = db.table(SYNC_TABLES[entity])
      const theirs = new Map((cloud.get(entity) ?? []).map((row) => [row.id, row]))
      const local = (await table.toArray()) as Row[]
      const here = new Set(local.map((row) => row.id))
      for (const row of local) {
        const remote = theirs.get(row.id)
        if (row.deleted_at) {
          await add(entity, row, "delete")
          continue
        }
        const sent = remote ? { ...row, updated_at: laterThan(remote.updated_at, now) } : row
        if (sent !== row) await table.put(sent)
        await add(entity, sent, remote ? "update" : "create")
      }
      // The settings row is never deleted: this browser's replaces the account's above.
      if (entity === "settings") continue
      for (const remote of theirs.values()) {
        if (remote.deleted_at || here.has(remote.id)) continue
        const at = laterThan(remote.updated_at, now)
        await add(entity, { ...remote, updated_at: at, deleted_at: at }, "delete")
      }
    }
    await db.meta.bulkDelete([REJECTED, CHOICE])
    await setMeta(CURSOR, String(serverSeq))
    if (choice?.userId) await setMeta(SYNC_USER, choice.userId)
  })
}

/**
 * One full round: push everything pending, then pull until caught up. Throws ApiError as is, and
 * `ChoiceNeeded` while a first sync waits for the person. `userId` is the signed-in account.
 */
export function syncOnce(transport: SyncTransport, options: { userId?: string } = {}): Promise<{ pushed: number; pulled: number }> {
  return exclusive(() => syncRound(transport, options))
}

async function syncRound(transport: SyncTransport, options: { userId?: string }): Promise<{ pushed: number; pulled: number }> {
  await followUser(options.userId)
  if ((await meta(CURSOR)) === undefined) await beginFirstSync(transport, options.userId)
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
    // Settings first: movements in the account's currencies must never meet this browser's.
    for (const entity of SNAPSHOT_ORDER) {
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
    await db.meta.delete(DOWNLOADING)
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
  if (error instanceof ChoiceNeeded) return { state: "needs_choice", choice: error.choice }
  if (error === undefined) return { state: "idle", lastSyncAt: (await meta(LAST_SYNC)) ?? null, pending: await pendingCount() }
  if (error instanceof ApiError) {
    if (error.status === 403 && error.code === "needs_plan") return { state: "needs_plan" }
    if (error.status === 401) return { state: "signed_out" }
    if (error.status === 0 && error.code !== "no_api") return { state: "offline", pending: await pendingCount() }
    return { state: "error", message: error.message, ...(error.requestId ? { requestId: error.requestId } : {}) }
  }
  return { state: "offline", pending: await pendingCount() }
}
