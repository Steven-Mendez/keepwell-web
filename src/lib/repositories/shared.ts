import type { EntityTable, Table } from "dexie"

import {
  db,
  LOCAL_SETTINGS_COLUMNS,
  SYNC_TABLES,
  toWire,
  type AuditColumns,
  type SettingsRow,
  type SyncEntity,
  type SyncOperation,
} from "@/lib/db"
import { newID } from "@/lib/platform/uuid"
import { nowIso } from "@/lib/schema"

/** Like iOS `DomainError.notFound`: a delete never succeeds silently on a missing or deleted record. */
export class NotFoundError extends Error {
  override readonly name = "NotFoundError"

  constructor(readonly id: string) {
    super(`No record with id ${id}`)
  }
}

export function isAlive(row: AuditColumns): boolean {
  return row.deleted_at === null
}

/**
 * Must run inside the caller's `db.transaction`, so the change and its event commit together. The
 * payload is the row as it travels (`toWire`): settings leave their device-only columns behind.
 */
export async function enqueue(entity: SyncEntity, entityId: string, operation: SyncOperation, row: object, at: string) {
  await db.sync_outbox.add({
    id: newID(),
    entity,
    entity_id: entityId,
    operation,
    payload: toWire(entity, row),
    created_at: at,
  })
}

/**
 * Inserts or replaces the record with the same id in one transaction with its outbox event. A save
 * keeps `created_at` and stamps `updated_at`. A deleted record stays deleted ("delete wins", ADR
 * 0005): saving it again is refused, as the server would refuse it from any device.
 */
export async function upsert<Row extends AuditColumns & { id: string }>(
  table: EntityTable<Row, "id">,
  entity: SyncEntity,
  columns: Omit<Row, keyof AuditColumns>
): Promise<Row> {
  return db.transaction("rw", table, db.sync_outbox, async () => {
    const now = nowIso()
    const existing = await table.where("id").equals(columns.id).first()
    if (existing && !isAlive(existing)) throw new NotFoundError(columns.id)
    const row = {
      ...columns,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      deleted_at: null,
    } as Row
    await table.put(row)
    await enqueue(entity, row.id, existing ? "update" : "create", row, now)
    return row
  })
}

/** Leaves a tombstone instead of removing the row, so the deletion can reach other devices. */
export async function softDelete<Row extends AuditColumns & { id: string }>(
  table: EntityTable<Row, "id">,
  entity: SyncEntity,
  id: string
): Promise<void> {
  await db.transaction("rw", table, db.sync_outbox, async () => {
    const existing = await table.where("id").equals(id).first()
    if (!existing || !isAlive(existing)) throw new NotFoundError(id)
    const now = nowIso()
    const row = { ...existing, updated_at: now, deleted_at: now }
    await table.put(row)
    await enqueue(entity, id, "delete", row, now)
  })
}

/**
 * Brings a parent's child rows (a loan's payments, a debt's repayments) to `rows`: new or changed
 * ones are saved, alive ones no longer listed are deleted, unchanged ones aren't touched (no event).
 * Each child is its own row and event, so two devices adding different children never collide.
 */
export async function syncChildren<Row extends AuditColumns & { id: string }>(
  table: EntityTable<Row, "id">,
  entity: SyncEntity,
  current: Row[],
  rows: Omit<Row, keyof AuditColumns>[]
): Promise<void> {
  const wanted = new Map(rows.map((row) => [row.id, row]))
  for (const row of rows) {
    const existing = current.find((candidate) => candidate.id === row.id)
    if (existing && !isAlive(existing)) continue
    const changed = !existing || Object.entries(row).some(([key, value]) => JSON.stringify(existing[key as keyof Row]) !== JSON.stringify(value))
    if (changed) await upsert(table, entity, row)
  }
  for (const existing of current) {
    if (isAlive(existing) && !wanted.has(existing.id)) await softDelete(table, entity, existing.id)
  }
}

export type RemoteResult = "applied" | "ignored"

/**
 * Applies a row that came from the server, without writing to the outbox: the silent write path.
 * Using `upsert` here would push the change straight back (an echo between devices).
 *
 * The server has already arbitrated, so its row wins (ADR 0005), with two exceptions: a local
 * tombstone stays final, and the sync engine never calls this for a row with a pending local
 * change (that change's push settles it). Settings only take the synced columns.
 */
export async function applyRemote(entity: SyncEntity, incoming: Record<string, unknown> & { id: string; updated_at: string; deleted_at: string | null }): Promise<RemoteResult> {
  const table = (db as unknown as Record<string, Table<Record<string, unknown> & AuditColumns, string>>)[SYNC_TABLES[entity]]!
  return db.transaction("rw", table, async () => {
    const existing = await table.get(incoming.id)
    if (existing && existing.deleted_at !== null) return "ignored"
    if (entity === "settings") {
      const local = Object.fromEntries(LOCAL_SETTINGS_COLUMNS.map((column) => [column, (existing as SettingsRow | undefined)?.[column]]))
      const defaults = { unlock_method: "biometrics", relock_after_seconds: 60, hides_amounts_in_app_switcher: true, is_icloud_backup_enabled: true }
      await table.put({ ...defaults, ...Object.fromEntries(Object.entries(local).filter(([, v]) => v !== undefined)), ...incoming } as never)
      return "applied"
    }
    await table.put(incoming as never)
    return "applied"
  })
}
