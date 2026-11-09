import type { Transaction } from "dexie"

import { newID } from "@/lib/schema/id"
import { SYNC_ENTITIES } from "@/lib/schema"

import { SYNC_TABLES, toWire } from "./sync-wire"

/**
 * Replaces the outbox with one event per stored row, in the current wire format: alive rows as
 * `create`, tombstones as `delete`. Used by the version 6 upgrade, so the first push uploads exactly
 * today's state. Events are ordered parents first (accounts before cards before movements).
 */
export async function rebuildOutbox(tx: Transaction, at: string): Promise<void> {
  const outbox = tx.table("sync_outbox")
  await outbox.clear()
  let sequence = 0
  for (const entity of SYNC_ENTITIES) {
    const rows = (await tx.table(SYNC_TABLES[entity]).toArray()) as { id: string; deleted_at?: string | null }[]
    for (const row of rows) {
      // Same timestamp for all; a growing suffix keeps their order when sorted by created_at.
      const createdAt = new Date(new Date(at).getTime() + sequence++).toISOString()
      await outbox.add({
        id: newID(),
        entity,
        entity_id: row.id,
        operation: row.deleted_at ? "delete" : "create",
        payload: toWire(entity, row),
        created_at: createdAt,
      })
    }
  }
}
