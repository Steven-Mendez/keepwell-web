import { Dexie, type EntityTable } from "dexie"

import { legacyRepaymentId, loanPaymentId } from "@/lib/schema/id"

import { rebuildOutbox } from "./outbox-rebuild"
import { SYNC_TABLES } from "./sync-wire"

import type {
  AccountKind,
  CardColor,
  CardKind,
  CardNetwork,
  DebtMode,
  RecordSource,
  RecurringFrequency,
  SyncEntity,
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
  /** `Account.closedAt`. Optional because rows stored or pulled before it lack it. No index, so no new Dexie version. */
  closed_at?: string | null
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
  /** Normalized tags, empty when none. Added in version 5, whose upgrade fills older rows. */
  tags: string[]
  /** `mcp` when an MCP client recorded it. Added in version 6 (older rows become `app`); never changes. */
  source: RecordSource
  /** The statement line it was imported from (T28); absent on rows from before, `null` when not imported. No index, so no new version. */
  imported_id?: string | null
  /** The business (`merchants`) and the platform it went through; absent on rows from before, `null` for none. No index. */
  merchant_id?: string | null
  via_merchant_id?: string | null
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
  /** Copied to each movement; empty when none. Added in version 5. */
  tags: string[]
  source: RecordSource
  /** As on a movement; absent on rows from before, `null` for none. */
  merchant_id?: string | null
  via_merchant_id?: string | null
}

/** A categorization rule (iOS `CategorizationRuleRecord`); `sort_index` is the person's order. */
export interface CategorizationRuleRow extends AuditColumns {
  id: string
  match: string
  category_id: string
  kind: "expense" | "income"
  tags: string[]
  sort_index: number
  /** The business it sets; absent on rows from before, `null` for none. */
  merchant_id?: string | null
}

/** A business or platform a movement names (`Merchant`). Added in version 8. */
export interface MerchantRow extends AuditColumns {
  id: string
  name: string
  domain: string | null
  brand_id: string | null
  default_category_id: string | null
  is_platform: boolean
}

/** A savings goal (iOS `SavingsGoalRecord`). */
export interface SavingsGoalRow extends AuditColumns {
  id: string
  name: string
  target_amount: string
  target_currency: string
  saved: string
  target_month: number | null
  target_year: number | null
  icon: string | null
  color: string | null
}

/** A loan (iOS `LoanRecord`). Its paid installments are rows of `loan_payments` since version 6. */
export interface LoanRow extends AuditColumns {
  id: string
  name: string
  lender: string | null
  borrowed_amount: string
  borrowed_currency: string
  installment_amount: string
  installment_count: number
  frequency: string
  first_due_date: string
}

/**
 * One paid installment, its own row so two devices can each record a payment without one write
 * replacing the other. `id` is `loanPaymentId(loan_id, number)`: the same installment paid on two
 * devices is one row.
 */
export interface LoanPaymentRow extends AuditColumns {
  id: string
  loan_id: string
  number: number
  paid_at: string
  transaction_id: string | null
}

/** A personal debt (iOS `PersonalDebtRecord`). Its repayments are rows of `personal_debt_repayments`. */
export interface PersonalDebtRow extends AuditColumns {
  id: string
  person: string
  direction: string
  amount: string
  currency: string
  date: string
  note: string | null
  settled_at: string | null
  transaction_id: string | null
  /** `PersonalDebt.dueDate`. Optional because rows stored or pulled before it lack it. No index, so no new Dexie version. */
  due_date?: string | null
}

export interface PersonalDebtRepaymentRow extends AuditColumns {
  id: string
  debt_id: string
  amount: string
  date: string
  /** The income movement that deposited it. Optional because rows stored or pulled before it lack it. No index, so no new Dexie version. */
  transaction_id?: string | null
}

/**
 * What the person did with one notification (ADR 0012 in keepwell-api), keyed by the notification's
 * id. Only touched notifications have a row; no row means unread and in the inbox.
 */
export interface NotificationStateRow extends AuditColumns {
  id: string
  read_at: string | null
  dismissed_at: string | null
}

