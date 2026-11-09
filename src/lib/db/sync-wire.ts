import type { SyncEntity } from "@/lib/schema"

import type { SettingsRow } from "./database"

/** The Dexie table that stores each sync entity. */
export const SYNC_TABLES: Record<SyncEntity, string> = {
  account: "accounts",
  card: "cards",
  category: "categories",
  transaction: "transactions",
  recurringRule: "recurring_rules",
  savingsGoal: "savings_goals",
  loan: "loans",
  loanPayment: "loan_payments",
  personalDebt: "personal_debts",
  personalDebtRepayment: "personal_debt_repayments",
  categorizationRule: "categorization_rules",
  settings: "settings",
}

/** Settings columns that are this device's alone and never leave it. */
export const LOCAL_SETTINGS_COLUMNS = ["unlock_method", "relock_after_seconds", "hides_amounts_in_app_switcher", "is_icloud_backup_enabled"] as const

/** A stored row as it travels (`SYNC_WIRE`): every row as is, except settings without its local columns. */
export function toWire(entity: SyncEntity, row: object): Record<string, unknown> {
  if (entity !== "settings") return { ...row }
  const wire: Record<string, unknown> = { ...(row as SettingsRow) }
  for (const column of LOCAL_SETTINGS_COLUMNS) delete wire[column]
  return wire
}
