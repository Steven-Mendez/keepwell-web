import { z } from "zod"

import {
  CurrencyCode,
  DecimalString,
  Id,
  IsoDateTime,
  PositiveDecimalString,
  TransactionKind,
  TransactionStatus,
  isPositiveDecimal,
} from "./primitives"

// Domain entities, mirroring keepwell-ios Packages/Domain/Sources/Domain/Entities. Field names and
// enum values match iOS exactly so the backup file and a future sync map one to one.

/** An amount with its currency. Never summed across currencies without an exchange rate. */
export const Money = z.object({
  amount: DecimalString,
  currency: CurrencyCode,
})
export type Money = z.infer<typeof Money>

/** "1 principal = rate second". Each movement keeps the rate it was recorded with. */
export const ExchangeRate = z.object({
  principal: CurrencyCode,
  second: CurrencyCode,
  rate: PositiveDecimalString,
})
export type ExchangeRate = z.infer<typeof ExchangeRate>

export const AccountKind = z.enum(["deposit", "cash", "credit"])
export type AccountKind = z.infer<typeof AccountKind>

/** How a credit card bills: separate debts per currency, all in principal, or all in second. */
export const DebtMode = z.enum(["dual", "principal", "second"])
export type DebtMode = z.infer<typeof DebtMode>

/** Day of month 1–31; short months clamp to their last day. */
const DayOfMonth = z.number().int().min(1).max(31)

export const CreditTerms = z.object({
  debtMode: DebtMode,
  limit: Money.optional(),
  cutoffDay: DayOfMonth.optional(),
  dueDay: DayOfMonth.optional(),
})
export type CreditTerms = z.infer<typeof CreditTerms>

export const Account = z.object({
  id: Id,
  name: z.string(),
  bank: z.string().optional(),
  kind: AccountKind,
  /** Balances on `openingDate`, one per currency the account holds. Signed: credit debts are negative. */
  openingBalances: z.array(Money),
  /** Movements dated before this day are already part of `openingBalances`. */
  openingDate: IsoDateTime,
  creditTerms: CreditTerms.optional(),
})
export type Account = z.infer<typeof Account>

export const CardKind = z.enum(["debit", "creditHolder", "transfer"])
export type CardKind = z.infer<typeof CardKind>

export const CardNetwork = z.enum(["visa", "mastercard", "amex", "other"])
export type CardNetwork = z.infer<typeof CardNetwork>

/** Card art palette by name. `violeta`, `coral` and `lima` are no longer offered but still stored. */
export const CardColor = z.enum(["azul", "grafito", "platino", "verde", "violeta", "coral", "rojo", "oro", "lima"])
export type CardColor = z.infer<typeof CardColor>

/** The "valid thru" printed on a plastic: month and year only. */
export const CardExpiry = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2199),
})
export type CardExpiry = z.infer<typeof CardExpiry>

export const Card = z.object({
  id: Id,
  accountId: Id,
  kind: CardKind,
  network: CardNetwork.optional(),
  lastFour: z
    .string()
    .regex(/^[0-9]{4}$/, "Last four must be four digits")
    .optional(),
  color: CardColor.optional(),
  /** The bank's name for the plastic ("Premia"). The card repository trims it and drops a blank one, as iOS does. */
  productName: z.string().optional(),
  expiry: CardExpiry.optional(),
})
export type Card = z.infer<typeof Card>

/**
 * A movement. `amount` is always positive and `kind` carries the direction, so a mis-signed value
 * can't flip an expense into income (iOS `Transaction.checkAmounts`).
 */
export const Transaction = z.object({
  id: Id,
  date: IsoDateTime,
  status: TransactionStatus,
  description: z.string(),
  kind: TransactionKind,
  /** Absent for transfers, which have no category. */
  categoryId: z.string().optional(),
  amount: PositiveDecimalString,
  currency: CurrencyCode,
  /** Source account, derived from the payment method when there is one. */
  accountId: Id,
  cardId: Id.optional(),
  /** Transfers only. */
  destinationAccountId: Id.optional(),
  /** What the bank actually charged in the principal currency, when it used its own rate. */
  actualDebitedPrincipal: DecimalString.refine(isPositiveDecimal, "Must be greater than zero").optional(),
  exchangeRate: ExchangeRate,
  isShared: z.boolean(),
  note: z.string().optional(),
})
export type Transaction = z.infer<typeof Transaction>

export const UnlockMethod = z.enum(["biometrics", "passcode", "disabled"])
export type UnlockMethod = z.infer<typeof UnlockMethod>

/**
 * Principal currency, optional second and the manual rate. A second equal to the principal means
 * single-currency mode, where the rate is always 1 (iOS `CurrencySettings.init`).
 */
export const CurrencySettings = z
  .object({
    principal: CurrencyCode,
    second: CurrencyCode.optional(),
    rate: PositiveDecimalString,
  })
  .transform(({ principal, second, rate }) => {
    const effectiveSecond = second === principal ? undefined : second
    return effectiveSecond === undefined
      ? { principal, rate: "1" }
      : { principal, second: effectiveSecond, rate }
  })
export type CurrencySettings = z.infer<typeof CurrencySettings>

export const Settings = z.object({
  currencies: CurrencySettings,
  unlockMethod: UnlockMethod,
  /** Seconds in the background before the lock is asked again. */
  relockAfterSeconds: z.number().nonnegative(),
  hidesAmountsInAppSwitcher: z.boolean(),
  isICloudBackupEnabled: z.boolean(),
  paymentReminderDaysBefore: z.number().int().nonnegative(),
  hasCompletedOnboarding: z.boolean(),
})
export type Settings = z.infer<typeof Settings>

/** iOS `Settings.init` defaults, before onboarding saves real ones. */
export const DEFAULT_SETTINGS: Settings = {
  currencies: { principal: "USD", rate: "1" },
  unlockMethod: "biometrics",
  relockAfterSeconds: 60,
  hidesAmountsInAppSwitcher: true,
  isICloudBackupEnabled: true,
  paymentReminderDaysBefore: 3,
  hasCompletedOnboarding: false,
}

/** Single-currency mode stores the principal as both currencies at rate 1. */
export function hasSecondCurrency(rate: ExchangeRate): boolean {
  return rate.second !== rate.principal
}
