import type { EditorRequest } from "@/components/app/app-actions"
import {
  Decimal,
  accountCurrencies,
  allowsSource,
  availableMovementTypes,
  convert,
  convertsCurrency,
  draftFrom,
  lastUsedSource,
  movementKind,
  movementTypeOf,
  settingsRate,
  type Money,
  type MovementPreview,
  type MovementType,
  type PaymentSource,
  type TransactionContext,
  type TransactionDraft,
} from "@/lib/domain"
import {
  formatMoney,
  formatNumber,
  formatRate,
  parseAmount,
} from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"
import { accountName, categoryName, dayLabel } from "@/lib/presentation/display"
import type { Account, ExchangeRate, Transaction } from "@/lib/schema"

import {
  accountCardLabel,
  accountSource,
  accountThumbnail,
  balanceIn,
  descriptionPlaceholder,
  destinationAccounts,
  pickerSource,
  saveTitle,
  sourceAccountOf,
  sourceAccounts,
  typeTitle,
  type Thumbnail,
} from "./editor-model"

// The movement editor's state and the values derived from it, kept free of React so the
// form's components only render (CreateTransactionViewModel's state, +Accounts and +Review).

/** `t.in("createtransaction", …)`, the table almost every editor string comes from. */
export type CreateTransactionText = (
  key: string,
  ...args: (string | number)[]
) => string

/** What the person edits; one object so a type change can reset several fields at once. */
export interface EditorFields {
  type: MovementType
  amountText: string
  currency: string
  categoryId: string | undefined
  source: PaymentSource | undefined
  destinationId: string | undefined
  description: string
  dateText: string
  note: string
  isDraft: boolean
  debitedText: string
}

/** `<input type="datetime-local">` text for a date, in the person's time zone. */
export function localDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Puts a picked day (`YYYY-MM-DD` from a date input) into a `localDateTime` text, keeping its time
 * of day. As on iOS, people pick only the day; the time stays the one the movement already had.
 */
export function withDay(dateText: string, day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return dateText
  const time = dateText.slice(11) || "12:00"
  return `${day}T${time}`
}

/** The movement types on offer; an edited movement keeps its own type even if the accounts changed since. */
export function editorTypes(
  context: TransactionContext,
  existing: Transaction | undefined
): MovementType[] {
  const available = availableMovementTypes(context.accounts)
  return existing
    ? [...new Set([...available, movementTypeOf(existing, context.accounts)])]
    : available
}

interface InitialState {
  type: MovementType
  amountText: string
  currency: string
  categoryId: string | undefined
  source: PaymentSource | undefined
  destinationId: string | undefined
  description: string
  date: Date
  note: string
  isDraft: boolean
  debitedText: string
}

function editedState(
  request: Extract<EditorRequest, { mode: "edit" }>,
  context: TransactionContext
): InitialState {
  const draft = draftFrom(request.transaction)
  return {
    type: movementTypeOf(request.transaction, context.accounts),
    amountText: formatNumber(
      draft.amount,
      Math.max(2, draft.amount.decimalPlaces())
    ),
    currency: draft.currency,
    categoryId: draft.categoryId,
    source: draft.source,
    destinationId: draft.destinationAccountId,
    description: draft.description,
    date: draft.date,
    note: draft.note,
    isDraft: draft.isDraft,
    debitedText: draft.actualDebitedPrincipal
      ? formatNumber(draft.actualDebitedPrincipal)
      : "",
  }
}

function initialState(
  request: EditorRequest,
  context: TransactionContext,
  types: MovementType[]
): InitialState {
  if (request.mode === "edit") return editedState(request, context)
  const type =
    request.type && types.includes(request.type)
      ? request.type
      : (types[0] ?? "expense")
  const state: InitialState = {
    type,
    amountText: "",
    currency: context.currencies.principal,
    // A category chosen before opening (Home's "Log quickly"), when it fits the movement.
    categoryId:
      request.categoryId &&
      context.categories.some((category) => category.id === request.categoryId)
        ? request.categoryId
        : undefined,
    source: undefined,
    destinationId: undefined,
    description: "",
    date: new Date(),
    note: "",
    isDraft: request.isDraft ?? false,
    debitedText: "",
  }
  return {
    ...state,
    ...defaultAccounts(
      type,
      context,
      request.accountId,
      state.source,
      state.currency
    ),
  }
}

