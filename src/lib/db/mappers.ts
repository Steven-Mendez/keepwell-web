import type { Account, Card, RecurringRule, Settings, Transaction, TransactionCategory } from "@/lib/schema"

import type { AccountRow, CardRow, CategoryRow, RecurringRuleRow, SettingsRow, TransactionRow } from "./database"
import { SETTINGS_ID } from "./database"

// Domain ⇄ row, like the iOS records' `update(from:)` / `toDomain()`. Audit columns are left to the
// repositories, which own when a record was created, changed or deleted.

type Columns<Row> = Omit<Row, "created_at" | "updated_at" | "deleted_at">

/** Absent optionals: `undefined` in the domain, `null` in a row. */
function orNull<T>(value: T | undefined): T | null {
  return value === undefined ? null : value
}

/** Drops `null` so the domain object omits the key, as `exactOptionalPropertyTypes` requires. */
function present<K extends string, T>(key: K, value: T | null): { [P in K]?: T } {
  return (value === null ? {} : { [key]: value }) as { [P in K]?: T }
}

export function accountToRow(account: Account): Columns<AccountRow> {
  return {
    id: account.id,
    name: account.name,
    bank: orNull(account.bank),
    kind: account.kind,
    opening_balances: account.openingBalances.map(({ amount, currency }) => ({ amount, currency })),
    opening_date: account.openingDate,
    debt_mode: orNull(account.creditTerms?.debtMode),
    limit_amount: orNull(account.creditTerms?.limit?.amount),
    limit_currency: orNull(account.creditTerms?.limit?.currency),
    cutoff_day: orNull(account.creditTerms?.cutoffDay),
    due_day: orNull(account.creditTerms?.dueDay),
  }
}

export function rowToAccount(row: AccountRow): Account {
  const limit =
    row.limit_amount !== null && row.limit_currency !== null
      ? { limit: { amount: row.limit_amount, currency: row.limit_currency } }
      : {}
  return {
    id: row.id,
    name: row.name,
    ...present("bank", row.bank),
    kind: row.kind,
    openingBalances: row.opening_balances,
    openingDate: row.opening_date,
    ...(row.debt_mode === null
      ? {}
      : {
          creditTerms: {
            debtMode: row.debt_mode,
            ...limit,
            ...present("cutoffDay", row.cutoff_day),
            ...present("dueDay", row.due_day),
          },
        }),
  }
}

export function cardToRow(card: Card): Columns<CardRow> {
  const productName = card.productName?.trim()
  return {
    id: card.id,
    account_id: card.accountId,
    kind: card.kind,
    network: orNull(card.network),
    last_four: orNull(card.lastFour),
    color: orNull(card.color),
    product_name: productName ? productName : null,
    expiry_month: orNull(card.expiry?.month),
    expiry_year: orNull(card.expiry?.year),
  }
}

export function rowToCard(row: CardRow): Card {
  return {
    id: row.id,
    accountId: row.account_id,
    kind: row.kind,
    ...present("network", row.network),
    ...present("lastFour", row.last_four),
    ...present("color", row.color),
    ...present("productName", row.product_name),
    ...(row.expiry_month !== null && row.expiry_year !== null
      ? { expiry: { month: row.expiry_month, year: row.expiry_year } }
      : {}),
  }
}

export function categoryToRow(category: TransactionCategory, sortIndex: number): Columns<CategoryRow> {
  return {
    id: category.id,
    name: category.name,
    kind: category.kind,
    icon: orNull(category.icon),
    color: orNull(category.color),
    is_renamed: category.isRenamed,
    sort_index: sortIndex,
  }
}

export function rowToCategory(row: CategoryRow): TransactionCategory {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    ...present("icon", row.icon),
    ...present("color", row.color),
    isRenamed: row.is_renamed,
  }
}

