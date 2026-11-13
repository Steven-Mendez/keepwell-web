import { SYNC_ENTITIES, SYNC_WIRE, type SyncEntity, type SyncRow } from "@/lib/schema"

// The full backup (`keepwell-<date>.json`): every row of every synced entity, tombstones included,
// exactly as it travels to the server (the sync wire format, ADR 0005). keepwell-ios reads and writes
// the same file. Device-only settings (unlock, relock, hiding amounts, iCloud) and the preferred
// name never go in it, as they never sync.
//
// Version 1 holds sync format v1 rows. Version 2 adds `account.closed_at`: a column that changes what
// the person sees raises the version, so an app that predates it refuses the file instead of
// reopening closed accounts without a word. Version 3 adds merchants (their own entity, and the
// links on movements, recurring rules and categorization rules), which an older app would drop. This
// app reads all three (an older file has no closed accounts and no merchants) and refuses a version
// it doesn't know instead of dropping what it can't read.

export const BACKUP_FORMAT = "keepwell-backup"
export const BACKUP_VERSION = 3
/** The oldest version this app still reads. */
export const OLDEST_BACKUP_VERSION = 1

export type BackupRows = { [E in SyncEntity]: SyncRow<E>[] }

export interface Backup {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exported_at: string
  entities: BackupRows
}

/**
 * Why a file can't be imported. `not_backup`: not JSON, or JSON that isn't a Keepwell backup.
 * `newer_version`: made by a newer app. `invalid`: a Keepwell backup with a damaged row; `reason`
 * names the entity, row and field, never its value (it may be a description or an amount).
 */
export type BackupError = { code: "not_backup" } | { code: "newer_version"; version: number } | { code: "invalid"; reason: string }

export type ParsedBackup = { ok: true; backup: Backup } | { ok: false; error: BackupError }

export function makeBackup(rows: Partial<{ [E in SyncEntity]: readonly Record<string, unknown>[] }>, exportedAt: string): Backup {
  const entities = Object.fromEntries(SYNC_ENTITIES.map((entity) => [entity, [...(rows[entity] ?? [])]])) as unknown as BackupRows
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exported_at: exportedAt, entities }
}

export function serializeBackup(backup: Backup): string {
  return `${JSON.stringify(backup, null, 2)}\n`
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * Reads a backup file, all or nothing: one damaged row rejects the whole file. Every row is checked
 * with the sync wire schema the server uses (`SYNC_WIRE`), ids are unique per entity, and there is at
 * most one settings row. An entity missing from `entities` has no rows; an entity this version doesn't
 * know is damage, not something to skip.
 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: { code: "not_backup" } }
  }
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) return { ok: false, error: { code: "not_backup" } }
  const invalid = (reason: string): ParsedBackup => ({ ok: false, error: { code: "invalid", reason } })
  if (typeof raw.version !== "number" || !Number.isInteger(raw.version) || raw.version < OLDEST_BACKUP_VERSION) return invalid("version")
  if (raw.version > BACKUP_VERSION) return { ok: false, error: { code: "newer_version", version: raw.version } }
  if (typeof raw.exported_at !== "string") return invalid("exported_at")
  if (!isObject(raw.entities)) return invalid("entities")
  const unknown = Object.keys(raw.entities).find((key) => !(SYNC_ENTITIES as readonly string[]).includes(key))
  if (unknown !== undefined) return invalid(`entities: unknown entity ${JSON.stringify(unknown.slice(0, 40))}`)

  const rows: Partial<Record<SyncEntity, SyncRow[]>> = {}
  for (const entity of SYNC_ENTITIES) {
    const list = raw.entities[entity] ?? []
    if (!Array.isArray(list)) return invalid(`${entity}: not a list`)
    if (entity === "settings" && list.length > 1) return invalid("settings: more than one row")
    const seen = new Set<string>()
    const parsed: SyncRow[] = []
    for (const [index, row] of list.entries()) {
      const result = SYNC_WIRE[entity].safeParse(row)
      if (!result.success) {
        const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".") || "row"))].join(", ")
        return invalid(`${entity}[${index}]: ${fields}`)
      }
      const id = (result.data as { id: string }).id
      if (seen.has(id)) return invalid(`${entity}[${index}]: duplicate id`)
      seen.add(id)
      parsed.push(result.data as SyncRow)
    }
    rows[entity] = parsed
  }
  return { ok: true, backup: { format: BACKUP_FORMAT, version: BACKUP_VERSION, exported_at: raw.exported_at, entities: rows as BackupRows } }
}

/** Rows per entity, tombstones included: what an import writes. */
export function backupCounts(backup: Backup): Record<SyncEntity, number> {
  return Object.fromEntries(SYNC_ENTITIES.map((entity) => [entity, backup.entities[entity].length])) as Record<SyncEntity, number>
}