/** The fields the editor opens with, plus the date to fall back on while the date text is invalid. */
export function initialFields(
  request: EditorRequest,
  context: TransactionContext,
  types: MovementType[]
): { fields: EditorFields; date: Date } {
  const { date, ...rest } = initialState(request, context, types)
  return { fields: { ...rest, dateText: localDateTime(date) }, date }
}

/** iOS `chooseDefaultAccounts` and the method step's default: the last used source that qualifies. */
function defaultAccounts(
  type: MovementType,
  context: TransactionContext,
  presetAccountId: string | undefined,
  current: PaymentSource | undefined,
  currency: string
) {
  const preset = context.accounts.find(
    (account) => account.id === presetAccountId
  )
  if (movementKind(type) !== "transfer") {
    if (preset) return { source: primarySource(preset.id, context) }
    if (current) return { source: current }
    const last = lastUsedSource(context)
    return {
      source: last
        ? pickerSource(last, context)
        : primarySource(context.accounts[0]?.id, context),
    }
  }
  const destinationId =
    preset && type === "cardPayment" && preset.kind === "credit"
      ? preset.id
      : undefined
  const sourceId =
    preset && allowsSource(type, preset) && preset.kind !== "credit"
      ? preset.id
      : fallbackSourceId(type, context, destinationId)
  return { ...selectSource(type, context, sourceId, destinationId, currency) }
}

/** The first account that can send this movement, preferring one that isn't the destination. */
function fallbackSourceId(
  type: MovementType,
  context: TransactionContext,
  destinationId: string | undefined
): string | undefined {
  return (
    sourceAccounts(type, context).find(
      (account) => account.id !== destinationId
    ) ?? sourceAccounts(type, context)[0]
  )?.id
}

/** A bank account's card, a credit card's plastic, or cash on its own. */
function primarySource(
  accountId: string | undefined,
  context: TransactionContext
): PaymentSource | undefined {
  if (!accountId) return undefined
  const cards = context.cards.filter((card) => card.accountId === accountId)
  const face =
    cards.find(
      (card) => card.kind === "debit" || card.kind === "creditHolder"
    ) ?? cards[0]
  return face
    ? { type: "card", id: face.id }
    : { type: "account", id: accountId }
}

/** iOS `selectSourceAccount`: the transfer channel, keep a valid destination, type in the currency held. */
export function selectSource(
  type: MovementType,
  context: TransactionContext,
  sourceId: string | undefined,
  destinationId: string | undefined,
  currency: string
) {
  if (!sourceId) return { source: undefined, destinationId, currency }
  const destinations = destinationAccounts(type, context, sourceId)
  let destination =
    destinationId &&
    destinations.some((account) => account.id === destinationId)
      ? destinationId
      : undefined
  if (!destination && destinations.length === 1)
    destination = destinations[0]?.id
  const account = context.accounts.find(
    (candidate) => candidate.id === sourceId
  )
  const held = account ? accountCurrencies(account)[0] : undefined
  const options = [
    context.currencies.principal,
    ...(context.currencies.second ? [context.currencies.second] : []),
  ]
  return {
    source: accountSource(sourceId, context),
    destinationId: destination,
    currency: held && options.includes(held) ? held : currency,
  }
}

function isTransferCard(
  source: PaymentSource | undefined,
  context: TransactionContext
): boolean {
  return (
    source?.type === "card" &&
    context.cards.find((card) => card.id === source.id)?.kind === "transfer"
  )
}

