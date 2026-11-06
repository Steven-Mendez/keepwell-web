import type { EntityTable } from "dexie"

import { db, type AuditColumns, type SyncEntity, type SyncOperation } from "@/lib/db"
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

/** Must run inside the caller's `db.transaction`, so the change and its event commit together. */
export async function enqueue(entity: SyncEntity, entityId: string, operation: SyncOperation, payload: unknown, at: string) {
  await db.sync_outbox.add({
    id: crypto.randomUUID(),
    entity,
    entity_id: entityId,
    operation,
    payload,
    created_at: at,
  })
}

/**
 * Inserts or replaces the record with the same id in one transaction with its outbox event. A save
 * keeps `created_at`, stamps `updated_at` and brings a deleted record back, as iOS does.
 */
export async function upsert<Row extends AuditColumns & { id: string }>(
  table: EntityTable<Row, "id">,
  entity: SyncEntity,
  columns: Omit<Row, keyof AuditColumns>,
): Promise<Row> {
  return db.transaction("rw", table, db.sync_outbox, async () => {
    const now = nowIso()
    const existing = await table.where("id").equals(columns.id).first()
    const row = { ...columns, created_at: existing?.created_at ?? now, updated_at: now, deleted_at: null } as Row
    await table.put(row)
    await enqueue(entity, row.id, existing ? "update" : "create", row, now)
    return row
  })
}

/** Leaves a tombstone instead of removing the row, so the deletion can reach other devices. */
export async function softDelete<Row extends AuditColumns & { id: string }>(
  table: EntityTable<Row, "id">,
  entity: SyncEntity,
  id: string,
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
