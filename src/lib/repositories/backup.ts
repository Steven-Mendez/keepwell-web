import { newID } from "@/lib/platform/uuid"
import {
  accountToRow,
  cardToRow,
  categoryToRow,
  db,
  recurringRuleToRow,
  rowToSavingsGoal,
  savingsGoalToRow,
  rowToAccount,
  rowToCard,
  rowToCategory,
  rowToRecurringRule,
  rowToSettings,
  rowToTransaction,
  settingsToRow,
  transactionToRow,
  SETTINGS_ID,
  type AuditColumns,
  type SyncEntity,
  type SyncOutboxRow,
} from "@/lib/db"
import {
  CURRENT_SCHEMA_VERSION,
  nowIso,
  parseBackupFile,
  serializeBackupFile,
  type BackupFile,
} from "@/lib/schema"

/** What a restore brought back, for the message after it (iOS `RestoreSummary`). */
export interface RestoreSummary {
  accounts: number
  transactions: number
  backupDate: string
}

export class NothingToBackUpError extends Error {
  override readonly name = "NothingToBackUpError"

  constructor() {
    super("Nothing to back up yet")
  }
}

function audit(row: AuditColumns) {
  return {
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.deleted_at === null ? {} : { deletedAt: row.deleted_at }),
  }
}

function columns(record: {
  createdAt: string
  updatedAt: string
  deletedAt?: string | undefined
}): AuditColumns {
  return {
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    deleted_at: record.deletedAt ?? null,
  }
}

const allTables = () => [
  db.accounts,
  db.cards,
  db.categories,
  db.transactions,
  db.recurring_rules,
  db.savings_goals,
  db.settings,
  db.sync_outbox,
]

export const backupRepository = {
  /** The whole store, deleted records included, as the JSON file iOS reads (`schemaVersion` 3). */
  async export(): Promise<string> {
    const file = await db.transaction(
      "r",
      allTables(),
      async (): Promise<BackupFile> => {
        const settings = await db.settings.get(SETTINGS_ID)
        if (!settings) throw new NothingToBackUpError()
        const [accounts, cards, categories, transactions, recurringRules, savingsGoals] = await Promise.all([
          db.accounts.orderBy("created_at").toArray(),
          db.cards.orderBy("created_at").toArray(),
          db.categories.orderBy("sort_index").toArray(),
          db.transactions.orderBy("date").reverse().toArray(),
          // No `created_at` index on this table (shared contract): sorted below instead.
          db.recurring_rules.toArray(),
          db.savings_goals.toArray(),
        ])
        return {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          exportedAt: nowIso(),
          settings: {
            ...rowToSettings(settings),
            updatedAt: settings.updated_at,
          },
          accounts: accounts.map((row) => ({
            ...rowToAccount(row),
            ...audit(row),
          })),
          cards: cards.map((row) => ({ ...rowToCard(row), ...audit(row) })),
          categories: categories.map((row, index) => ({
            ...rowToCategory(row),
            sortIndex: index,
            ...audit(row),
          })),
          transactions: transactions.map((row) => ({
            ...rowToTransaction(row),
            ...audit(row),
          })),
          recurringRules: recurringRules
            .sort((a, b) =>
              a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
            )
            .map((row) => ({ ...rowToRecurringRule(row), ...audit(row) })),
          savingsGoals: savingsGoals
            .sort((a, b) =>
              a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
            )
            .map((row) => ({ ...rowToSavingsGoal(row), ...audit(row) })),
        }
      }
    )
    return serializeBackupFile(file)
  },

  /**
   * Validates the whole file first, then replaces every table in one transaction: a damaged file or a
   * failure midway changes nothing. Ids and audit dates are kept, so restored records match the
   * backed-up ones for a sync engine. The outbox is replaced by one event per restored record, since
   * the restore supersedes whatever was pending.
   */
  async import(text: string): Promise<RestoreSummary> {
    const file = parseBackupFile(text)
    const now = nowIso()
    const settings = settingsToRow(
      { ...file.settings, hasCompletedOnboarding: true },
      file.settings.updatedAt
    )
    const accounts = file.accounts.map((record) => ({
      ...accountToRow(record),
      ...columns(record),
    }))
    const cards = file.cards.map((record) => ({
      ...cardToRow(record),
      ...columns(record),
    }))
    const categories = [...file.categories]
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .map((record, index) => ({
        ...categoryToRow(record, index),
        ...columns(record),
      }))
    const transactions = file.transactions.map((record) => ({
      ...transactionToRow(record),
      ...columns(record),
    }))

    const recurringRules = file.recurringRules.map((record) => ({
      ...recurringRuleToRow(record),
      ...columns(record),
    }))

    const savingsGoals = file.savingsGoals.map((record) => ({
      ...savingsGoalToRow(record),
      ...columns(record),
    }))

    const events: SyncOutboxRow[] = []
    const record = (
      entity: SyncEntity,
      rows: ReadonlyArray<AuditColumns & { id: string }>
    ) => {
      for (const row of rows) {
        events.push({
          id: newID(),
          entity,
          entity_id: row.id,
          operation: row.deleted_at === null ? "update" : "delete",
          payload: row,
          created_at: now,
        })
      }
    }
    record("account", accounts)
    record("card", cards)
    record("category", categories)
    record("transaction", transactions)
    record("recurringRule", recurringRules)
    record("savingsGoal", savingsGoals)
    events.push({
      id: newID(),
      entity: "settings",
      entity_id: SETTINGS_ID,
      operation: "update",
      payload: settings,
      created_at: now,
    })

    await db.transaction("rw", allTables(), async () => {
      await Promise.all(allTables().map((table) => table.clear()))
      await db.settings.put(settings)
      await db.accounts.bulkPut(accounts)
      await db.cards.bulkPut(cards)
      await db.categories.bulkPut(categories)
      await db.transactions.bulkPut(transactions)
      await db.recurring_rules.bulkPut(recurringRules)
      await db.savings_goals.bulkPut(savingsGoals)
      await db.sync_outbox.bulkAdd(events)
    })

    return {
      accounts: accounts.filter((row) => row.deleted_at === null).length,
      transactions: transactions.filter((row) => row.deleted_at === null)
        .length,
      backupDate: file.exportedAt,
    }
  },
}
