import { Dexie, type EntityTable } from "dexie"

import type {
  AccountKind,
  CardColor,
  CardKind,
  CardNetwork,
  DebtMode,
  RecurringFrequency,
  TransactionKind,
  TransactionStatus,
  UnlockMethod,
} from "@/lib/schema"

// IndexedDB rows, mirroring the iOS SwiftData records (keepwell-ios Packages/Persistence/Sources/
// Persistence/Records) in snake_case. Amounts and rates are exact decimal strings, dates are
// `toISOString()` text (sorts as a string), and absent optionals are `null` so every row has the
// same shape. Only the repositories (src/lib/repositories) import this module; components never do.

/** Stamped by the repositories on every write. `deleted_at` set means a tombstone, kept for sync. */
export interface AuditColumns {
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface MoneyColumn {
  amount: string
  currency: string
}

export interface AccountRow extends AuditColumns {
  id: string
  name: string
  bank: string | null
  kind: AccountKind
  opening_balances: MoneyColumn[]
  opening_date: string
  debt_mode: DebtMode | null
  limit_amount: string | null
  limit_currency: string | null
  cutoff_day: number | null
  due_day: number | null
}

export interface CardRow extends AuditColumns {
  id: string
  account_id: string
  kind: CardKind
  network: CardNetwork | null
  last_four: string | null
  color: CardColor | null
  product_name: string | null
  expiry_month: number | null
  expiry_year: number | null
}

export interface CategoryRow extends AuditColumns {
  /** A slug ("groceries", "custom-<uuid>"), not a UUID; see `TransactionCategory`. */
  id: string
  name: string
  kind: TransactionKind
  icon: string | null
  color: string | null
  is_renamed: boolean
  sort_index: number
  /** Added in version 3; `null` when the category has no monthly budget. */
  budget_amount: string | null
  budget_currency: string | null
}

export interface TransactionRow extends AuditColumns {
  id: string
  date: string
  status: TransactionStatus
  description: string
  kind: TransactionKind
  category_id: string | null
  amount: string
  currency: string
  account_id: string
  card_id: string | null
  destination_account_id: string | null
  actual_debited_principal: string | null
  rate_principal: string
  rate_second: string
  rate: string
  is_shared: boolean
  note: string | null
  /** The rule that produced it. Rows written before version 2 lack the column until the upgrade fills it. */
  recurring_id: string | null
}

/** A recurring movement or subscription (iOS `RecurringRuleRecord`). */
export interface RecurringRuleRow extends AuditColumns {
  id: string
  name: string
  kind: TransactionKind
  category_id: string | null
  amount: string
  currency: string
  account_id: string
  card_id: string | null
  destination_account_id: string | null
  frequency: RecurringFrequency
  interval: number
  start_date: string
  next_date: string
  end_date: string | null
  is_subscription: boolean
  auto_confirm: boolean
  is_paused: boolean
  note: string | null
}

/** A single row, like iOS `SettingsRecord`. */
export interface SettingsRow {
  id: typeof SETTINGS_ID
  principal: string
  second: string | null
  rate: string
  unlock_method: UnlockMethod
  relock_after_seconds: number
  hides_amounts_in_app_switcher: boolean
  is_icloud_backup_enabled: boolean
  payment_reminder_days_before: number
  has_completed_onboarding: boolean
  updated_at: string
}

export const SETTINGS_ID = "settings"

export type SyncEntity = "account" | "card" | "category" | "transaction" | "recurringRule" | "settings"
export type SyncOperation = "create" | "update" | "delete"

/**
 * A local change waiting for the sync backend. Written in the same transaction as the change, so a
 * row can never change without its event (and vice versa). `payload` is the row after the change.
 */
export interface SyncOutboxRow {
  id: string
  entity: SyncEntity
  entity_id: string
  operation: SyncOperation
  payload: unknown
  created_at: string
}

export class KeepwellDatabase extends Dexie {
  accounts!: EntityTable<AccountRow, "id">
  cards!: EntityTable<CardRow, "id">
  categories!: EntityTable<CategoryRow, "id">
  transactions!: EntityTable<TransactionRow, "id">
  recurring_rules!: EntityTable<RecurringRuleRow, "id">
  settings!: EntityTable<SettingsRow, "id">
  sync_outbox!: EntityTable<SyncOutboxRow, "id">

  constructor() {
    super("keepwell")
    // IndexedDB doesn't index `null`, so "alive" (deleted_at null) is filtered in memory after an
    // indexed range; the `deleted_at` index lists tombstones for sync. `[account_id+date]` serves an
    // account's movements by period, `date` every summary by period.
    this.version(1).stores({
      accounts: "id, kind, created_at, updated_at, deleted_at",
      cards: "id, account_id, created_at, updated_at, deleted_at",
      categories: "id, kind, sort_index, updated_at, deleted_at",
      transactions: "id, date, account_id, card_id, category_id, [account_id+date], updated_at, deleted_at",
      settings: "id",
      sync_outbox: "id, created_at, entity, entity_id",
    })
    // Recurring movements: their rules, and on each movement the rule that produced it.
    this.version(2)
      .stores({
        transactions:
          "id, date, account_id, card_id, category_id, recurring_id, [account_id+date], updated_at, deleted_at",
        recurring_rules: "id, account_id, next_date, updated_at, deleted_at",
      })
      .upgrade((tx) =>
        tx
          .table<TransactionRow, string>("transactions")
          .toCollection()
          .modify((row) => {
            if (row.recurring_id === undefined) row.recurring_id = null
          })
      )
    // Monthly budgets per category; existing rows start without one.
    this.version(3)
      .stores({})
      .upgrade((tx) =>
        tx
          .table<CategoryRow, string>("categories")
          .toCollection()
          .modify((row) => {
            if (row.budget_amount === undefined) row.budget_amount = null
            if (row.budget_currency === undefined) row.budget_currency = null
          })
      )
  }
}

/** One connection per tab. Dexie opens lazily, so importing this on the server touches nothing. */
export const db = new KeepwellDatabase()
