import {
  typeTitle,
  sourceTitle,
} from "@/components/movement-editor/editor-model"
import {
  amountIn,
  accountCurrencies,
  bankRate,
  Decimal,
  movementTypeOf,
  rateHasSecondCurrency,
  share,
  type MovementType,
  type SavedTransaction,
  type TransactionContext,
} from "@/lib/domain"
import {
  formatMoney,
  formatNumber,
  joinedMoney,
} from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"
import { accountName, categoryNameById } from "@/lib/presentation/display"

// Port of the receipt copy in iOS CreateTransactionViewModel+Review and +Saved, and the rows of
// ReceiptTicket.swift, kept free of React so the ticket on screen and the PNG say the same thing.

export interface ReceiptRow {
  label: string
  value: string
}

export interface Receipt {
  /** "Tuesday, November 3, 2026 at 9:22 AM". */
  date: string
  /** "You spent". */
  headline: string
  /** "−$24.28". */
  amount: string
  description: string
  confirmed: boolean
  status: string
  /** Method or the ends of the transfer, category, note, money rows and the reference. */
  rows: ReceiptRow[]
  /** "KW-1A2B3C4D". */
  reference: string
  fileName: string
  /** The plain-text receipt, for targets that only take text. */
  text: string
}

const HEADLINES: Record<MovementType, string> = {
  expense: "You spent",
  income: "You received",
  transfer: "You moved",
  withdrawal: "You withdrew",
  cardPayment: "You paid",
}

export function receiptOf(
  t: Translator,
  saved: SavedTransaction,
  context: TransactionContext
): Receipt {
  const ct = (key: string, ...args: (string | number)[]) =>
    t.in("createtransaction", key, ...args)
  const { transaction } = saved
  const type = movementTypeOf(transaction, context.accounts)
  const movesBetweenAccounts = transaction.kind === "transfer"
  const amount = new Decimal(transaction.amount)
  const sign = { expense: "−", income: "+", transfer: "" }[transaction.kind]
  const source = context.accounts.find(
    (account) => account.id === transaction.accountId
  )
  const destination = context.accounts.find(
    (account) => account.id === transaction.destinationAccountId
  )
  const category = transaction.categoryId
    ? context.categories.find(
        (candidate) => candidate.id === transaction.categoryId
      )
    : undefined
  const categoryName =
    transaction.categoryId && !movesBetweenAccounts
      ? categoryNameById(t, category, transaction.categoryId)
      : undefined
  const method = sourceTitle(
    t,
    transaction.cardId
      ? { type: "card", id: transaction.cardId }
      : { type: "account", id: transaction.accountId },
    context
  )
  const date = new Date(transaction.date)

  const routeRows: ReceiptRow[] = movesBetweenAccounts
    ? [
        ...(source ? [{ label: ct("From"), value: accountName(source) }] : []),
        ...(destination
          ? [{ label: ct("To"), value: accountName(destination) }]
          : []),
      ]
    : [
        {
          label: ct("Method"),
          value: method ?? (source ? accountName(source) : "—"),
        },
        ...(categoryName
          ? [{ label: ct("Category"), value: categoryName }]
          : []),
      ]
  const noteRows = transaction.note
    ? [{ label: ct("Note"), value: transaction.note }]
    : []
  const moneyRows = savedRows(ct, saved)
  const arrived = arrivedRow(ct, saved, destination)
  const categoryTotal =
    saved.categoryMonthTotal && categoryName
      ? {
          label: ct(
            "%@ in %@",
            categoryName,
            date.toLocaleDateString(t.locale, { month: "long" })
          ),
          value: formatMoney(saved.categoryMonthTotal),
        }
      : undefined
  const reference =
    "KW-" + transaction.id.replaceAll("-", "").slice(0, 8).toUpperCase()
  const referenceRow = { label: ct("Reference"), value: reference }
  const rows = [
    ...routeRows,
    ...noteRows,
    ...moneyRows,
    ...(arrived ? [arrived] : []),
    ...(categoryTotal ? [categoryTotal] : []),
    referenceRow,
  ]

  const dateText = date.toLocaleString(t.locale, {
    dateStyle: "full",
    timeStyle: "short",
  })
  const headline = ct(HEADLINES[type])
  const fromCaption = movesBetweenAccounts
    ? ct("From")
    : ct(transaction.kind === "income" ? "Into" : "Paid with")
  const fromTitle = movesBetweenAccounts
    ? source
      ? accountName(source)
      : undefined
    : (method ?? (source ? accountName(source) : undefined))
  const text = [
    `Keepwell · ${typeTitle(t, type)}`,
    dateText,
    "",
    `${headline} ${formatMoney({ amount, currency: transaction.currency })}`,
    transaction.description,
    ...(fromTitle ? [`${fromCaption}: ${fromTitle}`] : []),
    ...(movesBetweenAccounts && destination
      ? [`${ct("To")}: ${accountName(destination)}`]
      : []),
    ...(categoryName ? [`${ct("Category")}: ${categoryName}`] : []),
    ...(transaction.note ? [`${ct("Note")}: ${transaction.note}`] : []),
    ...moneyRows.map((row) => `${row.label}: ${row.value}`),
    `${ct("Reference")}: ${reference}`,
  ].join("\n")

  const confirmed = transaction.status === "confirmed"
  return {
    date: dateText,
    headline,
    amount: sign + formatMoney({ amount, currency: transaction.currency }),
    description: transaction.description,
    confirmed,
    status: ct(confirmed ? "Confirmed" : "Draft"),
    rows,
    reference,
    fileName: `Keepwell ${reference}.png`,
    text,
  }
}

/** Debit, rate and new balance (iOS `savedRows`). */
function savedRows(
  ct: (key: string, ...args: (string | number)[]) => string,
  saved: SavedTransaction
): ReceiptRow[] {
  const { transaction, account } = saved
  const currencies = accountCurrencies(account)
  const currency = currencies.includes(transaction.currency)
    ? transaction.currency
    : (currencies[0] ?? transaction.currency)
  const moved = amountIn(transaction, currency)
  const income = transaction.kind === "income"
  const name = accountName(account)
  const rows: ReceiptRow[] = [
    {
      label: income ? ct("Credited to %@", name) : ct("Debited from %@", name),
      value: income
        ? formatMoney({ amount: moved, currency }, { sign: "always" })
        : "−" + formatMoney({ amount: moved, currency }, { sign: "never" }),
    },
  ]
  const rate = transaction.exchangeRate
  if (rateHasSecondCurrency(rate)) {
    const bank = bankRate(transaction)
    rows.push(
      bank
        ? {
            label: ct("Bank rate"),
            value: `${formatNumber(bank)} ${rate.second}`,
          }
        : {
            label: ct("Rate used"),
            value: `${new Decimal(rate.rate).toFixed()} ${rate.second}`,
          }
    )
  }
  rows.push({ label: ct("New balance"), value: joinedMoney(saved.newBalances) })
  return rows
}

/** "Arrived in Wallet · C$3,662.43" when the destination books another currency (iOS `arrivedRow`). */
function arrivedRow(
  ct: (key: string, ...args: (string | number)[]) => string,
  saved: SavedTransaction,
  destination: SavedTransaction["account"] | undefined
): ReceiptRow | undefined {
  const { transaction } = saved
  if (transaction.kind !== "transfer" || !destination) return undefined
  const arriving = share(transaction, destination)
  if (arriving.currency === transaction.currency) return undefined
  return {
    label: ct("Arrived in %@", accountName(destination)),
    value: "+" + formatMoney(arriving),
  }
}
