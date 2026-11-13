import type { Table } from "dexie"

import { makeBackup, type Backup } from "@/lib/backup/format"
import { db, LOCAL_SETTINGS_COLUMNS, SYNC_TABLES, toWire, type SettingsRow } from "@/lib/db"
import { shippedCategory, SYNC_ENTITIES, type SyncEntity } from "@/lib/schema"
import { USER_DATA_ENTITIES } from "@/lib/sync/first-sync"

import { enqueue, stampAfter } from "./shared"

type StoredRow = Record<string, unknown> & { id: string; updated_at: string; deleted_at: string | null }

const table = (entity: SyncEntity) => db.table(SYNC_TABLES[entity]) as Table<StoredRow, string>
const syncedTables = () => SYNC_ENTITIES.map(table)

/** Settings first, so the currencies arrive before any movement in them; then parents before children. */
const IMPORT_ORDER: readonly SyncEntity[] = ["settings", ...SYNC_ENTITIES.filter((entity) => entity !== "settings")]

/** An import into a ledger that already holds the person's data (see `ledgerIsEmpty`). */
export class LedgerNotEmptyError extends Error {
  override readonly name = "LedgerNotEmptyError"

  constructor() {
    super("A backup can only be restored into an empty ledger")
  }
}

/** Every synced row in this browser, tombstones included, as it travels. */
export async function exportBackup(now: Date = new Date()): Promise<Backup> {
  return db.transaction("r", syncedTables(), async () => {
    const rows: Partial<Record<SyncEntity, Record<string, unknown>[]>> = {}
    for (const entity of SYNC_ENTITIES) rows[entity] = (await table(entity).toArray()).map((row) => toWire(entity, row))
    return makeBackup(rows, now.toISOString())
  })
}

/**
 * An empty ledger, the only one a backup may be restored into (decided 2026-11-12, no merge, no
 * replace):
 * - no row at all, alive or deleted, of the person's data (`USER_DATA_ENTITIES`: accounts, cards,
 *   movements, recurring rules, goals, loans and their payments, debts and their repayments,
 *   categorization rules). A tombstone counts: it means the ledger had that data, and the deletion
 *   would win over the backup's row of the same id;
 * - no category but the shipped defaults (a created one, alive or deleted, counts as data). The
 *   defaults are seeded on every device, so they don't count, edited or deleted: the backup's version
 *   of each replaces them;
 * - settings and notification states never count: the backup's replace them (settings keep this
 *   device's own columns).
 * What "Delete all my data" leaves, and a fresh onboarding that skips adding accounts, are empty.
 */
export async function ledgerIsEmpty(): Promise<boolean> {
  for (const entity of USER_DATA_ENTITIES) {
    if ((await table(entity).count()) > 0) return false
  }
  const categoryIds = await db.categories.toCollection().primaryKeys()
  return categoryIds.every((id) => shippedCategory(id) !== undefined)
}

/**
 * Restores a parsed backup (`parseBackup`) through the same path as a local edit: in one transaction
 * every row is written with its outbox event, so sync pushes it like any change made here. Each row
 * is stamped now (after the stored and the backup's `updated_at`), so the account takes it over
 * whatever it holds for the same id; `created_at` and `deleted_at` stay as in the backup. Throws
 * `LedgerNotEmptyError` (checked inside the transaction) and writes nothing when the ledger isn't empty.
 */
export async function importBackup(backup: Backup, now: number = Date.now()): Promise<void> {
  await db.transaction("rw", [...syncedTables(), db.sync_outbox], async () => {
    if (!(await ledgerIsEmpty())) throw new LedgerNotEmptyError()
    const at = new Date(now).toISOString()
    for (const entity of IMPORT_ORDER) {
      for (const incoming of backup.entities[entity] as StoredRow[]) {
        const existing = await table(entity).get(incoming.id)
        const later = existing && existing.updated_at > incoming.updated_at ? existing.updated_at : incoming.updated_at
        let row: StoredRow = { ...incoming, updated_at: stampAfter(later, now) }
        if (entity === "settings") row = restoredSettings(row, existing as SettingsRow | undefined)
        await table(entity).put(row)
        await enqueue(entity, row.id, row.deleted_at ? "delete" : existing ? "update" : "create", row, at)
      }
    }
  })
}

/** The backup's synced settings over this device's own columns; onboarding done if it was on either side. */
function restoredSettings(incoming: StoredRow, existing: SettingsRow | undefined): StoredRow {
  const defaults = { unlock_method: "biometrics", relock_after_seconds: 60, hides_amounts_in_app_switcher: true, is_icloud_backup_enabled: true }
  const local = Object.fromEntries(LOCAL_SETTINGS_COLUMNS.map((column) => [column, existing?.[column]]).filter(([, value]) => value !== undefined))
  const onboarded = incoming.has_completed_onboarding === true || existing?.has_completed_onboarding === true
  return { ...defaults, ...local, ...incoming, has_completed_onboarding: onboarded }
}