/** The fields to change when the person picks another movement type. */
export function typeChange(
  next: MovementType,
  fields: EditorFields,
  context: TransactionContext,
  existing: Transaction | undefined
): Partial<EditorFields> {
  const nextKind = movementKind(next)
  const patch: Partial<EditorFields> = { type: next }
  if (nextKind !== movementKind(fields.type)) patch.categoryId = undefined
  const sourceAccount = sourceAccountOf(fields.source, context)
  if (nextKind === "transfer") {
    const currentAccount =
      sourceAccount && allowsSource(next, sourceAccount)
        ? sourceAccount.id
        : undefined
    const chosen = selectSource(
      next,
      context,
      currentAccount ?? fallbackSourceId(next, context, fields.destinationId),
      fields.destinationId,
      fields.currency
    )
    return { ...patch, ...chosen }
  }
  patch.destinationId = undefined
  const { source } = fields
  if (source && isTransferCard(source, context) && !existing)
    patch.source = pickerSource(source, context)
  if (!source)
    patch.source = defaultAccounts(
      next,
      context,
      undefined,
      undefined,
      fields.currency
    ).source
  return patch
}

/** "USD charged by the bank": paying in the second currency from an account kept in the principal one. */
function debitedState(
  fields: EditorFields,
  principal: string,
  sourceAccount: Account | undefined
) {
  const showsDebited =
    fields.currency !== principal &&
    sourceAccount !== undefined &&
    accountCurrencies(sourceAccount).join() === principal
  const debited = showsDebited ? parseAmount(fields.debitedText) : undefined
  const debitedInvalid =
    showsDebited &&
    fields.debitedText.trim() !== "" &&
    (debited === undefined || debited.lte(0))
  return { showsDebited, debited, debitedInvalid }
}

