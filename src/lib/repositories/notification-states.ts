import { db, type NotificationStateRow } from "@/lib/db"
import { NOTIFICATION_STATE_RETENTION_DAYS, notificationDay } from "@/lib/domain/notifications"
import { deviceTimeZone } from "@/lib/platform/time-zone"
import { nowIso } from "@/lib/schema"

import { enqueue, isAlive, stampAfter } from "./shared"

/** What the person did with a notification; absent means unread and in the inbox. */
export interface NotificationState {
  id: string
  readAt?: string
  dismissedAt?: string
}

const toState = (row: NotificationStateRow): NotificationState => ({
  id: row.id,
  ...(row.read_at ? { readAt: row.read_at } : {}),
  ...(row.dismissed_at ? { dismissedAt: row.dismissed_at } : {}),
})

const tables = () => [db.notification_states, db.sync_outbox]

type Change = Partial<Pick<NotificationStateRow, "read_at" | "dismissed_at">>

/** Applies `change` to each id's row, creating the row when the notification was never touched. */
async function apply(ids: readonly string[], change: (row: NotificationStateRow | undefined, now: string) => Change) {
  if (ids.length === 0) return
  await db.transaction("rw", tables(), async () => {
    const now = nowIso()
    for (const id of new Set(ids)) {
      const existing = await db.notification_states.get(id)
      const alive = existing && isAlive(existing) ? existing : undefined
      // A tombstone is final (ADR 0005); the id is long past and won't be computed again.
      if (existing && !alive) continue
      const patch = change(alive, now)
      const updatedAt = stampAfter(alive?.updated_at)
      const row: NotificationStateRow = {
        id,
        read_at: alive?.read_at ?? null,
        dismissed_at: alive?.dismissed_at ?? null,
        ...patch,
        created_at: alive?.created_at ?? now,
        updated_at: updatedAt,
        deleted_at: null,
      }
      if (alive && row.read_at === alive.read_at && row.dismissed_at === alive.dismissed_at) continue
      await db.notification_states.put(row)
      await enqueue("notificationState", id, alive ? "update" : "create", row, updatedAt)
    }
  })
}

export const notificationStateRepository = {
  async list(): Promise<NotificationState[]> {
    const rows = await db.notification_states.filter(isAlive).toArray()
    return rows.map(toState)
  },

  /** Keeps the first time it was read, so "read 3 days ago" doesn't move on every open. */
  markRead: (ids: readonly string[]) => apply(ids, (row, now) => ({ read_at: row?.read_at ?? now })),

  markUnread: (ids: readonly string[]) => apply(ids, () => ({ read_at: null })),

  /** Deleting also reads it: undoing the delete brings it back without the unread dot. */
  dismiss: (ids: readonly string[]) => apply(ids, (row, now) => ({ dismissed_at: now, read_at: row?.read_at ?? now })),

  restore: (ids: readonly string[]) => apply(ids, () => ({ dismissed_at: null })),

  /** Tombstones rows whose notification's day is long past; they would never match again. */
  async prune(now: Date = new Date()): Promise<void> {
    const limit = now.getTime() - NOTIFICATION_STATE_RETENTION_DAYS * 86_400_000
    await db.transaction("rw", tables(), async () => {
      const rows = await db.notification_states.filter(isAlive).toArray()
      for (const row of rows) {
        const day = notificationDay(row.id, deviceTimeZone())
        if (!day || day.getTime() >= limit) continue
        const stamp = stampAfter(row.updated_at)
        const tombstone = { ...row, updated_at: stamp, deleted_at: stamp }
        await db.notification_states.put(tombstone)
        await enqueue("notificationState", row.id, "delete", tombstone, stamp)
      }
    })
  },
}
