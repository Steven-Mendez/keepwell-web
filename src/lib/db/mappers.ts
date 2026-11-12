import { normalizedTags } from "@/lib/domain/tags"
import type {
  Account,
  Card,
  CategorizationRule,
  Loan,
  PersonalDebt,
  RecordSource,
  RecurringRule,
  SavingsGoal,
  Settings,
  Transaction,
  TransactionCategory,
} from "@/lib/schema"

import type {
  AccountRow,
  CardRow,
  CategorizationRuleRow,
  CategoryRow,
  LoanPaymentRow,
  LoanRow,
  PersonalDebtRepaymentRow,
  PersonalDebtRow,
  RecurringRuleRow,
  SavingsGoalRow,
  SettingsRow,
  TransactionRow,
} from "./database"
import { SETTINGS_ID } from "./database"
import { legacyRepaymentId, loanPaymentId } from "@/lib/schema/id"

// Domain ⇄ row, like the iOS records' `update(from:)` / `toDomain()`. Audit columns are left to the
// repositories, which own when a record was created, changed or deleted.

export type Columns<Row> = Omit<Row, "created_at" | "updated_at" | "deleted_at">

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
    // Always sent, null while open: reopening has to clear it on the other devices.
    closed_at: orNull(account.closedAt),
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
    ...present("closedAt", row.closed_at ?? null),
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
    budget_amount: orNull(category.monthlyBudget?.amount),
    budget_currency: orNull(category.monthlyBudget?.currency),
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
    ...(row.budget_amount != null && row.budget_currency != null
      ? { monthlyBudget: { amount: row.budget_amount, currency: row.budget_currency } }
      : {}),
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
    tags: normalizedTags(transaction.tags ?? []),
    source: transaction.source ?? "app",
    // Always sent, null when it wasn't imported; the server keeps one already set either way.
    imported_id: orNull(transaction.importedId),
  }
}

/** `{ tags }` from a row's column, left out when empty (or missing on a row from before version 5). */
function tagsOf(tags: string[] | undefined): { tags?: string[] } {
  return tags && tags.length > 0 ? { tags } : {}
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
    ...tagsOf(row.tags),
    ...sourceOf(row.source),
    ...present("importedId", row.imported_id ?? null),
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
    tags: normalizedTags(rule.tags ?? []),
    source: rule.source ?? "app",
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
    ...tagsOf(row.tags),
    ...sourceOf(row.source),
  }
}

/** `{ source: "mcp" }` for what an MCP client created; the default `app` is left out. */
function sourceOf(source: RecordSource | undefined): { source?: "mcp" } {
  return source === "mcp" ? { source } : {}
}

export function categorizationRuleToRow(rule: CategorizationRule, sortIndex: number): Columns<CategorizationRuleRow> {
  return {
    id: rule.id,
    match: rule.match,
    category_id: rule.categoryId,
    kind: rule.kind,
    tags: normalizedTags(rule.tags ?? []),
    sort_index: sortIndex,
  }
}

export function rowToCategorizationRule(row: CategorizationRuleRow): CategorizationRule {
  return {
    id: row.id,
    match: row.match,
    categoryId: row.category_id,
    kind: row.kind,
    ...tagsOf(row.tags),
  }
}

export function savingsGoalToRow(goal: SavingsGoal): Columns<SavingsGoalRow> {
  return {
    id: goal.id,
    name: goal.name,
    target_amount: goal.target.amount,
    target_currency: goal.target.currency,
    saved: goal.saved,
    target_month: orNull(goal.targetMonth?.month),
    target_year: orNull(goal.targetMonth?.year),
    icon: orNull(goal.icon),
    color: orNull(goal.color),
  }
}

export function rowToSavingsGoal(row: SavingsGoalRow): SavingsGoal {
  return {
    id: row.id,
    name: row.name,
    target: { amount: row.target_amount, currency: row.target_currency },
    saved: row.saved,
    ...(row.target_month !== null && row.target_year !== null
      ? { targetMonth: { month: row.target_month, year: row.target_year } }
      : {}),
    ...present("icon", row.icon),
    ...present("color", row.color),
  }
}