function parseDate(text: string, fallback: Date): Date {
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

/** Everything the form shows that follows from the fields alone, up to the draft it would save. */
export function deriveForm(
  t: Translator,
  context: TransactionContext,
  request: EditorRequest,
  fields: EditorFields,
  fallbackDate: Date
) {
  const existing = request.mode === "edit" ? request.transaction : undefined
  const kind = movementKind(fields.type)
  const movesBetweenAccounts = kind === "transfer"
  // An edit keeps the rate it was logged with, so its two currencies are the ones on offer.
  const rate: ExchangeRate =
    existing?.exchangeRate ?? settingsRate(context.currencies)
  const currencies =
    rate.second !== rate.principal
      ? [rate.principal, rate.second]
      : [rate.principal]
  const sourceAccount = sourceAccountOf(fields.source, context)
  const categories = context.categories.filter(
    (category) => category.kind === kind
  )
  const category = categories.find(
    (candidate) => candidate.id === fields.categoryId
  )
  const base = {
    existing,
    kind,
    movesBetweenAccounts,
    rate,
    principal: rate.principal,
    currencies,
    amount: parseAmount(fields.amountText),
    date: parseDate(fields.dateText, fallbackDate),
    sourceAccount,
    destinationAccount: context.accounts.find(
      (account) => account.id === fields.destinationId
    ),
    categories,
    category,
    categoryLabel: category ? categoryName(t, category) : undefined,
    ...debitedState(fields, rate.principal, sourceAccount),
  }
  return {
    ...base,
    draft: buildDraft(t, request, fields, base),
  }
}

function buildDraft(
  t: Translator,
  request: EditorRequest,
  fields: EditorFields,
  form: {
    existing: Transaction | undefined
    kind: TransactionDraft["kind"]
    movesBetweenAccounts: boolean
    amount: Decimal | undefined
    date: Date
    categoryLabel: string | undefined
    debited: Decimal | undefined
  }
): TransactionDraft {
  const { categoryId, source, destinationId, description } = fields
  return {
    id: form.existing?.id ?? request.mode,
    kind: form.kind,
    amount: form.amount ?? new Decimal(0),
    currency: fields.currency,
    ...(form.kind !== "transfer" && categoryId ? { categoryId } : {}),
    ...(source ? { source } : {}),
    ...(form.movesBetweenAccounts && destinationId
      ? { destinationAccountId: destinationId }
      : {}),
    description:
      description.trim() === ""
        ? descriptionPlaceholder(t, fields.type, form.categoryLabel)
        : description,
    date: form.date,
    ...(form.debited && form.debited.gt(0)
      ? { actualDebitedPrincipal: form.debited }
      : {}),
    note: fields.note,
    isDraft: fields.isDraft,
  }
}

export type FormModel = ReturnType<typeof deriveForm>

/** Before an amount is typed the balances still matter: preview a cent so the rules run. */
export function previewDraft(form: FormModel): TransactionDraft {
  return {
    ...form.draft,
    amount:
      form.amount && form.amount.gt(0) ? form.amount : new Decimal("0.01"),
  }
}

function availableLabelOf(
  ct: CreateTransactionText,
  form: FormModel,
  preview: MovementPreview | undefined,
  currency: string
): string | undefined {
  const { kind, sourceAccount } = form
  if (kind === "income" || !sourceAccount) return undefined
  const balance = balanceIn(preview?.sourceBefore, currency)
  if (!balance) return undefined
  return sourceAccount.kind === "credit"
    ? ct("Card balance %@", formatMoney(balance))
    : ct("Available %@", formatMoney(balance))
}

function exceedsAvailableOf(
  form: FormModel,
  preview: MovementPreview | undefined,
  hasAmount: boolean
): boolean {
  const { kind, sourceAccount } = form
  if (
    !hasAmount ||
    kind === "income" ||
    !sourceAccount ||
    sourceAccount.kind === "credit" ||
    !preview?.leaving
  )
    return false
  const balance = preview.sourceBefore.find(
    (money) => money.currency === preview.leaving?.currency
  )
  return balance ? preview.leaving.amount.gt(balance.amount) : false
}

function transferConversionLine(
  ct: CreateTransactionText,
  rate: ExchangeRate,
  preview: MovementPreview,
  currency: string
): string | undefined {
  if (!convertsCurrency(preview, currency)) return undefined
  const parts: string[] = []
  if (preview.leaving && preview.leaving.currency !== currency)
    parts.push(ct("Leaves as %@", formatMoney(preview.leaving)))
  if (preview.arriving && preview.arriving.currency !== currency)
    parts.push(ct("Arrives as %@", formatMoney(preview.arriving)))
  return [...parts, formatRate(rate)].join(" · ")
}

function conversionLineOf(
  ct: CreateTransactionText,
  form: FormModel,
  preview: MovementPreview | undefined,
  currency: string
): string | undefined {
  const { rate, amount } = form
  if (rate.second === rate.principal) return undefined
  if (!amount || !amount.gt(0)) return undefined
  if (form.movesBetweenAccounts)
    return preview
      ? transferConversionLine(ct, rate, preview, currency)
      : undefined
  const other = currency === rate.second ? rate.principal : rate.second
  return `≈ ${formatMoney(convert({ amount, currency }, rate, other))} · ${formatRate(rate)}`
}

function bankRateLineOf(
  ct: CreateTransactionText,
  form: FormModel,
  currency: string
): string | undefined {
  const { amount, debited } = form
  return form.showsDebited && amount && amount.gt(0) && debited && debited.gt(0)
    ? `${ct("Bank rate")}: ${formatNumber(amount.div(debited), 4)} ${currency} / ${form.principal}`
    : undefined
}

/** What follows from the live preview: balances, conversions and whether the movement can be saved. */
export function deriveReview(
  ct: CreateTransactionText,
  form: FormModel,
  fields: EditorFields,
  preview: MovementPreview | undefined,
  saving: boolean
) {
  const hasAmount = form.amount !== undefined && form.amount.gt(0)
  const linked = form.movesBetweenAccounts
    ? fields.destinationId !== undefined
    : form.category !== undefined
  return {
    hasAmount,
    availableLabel: availableLabelOf(ct, form, preview, fields.currency),
    exceedsAvailable: exceedsAvailableOf(form, preview, hasAmount),
    conversionLine: conversionLineOf(ct, form, preview, fields.currency),
    bankRateLine: bankRateLineOf(ct, form, fields.currency),
    canSave:
      hasAmount &&
      fields.source !== undefined &&
      linked &&
      !form.debitedInvalid &&
      !saving,
  }
}

export type EditorReview = ReturnType<typeof deriveReview>

/** The balance line under a party once an amount is typed. */
export function balanceAfter(
  ct: CreateTransactionText,
  balances: readonly Money[] | undefined,
  currency: string,
  hasAmount: boolean
): string | undefined {
  const balance = balanceIn(balances, currency)
  return balance && hasAmount
    ? ct("Balance after %@", formatMoney(balance))
    : undefined
}

/** An account picker row: its name, the card on it and the balances it holds. */
export function accountRow(
  t: Translator,
  account: Account,
  context: TransactionContext
): {
  title: string
  subtitle?: string | undefined
  trailing?: string | undefined
  thumbnail: Thumbnail
} {
  const balance = context.balances.get(account.id)
  return {
    title: accountName(account),
    // Only the edited movement's own account can be closed here (`pickerContext`).
    subtitle: account.closedAt ? t.in("sharedpresentation", "Closed") : accountCardLabel(t, account, context),
    trailing: balance
      ? balance
          .map((money) => formatMoney(money, { fractionDigits: 0 }))
          .join(" · ")
      : undefined,
    thumbnail: accountThumbnail(account, context.cards),
  }
}

/** The submit button's title: saving changes, a draft, or the movement type. */
export function primaryLabel(
  t: Translator,
  ct: CreateTransactionText,
  existing: Transaction | undefined,
  fields: EditorFields
): string {
  if (existing) return t.in("createtransaction", "Save changes")
  return fields.isDraft ? ct("Save as draft") : saveTitle(t, fields.type)
}

/** The amount line under the input: what's available, flagged when the amount goes over it. */
export function availableText(
  ct: CreateTransactionText,
  form: FormModel,
  review: EditorReview,
  sourceTitleText: string | undefined
): string | undefined {
  const label = review.availableLabel
  if (!label) return undefined
  if (review.exceedsAvailable) return ct("%@ · more than what's there", label)
  return form.kind === "expense" && sourceTitleText
    ? `${sourceTitleText} · ${label}`
    : label
}

function accountsRows(ct: CreateTransactionText, form: FormModel) {
  const { sourceAccount, destinationAccount } = form
  return [
    ...(sourceAccount
      ? [{ label: ct("From"), value: accountName(sourceAccount) }]
      : []),
    ...(destinationAccount
      ? [{ label: ct("To"), value: accountName(destinationAccount) }]
      : []),
  ]
}

function methodRows(
  ct: CreateTransactionText,
  form: FormModel,
  sourceTitleText: string | undefined
) {
  const { sourceAccount, categoryLabel } = form
  return [
    {
      label: ct("Method"),
      value:
        sourceTitleText ?? (sourceAccount ? accountName(sourceAccount) : "—"),
    },
    ...(categoryLabel ? [{ label: ct("Category"), value: categoryLabel }] : []),
  ]
}

/** The receipt ticket's rows, in the iOS review's order. */
export function reviewRows(
  t: Translator,
  ct: CreateTransactionText,
  form: FormModel,
  review: EditorReview,
  note: string,
  sourceTitleText: string | undefined
): { label: string; value: string }[] {
  return [
    ...(form.movesBetweenAccounts
      ? accountsRows(ct, form)
      : methodRows(ct, form, sourceTitleText)),
    { label: ct("Date"), value: dayLabel(t, form.date) },
    ...(review.conversionLine
      ? [{ label: ct("Rate used"), value: formatRate(form.rate) }]
      : []),
    ...(note.trim() ? [{ label: ct("Note"), value: note.trim() }] : []),
  ]
}

/** The paying party's caption key: who pays, receives, or sends. */
export function sourceCaptionKey(kind: TransactionDraft["kind"]): string {
  if (kind === "expense") return "Paid with"
  return kind === "income" ? "Into" : "From"
}

/** A chosen card shows its own plastic; a transfer channel or an account shows the account. */
export function sourceThumbnail(
  source: PaymentSource | undefined,
  sourceAccount: Account,
  context: TransactionContext
): Thumbnail {
  if (source?.type !== "card" || isTransferCard(source, context))
    return accountThumbnail(sourceAccount, context.cards)
  return {
    kind: "card",
    color: context.cards.find((card) => card.id === source.id)?.color,
  }
}

/** The movement type picker's options; an edit can't switch between kinds. */
export function typeOptions(
  t: Translator,
  types: MovementType[],
  existing: Transaction | undefined,
  initialType: MovementType
): { value: MovementType; title: string; disabled: boolean }[] {
  return types.map((option) => ({
    value: option,
    title: typeTitle(t, option),
    disabled:
      existing !== undefined &&
      movementKind(option) !== movementKind(initialType),
  }))
}