/**
 * A single row, like iOS `SettingsRecord`. Only the currencies, reminder days and onboarding flag
 * sync (`SettingsWire`); unlock, relock, hiding amounts and the iCloud switch are this device's.
 */
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
  /**
   * The person's home zone (`Settings.timeZone`). Left out, not null, while it has none, so a save
   * never sends a null that would clear the account's zone; a row pulled before it was set carries
   * null. No index, so no new Dexie version.
   */
  time_zone?: string | null
  /** Added in version 6, with `deleted_at`, so settings follow the same sync rules as every row. */
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/** Small key/value facts about this installation, such as its sync `client_id`. */
export interface MetaRow {
  key: string
  value: string
}

export const SETTINGS_ID = "settings"

export type { SyncEntity }
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
  savings_goals!: EntityTable<SavingsGoalRow, "id">
  loans!: EntityTable<LoanRow, "id">
  loan_payments!: EntityTable<LoanPaymentRow, "id">
  personal_debts!: EntityTable<PersonalDebtRow, "id">
  personal_debt_repayments!: EntityTable<PersonalDebtRepaymentRow, "id">
  meta!: EntityTable<MetaRow, "key">
  categorization_rules!: EntityTable<CategorizationRuleRow, "id">
  settings!: EntityTable<SettingsRow, "id">
  notification_states!: EntityTable<NotificationStateRow, "id">
  merchants!: EntityTable<MerchantRow, "id">
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
    // Savings goals.
    this.version(4).stores({ savings_goals: "id, updated_at, deleted_at" })
    // Loans and personal debts (`transaction_id` finds the debts split from a movement), categorization
    // rules in the person's order, and tags on movements and recurring rules, empty on older rows.
    this.version(5)
      .stores({
        loans: "id, updated_at, deleted_at",
        personal_debts: "id, transaction_id, updated_at, deleted_at",
        categorization_rules: "id, sort_index, updated_at, deleted_at",
      })
      .upgrade(async (tx) => {
        await tx
          .table<TransactionRow, string>("transactions")
          .toCollection()
          .modify((row) => {
            if (row.tags === undefined) row.tags = []
          })
        await tx
          .table<RecurringRuleRow, string>("recurring_rules")
          .toCollection()
          .modify((row) => {
            if (row.tags === undefined) row.tags = []
          })
      })
    // Sync-ready rows (ADR 0005): loan payments and debt repayments become rows with their own ids,
    // movements and rules carry `source`, settings get the audit columns, and `meta` holds this
    // installation's `client_id`. The outbox is rebuilt from the current rows in the wire format,
    // so the first push uploads exactly today's state, never events in an older shape.
    this.version(6)
      .stores({
        loan_payments: "id, loan_id, updated_at, deleted_at",
        personal_debt_repayments: "id, debt_id, updated_at, deleted_at",
        meta: "key",
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString()
        const loans = tx.table("loans")
        await loans.toCollection().each(async (loan: LoanRow & { payments?: { number: number; paid_at: string; transaction_id: string | null }[] }) => {
          for (const payment of loan.payments ?? []) {
            await tx.table("loan_payments").put({
              id: loanPaymentId(loan.id, payment.number),
              loan_id: loan.id,
              number: payment.number,
              paid_at: payment.paid_at,
              transaction_id: payment.transaction_id,
              created_at: loan.created_at,
              updated_at: loan.updated_at,
              deleted_at: loan.deleted_at,
            } satisfies LoanPaymentRow)
          }
        })
        await loans.toCollection().modify((loan: { payments?: unknown }) => {
          delete loan.payments
        })
        const debts = tx.table("personal_debts")
        await debts.toCollection().each(async (debt: PersonalDebtRow & { repayments?: { amount: string; date: string }[] }) => {
          for (const [index, repayment] of (debt.repayments ?? []).entries()) {
            await tx.table("personal_debt_repayments").put({
              id: legacyRepaymentId(debt.id, index, repayment.date, repayment.amount),
              debt_id: debt.id,
              amount: repayment.amount,
              date: repayment.date,
              created_at: debt.created_at,
              updated_at: debt.updated_at,
              deleted_at: debt.deleted_at,
            } satisfies PersonalDebtRepaymentRow)
          }
        })
        await debts.toCollection().modify((debt: { repayments?: unknown }) => {
          delete debt.repayments
        })
        for (const table of ["transactions", "recurring_rules"]) {
          await tx
            .table(table)
            .toCollection()
            .modify((row: { source?: RecordSource }) => {
              row.source ??= "app"
            })
        }
        await tx
          .table("settings")
          .toCollection()
          .modify((row: SettingsRow) => {
            row.created_at ??= row.updated_at ?? now
            row.deleted_at ??= null
          })
        // The entities that had tables at version 6: later ones (notification states) start empty.
        await rebuildOutbox(tx, now, SYNC_ENTITIES_AT_V6)
      })
    // Read and deleted notifications, synced (ADR 0012). A new table, so nothing to upgrade.
    this.version(7).stores({ notification_states: "id, updated_at, deleted_at" })
    // Merchants (businesses and platforms). A new table; the links on movements and rules are plain
    // columns without an index, absent on older rows. The API shipped merchants before this build, so
    // a browser that already synced may have missed them: the older build's snapshot never asked for
    // `merchant` rows, and every save it made rewrote a movement or rule without the links the server
    // holds. Such a browser re-downloads them before its next push (`MERCHANT_REFETCH` in the engine);
    // the rows that lack the links now are listed, so a save made here before that download, which
    // sends `null` for a link it never saw, takes the server's link instead of clearing it.
    this.version(8)
      .stores({ merchants: "id, updated_at, deleted_at" })
      .upgrade(async (tx) => {
        if ((await tx.table<MetaRow, string>("meta").get(SYNC_CURSOR_KEY)) === undefined) return
        const unlinked: Record<MerchantLinkedEntity, string[]> = { transaction: [], recurringRule: [], categorizationRule: [] }
        for (const entity of MERCHANT_LINKED_ENTITIES) {
          await tx
            .table(SYNC_TABLES[entity])
            .toCollection()
            .each((row: { id: string; deleted_at: string | null } & Record<string, unknown>) => {
              if (row.deleted_at === null && MERCHANT_LINK_COLUMNS[entity].some((column) => !(column in row))) unlinked[entity].push(row.id)
            })
        }
        await tx.table<MetaRow, string>("meta").put({ key: MERCHANT_REFETCH_KEY, value: JSON.stringify(unlinked) })
      })
  }
}

