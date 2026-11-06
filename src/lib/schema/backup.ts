import { z } from "zod"

import { TransactionCategory } from "./category"
import { Account, Card, Settings, Transaction } from "./entities"
import { IsoDateTime } from "./primitives"

/**
 * The backup file shared with iOS (`BackupSnapshot`, keepwell-ios Packages/Domain/Sources/Domain/
 * Sync/BackupSnapshot.swift): the whole store, deleted records included.
 *
 * - Decimals are exact strings, ids lowercase UUIDs, dates ISO 8601 (iOS writes milliseconds).
 * - Optional fields are omitted when empty; `null` is accepted too and means the same.
 * - A deleted record carries `deletedAt`; a default category absent from the file is not deleted.
 */
export const CURRENT_SCHEMA_VERSION = 1

const Audited = {
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  deletedAt: IsoDateTime.optional(),
}

export const BackupAccount = Account.extend(Audited)
export const BackupCard = Card.extend(Audited)
export const BackupTransaction = Transaction.extend(Audited)
export const BackupCategory = TransactionCategory.extend({
  ...Audited,
  sortIndex: z.number().int(),
})
export const BackupSettings = Settings.extend({ updatedAt: IsoDateTime })

const BackupFileShape = z.object({
  schemaVersion: z
    .number()
    .int()
    .positive()
    .max(CURRENT_SCHEMA_VERSION, "This backup was written by a newer version of Keepwell"),
  exportedAt: IsoDateTime,
  settings: BackupSettings,
  accounts: z.array(BackupAccount),
  cards: z.array(BackupCard),
  categories: z.array(BackupCategory),
  transactions: z.array(BackupTransaction),
})

/** Swift's decoder reads `null` as absent; dropping nulls first lets one schema serve both. */
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== null)
        .map(([key, entry]) => [key, withoutNulls(entry)]),
    )
  }
  return value
}

export const BackupFile = z.preprocess(withoutNulls, BackupFileShape)
export type BackupFile = z.infer<typeof BackupFile>
export type BackupAccount = z.infer<typeof BackupAccount>
export type BackupCard = z.infer<typeof BackupCard>
export type BackupTransaction = z.infer<typeof BackupTransaction>
export type BackupCategory = z.infer<typeof BackupCategory>
export type BackupSettings = z.infer<typeof BackupSettings>

export class BackupFormatError extends Error {
  override readonly name = "BackupFormatError"

  constructor(
    message: string,
    readonly issues: readonly z.core.$ZodIssue[] = [],
  ) {
    super(message)
  }
}

/** Parses and validates every record, so a damaged file fails before anything is replaced. */
export function parseBackupFile(text: string): BackupFile {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new BackupFormatError("Not a Keepwell backup")
  }
  if (json !== null && typeof json === "object" && !("schemaVersion" in json) && "version" in json) {
    throw new BackupFormatError("This backup is from an older Keepwell for iPhone. Back up again from the latest version.")
  }
  const result = BackupFile.safeParse(json)
  if (!result.success) {
    throw new BackupFormatError("Not a valid Keepwell backup", result.error.issues)
  }
  return result.data
}

/** The same text iOS writes: keys sorted, empty optionals left out. */
export function serializeBackupFile(file: BackupFile): string {
  return JSON.stringify(sortKeys(file))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined && entry !== null)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, sortKeys(entry)]),
    )
  }
  return value
}
