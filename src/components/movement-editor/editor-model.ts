import type { Account, AccountKind, Card, CardColor, TransactionKind } from "@/lib/schema"
import {
  accountCurrencies,
  accountIdFor,
  allowsDestination,
  allowsSource,
  movementKind,
  sourceKey,
  startOfDay,
  type Money,
  type MovementType,
  type PaymentSource,
  type TransactionContext,
} from "@/lib/domain"
import { formatMoney } from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"
import { accountName, cardNumber, debitTitle, methodTitle, networkName } from "@/lib/presentation/display"
import { deviceTimeZone } from "@/lib/platform/time-zone"

// Ports of the CreateTransaction view model's display logic (CreateTransactionViewModel+Display,
// +Accounts, +Review and NewMovementMenuViewModel), kept free of React.

const ct = (t: Translator, key: string, ...args: (string | number)[]) => t.in("createtransaction", key, ...args)

export function typeTitle(t: Translator, type: MovementType): string {
  return ct(t, { expense: "Expense", income: "Income", transfer: "Between my accounts", withdrawal: "ATM withdrawal", cardPayment: "Card payment" }[type])
}

export function typeSubtitle(t: Translator, type: MovementType): string {
  return ct(
    t,
    {
      expense: "A purchase, a bill, a subscription",
      income: "Salary, a refund, money you received",
      transfer: "Move money between your accounts and cash",
      withdrawal: "Take cash out of a bank account",
      cardPayment: "Pay what you owe on a credit card",
    }[type],
  )
}

export function amountQuestion(t: Translator, type: MovementType): string {
  return ct(
    t,
    {
      expense: "How much did you spend?",
      income: "How much did you receive?",
      transfer: "How much are you moving?",
      withdrawal: "How much did you withdraw?",
      cardPayment: "How much are you paying?",
    }[type],
  )
}

export function saveTitle(t: Translator, type: MovementType): string {
  return ct(t, { expense: "Save expense", income: "Save income", transfer: "Save transfer", withdrawal: "Save withdrawal", cardPayment: "Save card payment" }[type])
}

export function reviewTitle(t: Translator, type: MovementType): string {
  return ct(t, { expense: "You're about to log", income: "You're about to log", transfer: "You're about to move", withdrawal: "You're about to withdraw", cardPayment: "You're about to pay" }[type])
}

export function sourceQuestion(t: Translator, type: MovementType): string {
  if (type === "withdrawal") return ct(t, "Withdrawing from")
  if (type === "cardPayment") return ct(t, "Paying from")
  if (type === "transfer") return ct(t, "Moving from")
  return ct(t, type === "income" ? "Where did you receive it?" : "How did you pay?")
}

export function destinationQuestion(t: Translator, type: MovementType): string {
  if (type === "withdrawal") return ct(t, "Which cash is it going into?")
  if (type === "cardPayment") return ct(t, "Which card are you paying?")
  return ct(t, "Which account is it going to?")
}

export function categoryQuestion(t: Translator, kind: TransactionKind): string {
  return ct(t, kind === "income" ? "Where did it come from?" : "What was it for?")
}

/** What gets stored when the description is left empty. */
export function descriptionPlaceholder(t: Translator, type: MovementType, categoryName: string | undefined): string {
  switch (type) {
    case "expense":
    case "income":
      return categoryName ?? ct(t, "transfer.noun")
    case "transfer":
      return ct(t, "transfer.noun")
    case "withdrawal":
      return ct(t, "ATM withdrawal")
    case "cardPayment":
      return ct(t, "Card payment")
  }
}

/** iOS `CreateTransactionViewModel.message(for:)`. */
export function errorMessage(t: Translator, code: string | undefined): string {
  if (code === "invalidAmount") return ct(t, "Check the amount.")
  if (code === "invalidTransferDestination") return ct(t, "Choose a different destination account.")
  return ct(t, "We couldn't save the movement. Try again.")
}

// Payment methods.

export type Thumbnail = { kind: "card"; color: CardColor | undefined } | { kind: "transfer" } | { kind: "cash" }

export interface MethodRow {
  source: PaymentSource
  title: string
  subtitle?: string | undefined
  thumbnail: Thumbnail
}

export interface MethodGroup {
  title: string
  rows: MethodRow[]
}