export function loanToRow(loan: Loan): Columns<LoanRow> {
  return {
    id: loan.id,
    name: loan.name,
    lender: orNull(loan.lender),
    borrowed_amount: loan.borrowed.amount,
    borrowed_currency: loan.borrowed.currency,
    installment_amount: loan.installmentAmount,
    installment_count: loan.installmentCount,
    frequency: loan.frequency,
    first_due_date: loan.firstDueDate,
  }
}

/** A loan's paid installments as rows. A payment without an id gets the installment's own. */
export function loanPaymentsToRows(loan: Loan): Columns<LoanPaymentRow>[] {
  return loan.payments.map((payment) => ({
    id: payment.id ?? loanPaymentId(loan.id, payment.number),
    loan_id: loan.id,
    number: payment.number,
    paid_at: payment.paidAt,
    transaction_id: orNull(payment.transactionId),
  }))
}

export function rowToLoan(row: LoanRow, payments: LoanPaymentRow[]): Loan {
  return {
    id: row.id,
    name: row.name,
    ...present("lender", row.lender),
    borrowed: { amount: row.borrowed_amount, currency: row.borrowed_currency },
    installmentAmount: row.installment_amount,
    installmentCount: row.installment_count,
    frequency: row.frequency as Loan["frequency"],
    firstDueDate: row.first_due_date,
    payments: payments
      .filter((payment) => payment.loan_id === row.id && payment.deleted_at === null)
      .sort((a, b) => a.number - b.number)
      .map((payment) => ({
        id: payment.id,
        number: payment.number,
        paidAt: payment.paid_at,
        ...present("transactionId", payment.transaction_id),
      })),
  }
}

export function personalDebtToRow(debt: PersonalDebt): Columns<PersonalDebtRow> {
  return {
    id: debt.id,
    person: debt.person,
    direction: debt.direction,
    amount: debt.amount.amount,
    currency: debt.amount.currency,
    date: debt.date,
    note: orNull(debt.note),
    settled_at: orNull(debt.settledAt),
    transaction_id: orNull(debt.transactionId),
    // Always sent, null for none: removing the date has to clear it on the other devices.
    due_date: orNull(debt.dueDate),
  }
}

/** A debt's repayments as rows. One without an id gets a stable one from what it is. */
export function repaymentsToRows(debt: PersonalDebt): Columns<PersonalDebtRepaymentRow>[] {
  return debt.repayments.map((repayment, index) => ({
    id: repayment.id ?? legacyRepaymentId(debt.id, index, repayment.date, repayment.amount),
    debt_id: debt.id,
    amount: repayment.amount,
    date: repayment.date,
  }))
}

export function rowToPersonalDebt(row: PersonalDebtRow, repayments: PersonalDebtRepaymentRow[]): PersonalDebt {
  return {
    id: row.id,
    person: row.person,
    direction: row.direction as PersonalDebt["direction"],
    amount: { amount: row.amount, currency: row.currency },
    date: row.date,
    ...present("note", row.note),
    repayments: repayments
      .filter((repayment) => repayment.debt_id === row.id && repayment.deleted_at === null)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.created_at < b.created_at ? -1 : 1))
      .map((repayment) => ({ id: repayment.id, amount: repayment.amount, date: repayment.date })),
    ...present("settledAt", row.settled_at),
    ...present("transactionId", row.transaction_id),
    ...present("dueDate", row.due_date ?? null),
  }
}

export function settingsToRow(settings: Settings, updatedAt: string, createdAt: string = updatedAt): SettingsRow {
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
    ...(settings.timeZone ? { time_zone: settings.timeZone } : {}),
    created_at: createdAt,
    updated_at: updatedAt,
    deleted_at: null,
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
    ...(row.time_zone ? { timeZone: row.time_zone } : {}),
  }
}