export function transactionToRow(transaction: Transaction): Columns<TransactionRow> {
  return {
    id: transaction.id,
    date: transaction.date,
    status: transaction.status,
    description: transaction.description,
    kind: transaction.kind,
    category_id: orNull(transaction.categoryId),
    amount: transaction.amount,
    currency: transaction.currency,
    account_id: transaction.accountId,
    card_id: orNull(transaction.cardId),
    destination_account_id: orNull(transaction.destinationAccountId),
    actual_debited_principal: orNull(transaction.actualDebitedPrincipal),
    rate_principal: transaction.exchangeRate.principal,
    rate_second: transaction.exchangeRate.second,
    rate: transaction.exchangeRate.rate,
    is_shared: transaction.isShared,
    note: orNull(transaction.note),
    recurring_id: orNull(transaction.recurringId),
  }
}

export function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    status: row.status,
    description: row.description,
    kind: row.kind,
    ...present("categoryId", row.category_id),
    amount: row.amount,
    currency: row.currency,
    accountId: row.account_id,
    ...present("cardId", row.card_id),
    ...present("destinationAccountId", row.destination_account_id),
    ...present("actualDebitedPrincipal", row.actual_debited_principal),
    exchangeRate: { principal: row.rate_principal, second: row.rate_second, rate: row.rate },
    isShared: row.is_shared,
    ...present("note", row.note),
    ...present("recurringId", row.recurring_id ?? null),
  }
}

export function recurringRuleToRow(rule: RecurringRule): Columns<RecurringRuleRow> {
  return {
    id: rule.id,
    name: rule.name,
    kind: rule.kind,
    category_id: orNull(rule.categoryId),
    amount: rule.amount,
    currency: rule.currency,
    account_id: rule.accountId,
    card_id: orNull(rule.cardId),
    destination_account_id: orNull(rule.destinationAccountId),
    frequency: rule.frequency,
    interval: rule.interval,
    start_date: rule.startDate,
    next_date: rule.nextDate,
    end_date: orNull(rule.endDate),
    is_subscription: rule.isSubscription,
    auto_confirm: rule.autoConfirm,
    is_paused: rule.isPaused,
    note: orNull(rule.note),
  }
}

export function rowToRecurringRule(row: RecurringRuleRow): RecurringRule {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    ...present("categoryId", row.category_id),
    amount: row.amount,
    currency: row.currency,
    accountId: row.account_id,
    ...present("cardId", row.card_id),
    ...present("destinationAccountId", row.destination_account_id),
    frequency: row.frequency,
    interval: row.interval,
    startDate: row.start_date,
    nextDate: row.next_date,
    ...present("endDate", row.end_date),
    isSubscription: row.is_subscription,
    autoConfirm: row.auto_confirm,
    isPaused: row.is_paused,
    ...present("note", row.note),
  }
}

export function settingsToRow(settings: Settings, updatedAt: string): SettingsRow {
  return {
    id: SETTINGS_ID,
    principal: settings.currencies.principal,
    second: orNull(settings.currencies.second),
    rate: settings.currencies.rate,
    unlock_method: settings.unlockMethod,
    relock_after_seconds: settings.relockAfterSeconds,
    hides_amounts_in_app_switcher: settings.hidesAmountsInAppSwitcher,
    is_icloud_backup_enabled: settings.isICloudBackupEnabled,
    payment_reminder_days_before: settings.paymentReminderDaysBefore,
    has_completed_onboarding: settings.hasCompletedOnboarding,
    updated_at: updatedAt,
  }
}

export function rowToSettings(row: SettingsRow): Settings {
  return {
    currencies:
      row.second === null
        ? { principal: row.principal, rate: row.rate }
        : { principal: row.principal, second: row.second, rate: row.rate },
    unlockMethod: row.unlock_method,
    relockAfterSeconds: row.relock_after_seconds,
    hidesAmountsInAppSwitcher: row.hides_amounts_in_app_switcher,
    isICloudBackupEnabled: row.is_icloud_backup_enabled,
    paymentReminderDaysBefore: row.payment_reminder_days_before,
    hasCompletedOnboarding: row.has_completed_onboarding,
  }
}