export function lastUse(account: Account, context: TransactionContext): number {
  const keys = [...context.cards.filter((card) => card.accountId === account.id).map((card) => sourceKey({ type: "card", id: card.id })), sourceKey({ type: "account", id: account.id })]
  return Math.max(-Infinity, ...keys.map((key) => context.lastUsed.get(key)?.getTime() ?? -Infinity))
}

/** A bank account is its card: its transfer channel only shows when nothing else stands for the account. */
export function sourcesOf(account: Account, context: TransactionContext, keep?: PaymentSource): PaymentSource[] {
  const all = context.cards.filter((card) => card.accountId === account.id)
  if (all.length === 0) return [{ type: "account", id: account.id }]
  const order = ["debit", "creditHolder", "transfer"]
  const shown = all.some((card) => card.kind !== "transfer") ? all.filter((card) => card.kind !== "transfer" || (keep?.type === "card" && keep.id === card.id)) : all
  return [...shown].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)).map((card) => ({ type: "card", id: card.id }))
}

/** A movement last paid through the hidden transfer channel preselects the card shown in its place. */
export function pickerSource(source: PaymentSource, context: TransactionContext): PaymentSource {
  if (source.type !== "card") return source
  const card = context.cards.find((candidate) => candidate.id === source.id)
  if (card?.kind !== "transfer") return source
  const sibling = context.cards.find((candidate) => candidate.accountId === card.accountId && candidate.kind !== "transfer")
  return sibling ? { type: "card", id: sibling.id } : source
}

function currencyList(t: Translator, account: Account): string {
  return new Intl.ListFormat(t.locale, { type: "conjunction" }).format(accountCurrencies(account))
}

export function usedLabel(t: Translator, date: Date | undefined, now: Date = new Date()): string | undefined {
  if (!date) return undefined
  const days = Math.round((startOfDay(now, deviceTimeZone()).getTime() - startOfDay(date, deviceTimeZone()).getTime()) / 86_400_000)
  if (days < 1) return ct(t, "Used today")
  if (days === 1) return ct(t, "Used yesterday")
  return ct(t, "Used %lld days ago", days)
}

function holderSubtitle(t: Translator, account: Account | undefined, currency: string): string | undefined {
  if (!account || account.openingBalances.length < 2) return undefined
  const currencies = accountCurrencies(account)
  const debt = currencies.includes(currency) ? currency : (currencies[0] as string)
  return ct(t, "Purchase in %@ → debt in %@", currency, debt)
}

function rowFor(t: Translator, source: PaymentSource, context: TransactionContext, kind: TransactionKind, currency: string, grouped: boolean): MethodRow {
  if (source.type === "account") {
    const balance = context.balances.get(source.id)?.[0]
    const account = context.accounts.find((candidate) => candidate.id === source.id)
    return {
      source,
      title: account ? accountName(account) : ct(t, "Cash"),
      subtitle: balance ? ct(t, "%@ available", formatMoney(balance, { fractionDigits: 0 })) : undefined,
      thumbnail: { kind: "cash" },
    }
  }
  const card = context.cards.find((candidate) => candidate.id === source.id)
  if (!card) return { source, title: "", thumbnail: { kind: "transfer" } }
  const account = context.accounts.find((candidate) => candidate.id === card.accountId)
  const name = account ? accountName(account) : ""
  switch (card.kind) {
    case "debit":
      return {
        source,
        title: debitTitle(t, card),
        subtitle: grouped ? usedLabel(t, context.lastUsed.get(sourceKey(source))) : account ? `${name} · ${currencyList(t, account)}` : undefined,
        thumbnail: { kind: "card", color: card.color },
      }
    case "transfer": {
      const [title, subtitle] =
        kind === "expense"
          ? [ct(t, "Transfer or direct debit"), grouped ? ct(t, "Without the card, straight from the account") : ct(t, "Without the card, from %@", name)]
          : kind === "income"
            ? [ct(t, "Transfer or deposit"), grouped ? ct(t, "Straight into the account") : ct(t, "Straight into %@", name)]
            : [ct(t, "Bank transfer"), grouped ? ct(t, "Straight from the account") : ct(t, "Straight from %@", name)]
      return { source, title, subtitle, thumbnail: { kind: "transfer" } }
    }
    case "creditHolder":
      return grouped
        ? { source, title: ct(t, "Card"), subtitle: holderSubtitle(t, account, currency) ?? usedLabel(t, context.lastUsed.get(sourceKey(source))), thumbnail: { kind: "card", color: card.color } }
        : { source, title: cardNumber(t, card), subtitle: holderSubtitle(t, account, currency) ?? name, thumbnail: { kind: "card", color: card.color } }
  }
}

