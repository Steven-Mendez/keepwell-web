import { parseBackup, serializeBackup, type BackupError } from "@/lib/backup/format"
import { exportBackup, importBackup, LedgerNotEmptyError } from "@/lib/repositories"

import { download, today } from "./csv-download"

/** Downloads the full backup (`keepwell-<date>.json`). Throws when the file can't be made. */
export async function downloadBackup(): Promise<void> {
  download(serializeBackup(await exportBackup()), `keepwell-${today()}.json`, "application/json")
}

export type RestoreOutcome = { ok: true } | { ok: false; error: BackupError | { code: "not_empty" } }

/** Reads a chosen file and restores it; nothing is written unless the whole file is valid and the ledger empty. */
export async function restoreBackupFile(file: Blob): Promise<RestoreOutcome> {
  const parsed = parseBackup(await file.text())
  if (!parsed.ok) return parsed
  try {
    await importBackup(parsed.backup)
  } catch (error) {
    if (error instanceof LedgerNotEmptyError) return { ok: false, error: { code: "not_empty" } }
    throw error
  }
  return { ok: true }
}