/** The meta key of the sync cursor (`CURSOR` in the engine): present once this browser has synced. */
export const SYNC_CURSOR_KEY = "sync_cursor"

/**
 * Set by the version 8 upgrade on a browser that had synced: the merchants and their links still have
 * to be downloaded. Its value lists, per entity, the ids of the rows that had no link columns then.
 */
export const MERCHANT_REFETCH_KEY = "sync_merchant_refetch"

/** The entities whose rows name merchants, and the columns that do. */
export const MERCHANT_LINK_COLUMNS = {
  transaction: ["merchant_id", "via_merchant_id"],
  recurringRule: ["merchant_id", "via_merchant_id"],
  categorizationRule: ["merchant_id"],
} as const satisfies Partial<Record<SyncEntity, readonly string[]>>

export type MerchantLinkedEntity = keyof typeof MERCHANT_LINK_COLUMNS
export const MERCHANT_LINKED_ENTITIES = Object.keys(MERCHANT_LINK_COLUMNS) as MerchantLinkedEntity[]

const SYNC_ENTITIES_AT_V6: readonly SyncEntity[] = [
  "account",
  "card",
  "category",
  "transaction",
  "recurringRule",
  "savingsGoal",
  "loan",
  "loanPayment",
  "personalDebt",
  "personalDebtRepayment",
  "categorizationRule",
  "settings",
]

/** One connection per tab. Dexie opens lazily, so importing this on the server touches nothing. */
export const db = new KeepwellDatabase()