function groupTitle(t: Translator, account: Account, context: TransactionContext): string {
  const holder = account.kind === "credit" ? context.cards.find((card) => card.accountId === account.id && card.kind === "creditHolder") : undefined
  if (holder) return ct(t, "%@ •••• %@ · credit", networkName(t, holder.network), holder.lastFour ?? "")
  return `${accountName(account)} · ${currencyList(t, account)}`
}

/** The two most recently used accounts get their own section; the rest are grouped by what they are. */
export function methodGroups(t: Translator, context: TransactionContext, kind: TransactionKind, currency: string, keep?: PaymentSource): MethodGroup[] {
  const ranked = [...context.accounts].sort((a, b) => lastUse(b, context) - lastUse(a, context))
  const groups: MethodGroup[] = []
  for (const account of ranked.slice(0, 2)) {
    const rows = sourcesOf(account, context, keep).map((source) => rowFor(t, source, context, kind, currency, true))
    if (rows.length > 0) groups.push({ title: groupTitle(t, account, context), rows })
  }
  const titles: Record<AccountKind, string> = { deposit: ct(t, "Bank accounts"), cash: ct(t, "Cash"), credit: ct(t, "Credit cards") }
  for (const accountKind of ["deposit", "cash", "credit"] as const) {
    const rows = ranked
      .slice(2)
      .filter((account) => account.kind === accountKind)
      .flatMap((account) => sourcesOf(account, context, keep))
      .map((source) => rowFor(t, source, context, kind, currency, false))
    if (rows.length > 0) groups.push({ title: titles[accountKind], rows })
  }
  return groups
}

/** The method's name exactly as the movement will read in lists once saved. */
export function sourceTitle(t: Translator, source: PaymentSource | undefined, context: TransactionContext): string | undefined {
  if (!source) return undefined
  if (source.type === "card") {
    const card = context.cards.find((candidate) => candidate.id === source.id)
    if (card) return methodTitle(t, card, context.accounts.find((account) => account.id === card.accountId))
  }
  return rowFor(t, source, context, "expense", context.currencies.principal, false).title
}

// Accounts of transfers.

export function sourceAccounts(type: MovementType, context: TransactionContext): Account[] {
  return context.accounts.filter((account) => allowsSource(type, account)).sort((a, b) => lastUse(b, context) - lastUse(a, context))
}

export function destinationAccounts(type: MovementType, context: TransactionContext, sourceAccountId: string | undefined): Account[] {
  return context.accounts.filter((account) => allowsDestination(type, account, sourceAccountId))
}

/** Money leaves an account through its transfer channel when it has one; cash moves on its own. */
export function accountSource(accountId: string, context: TransactionContext): PaymentSource {
  const method = context.cards.find((card) => card.accountId === accountId && card.kind === "transfer")
  return method ? { type: "card", id: method.id } : { type: "account", id: accountId }
}

/** The account's art in rows: its plastic, a banknote for cash, a transfer tile otherwise. */
export function accountThumbnail(account: Account, cards: readonly Card[]): Thumbnail {
  if (account.kind === "cash") return { kind: "cash" }
  const card = cards.find((candidate) => candidate.accountId === account.id && (candidate.kind === "debit" || candidate.kind === "creditHolder"))
  return card ? { kind: "card", color: card.color } : { kind: "transfer" }
}

/** "Visa •••• 1234" under an account in the transfer lists: the card that identifies it. */
export function accountCardLabel(t: Translator, account: Account, context: TransactionContext): string | undefined {
  const card = context.cards.find((candidate) => candidate.accountId === account.id && (candidate.kind === "debit" || candidate.kind === "creditHolder"))
  if (!card) return undefined
  return card.kind === "debit" ? methodTitle(t, card, account) : cardNumber(t, card)
}

/** The balance in the currency being typed when the account holds it. */
export function balanceIn(balances: readonly Money[] | undefined, currency: string): Money | undefined {
  return balances?.find((balance) => balance.currency === currency) ?? balances?.[0]
}

export function sourceAccountOf(source: PaymentSource | undefined, context: TransactionContext): Account | undefined {
  const id = source ? accountIdFor(context, source) : undefined
  return context.accounts.find((account) => account.id === id)
}

export { movementKind }
