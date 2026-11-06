"use client"

import { AlertTriangleIcon, ArrowDownIcon, CalendarIcon, StickyNoteIcon } from "lucide-react"
import { useMemo, useRef, useState, type KeyboardEvent } from "react"

import type { EditorRequest } from "@/components/app/app-actions"
import { CategoryBadge } from "@/components/kw/primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import {
  Decimal,
  accountCurrencies,
  allowsSource,
  availableMovementTypes,
  convert,
  convertsCurrency,
  draftFrom,
  formatAmountInput,
  formatMoney,
  formatNumber,
  formatRate,
  isDomainError,
  lastUsedSource,
  movementKind,
  movementTypeOf,
  parseAmount,
  previewMovement,
  saveTransaction,
  settingsRate,
  type MovementType,
  type PaymentSource,
  type TransactionContext,
  type TransactionDraft,
  type Money,
} from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { accountName, categoryName, dayLabel } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"
import type { ExchangeRate, Transaction } from "@/lib/schema"
import { cn } from "@/lib/utils"

import {
  accountCardLabel,
  accountSource,
  accountThumbnail,
  amountQuestion,
  balanceIn,
  categoryQuestion,
  descriptionPlaceholder,
  destinationAccounts,
  destinationQuestion,
  errorMessage,
  methodGroups,
  pickerSource,
  reviewTitle,
  saveTitle,
  sourceAccountOf,
  sourceAccounts,
  sourceQuestion,
  sourceTitle,
  typeSubtitle,
  typeTitle,
  type Thumbnail,
} from "./editor-model"
import { NewCategoryDialog } from "./new-category-dialog"
import { AccountPicker, CategoryPicker, MethodPicker, MethodThumbnail } from "./pickers"

/** `<input type="datetime-local">` text for a date, in the person's time zone. */
function localDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
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

function initialState(request: EditorRequest, context: TransactionContext, types: MovementType[]): InitialState {
  if (request.mode === "edit") {
    const draft = draftFrom(request.transaction)
    return {
      type: movementTypeOf(request.transaction, context.accounts),
      amountText: formatNumber(draft.amount, Math.max(2, draft.amount.decimalPlaces())),
      currency: draft.currency,
      categoryId: draft.categoryId,
      source: draft.source,
      destinationId: draft.destinationAccountId,
      description: draft.description,
      date: draft.date,
      note: draft.note,
      isDraft: draft.isDraft,
      debitedText: draft.actualDebitedPrincipal ? formatNumber(draft.actualDebitedPrincipal) : "",
    }
  }
  const type = request.type && types.includes(request.type) ? request.type : (types[0] ?? "expense")
  const state: InitialState = {
    type,
    amountText: "",
    currency: context.currencies.principal,
    categoryId: undefined,
    source: undefined,
    destinationId: undefined,
    description: "",
    date: new Date(),
    note: "",
    isDraft: request.isDraft ?? false,
    debitedText: "",
  }
  return { ...state, ...defaultAccounts(type, context, request.accountId, state.source, state.currency) }
}

/** iOS `chooseDefaultAccounts` and the method step's default: the last used source that qualifies. */
function defaultAccounts(type: MovementType, context: TransactionContext, presetAccountId: string | undefined, current: PaymentSource | undefined, currency: string) {
  const preset = context.accounts.find((account) => account.id === presetAccountId)
  if (movementKind(type) !== "transfer") {
    if (preset) return { source: primarySource(preset.id, context) }
    if (current) return { source: current }
    const last = lastUsedSource(context)
    return { source: last ? pickerSource(last, context) : primarySource(context.accounts[0]?.id, context) }
  }
  const destinationId = preset && type === "cardPayment" && preset.kind === "credit" ? preset.id : undefined
  const sourceId =
    preset && allowsSource(type, preset) && preset.kind !== "credit"
      ? preset.id
      : (sourceAccounts(type, context).find((account) => account.id !== destinationId) ?? sourceAccounts(type, context)[0])?.id
  return { ...selectSource(type, context, sourceId, destinationId, currency) }
}

/** A bank account's card, a credit card's plastic, or cash on its own. */
function primarySource(accountId: string | undefined, context: TransactionContext): PaymentSource | undefined {
  if (!accountId) return undefined
  const cards = context.cards.filter((card) => card.accountId === accountId)
  const face = cards.find((card) => card.kind === "debit" || card.kind === "creditHolder") ?? cards[0]
  return face ? { type: "card", id: face.id } : { type: "account", id: accountId }
}

/** iOS `selectSourceAccount`: the transfer channel, keep a valid destination, type in the currency held. */
function selectSource(type: MovementType, context: TransactionContext, sourceId: string | undefined, destinationId: string | undefined, currency: string) {
  if (!sourceId) return { source: undefined, destinationId, currency }
  const destinations = destinationAccounts(type, context, sourceId)
  let destination = destinationId && destinations.some((account) => account.id === destinationId) ? destinationId : undefined
  if (!destination && destinations.length === 1) destination = destinations[0]?.id
  const account = context.accounts.find((candidate) => candidate.id === sourceId)
  const held = account ? accountCurrencies(account)[0] : undefined
  const options = [context.currencies.principal, ...(context.currencies.second ? [context.currencies.second] : [])]
  return { source: accountSource(sourceId, context), destinationId: destination, currency: held && options.includes(held) ? held : currency }
}

export function EditorForm({ request, context, onClose }: { request: EditorRequest; context: TransactionContext; onClose: () => void }) {
  const t = useT()
  const ct = (key: string, ...args: (string | number)[]) => t.in("createtransaction", key, ...args)
  const existing: Transaction | undefined = request.mode === "edit" ? request.transaction : undefined
  const types = useMemo(() => {
    const available = availableMovementTypes(context.accounts)
    // An edited movement keeps its own type even if the accounts changed since.
    return existing ? [...new Set([...available, movementTypeOf(existing, context.accounts)])] : available
  }, [context.accounts, existing])
  const [initial] = useState(() => initialState(request, context, types))

  const [type, setType] = useState(initial.type)
  const [amountText, setAmountText] = useState(initial.amountText)
  const [currency, setCurrency] = useState(initial.currency)
  const [categoryId, setCategoryId] = useState(initial.categoryId)
  const [source, setSource] = useState(initial.source)
  const [destinationId, setDestinationId] = useState(initial.destinationId)
  const [description, setDescription] = useState(initial.description)
  const [dateText, setDateText] = useState(localDateTime(initial.date))
  const [note, setNote] = useState(initial.note)
  const [isDraft, setIsDraft] = useState(initial.isDraft)
  const [debitedText, setDebitedText] = useState(initial.debitedText)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const descriptionRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const kind = movementKind(type)
  const movesBetweenAccounts = kind === "transfer"
  // An edit keeps the rate it was logged with, so its two currencies are the ones on offer.
  const rate: ExchangeRate = existing?.exchangeRate ?? settingsRate(context.currencies)
  const principal = rate.principal
  const currencies = rate.second !== rate.principal ? [rate.principal, rate.second] : [rate.principal]
  const amount = parseAmount(amountText)
  const date = useMemo(() => {
    const parsed = new Date(dateText)
    return Number.isNaN(parsed.getTime()) ? initial.date : parsed
  }, [dateText, initial.date])

  const sourceAccount = sourceAccountOf(source, context)
  const destinationAccount = context.accounts.find((account) => account.id === destinationId)
  const categories = context.categories.filter((category) => category.kind === kind)
  const category = categories.find((candidate) => candidate.id === categoryId)
  const categoryLabel = category ? categoryName(t, category) : undefined

  // "USD charged by the bank": paying in the second currency from an account kept in the principal one.
  const showsDebited = currency !== principal && sourceAccount !== undefined && accountCurrencies(sourceAccount).join() === principal
  const debited = showsDebited ? parseAmount(debitedText) : undefined
  const debitedInvalid = showsDebited && debitedText.trim() !== "" && (debited === undefined || debited.lte(0))

  const draft: TransactionDraft = {
    id: existing?.id ?? request.mode,
    kind,
    amount: amount ?? new Decimal(0),
    currency,
    ...(kind !== "transfer" && categoryId ? { categoryId } : {}),
    ...(source ? { source } : {}),
    ...(movesBetweenAccounts && destinationId ? { destinationAccountId: destinationId } : {}),
    description: description.trim() === "" ? descriptionPlaceholder(t, type, categoryLabel) : description,
    date,
    ...(debited && debited.gt(0) ? { actualDebitedPrincipal: debited } : {}),
    note,
    isDraft,
  }

  // Before an amount is typed the balances still matter: preview a cent so the rules run.
  const preview = useMemo(
    () => previewMovement(context, { ...draft, amount: amount && amount.gt(0) ? amount : new Decimal("0.01") }, existing),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the draft is rebuilt every render; these are what it depends on
    [context, existing, kind, amountText, currency, source, destinationId, debitedText, dateText],
  )
  const hasAmount = amount !== undefined && amount.gt(0)

  const availableLabel = (() => {
    if (kind === "income" || !sourceAccount) return undefined
    const balance = balanceIn(preview?.sourceBefore, currency)
    if (!balance) return undefined
    return sourceAccount.kind === "credit" ? ct("Card balance %@", formatMoney(balance)) : ct("Available %@", formatMoney(balance))
  })()
  const exceedsAvailable = (() => {
    if (!hasAmount || kind === "income" || !sourceAccount || sourceAccount.kind === "credit" || !preview?.leaving) return false
    const balance = preview.sourceBefore.find((money) => money.currency === preview.leaving?.currency)
    return balance ? preview.leaving.amount.gt(balance.amount) : false
  })()
  const conversionLine = (() => {
    if (rate.second === rate.principal) return undefined
    if (movesBetweenAccounts) {
      if (!hasAmount || !preview || !convertsCurrency(preview, currency)) return undefined
      const parts: string[] = []
      if (preview.leaving && preview.leaving.currency !== currency) parts.push(ct("Leaves as %@", formatMoney(preview.leaving)))
      if (preview.arriving && preview.arriving.currency !== currency) parts.push(ct("Arrives as %@", formatMoney(preview.arriving)))
      return [...parts, formatRate(rate)].join(" · ")
    }
    if (!hasAmount) return undefined
    const other = currency === rate.second ? rate.principal : rate.second
    return `≈ ${formatMoney(convert({ amount, currency }, rate, other))} · ${formatRate(rate)}`
  })()
  const bankRateLine =
    showsDebited && hasAmount && debited && debited.gt(0) ? `${ct("Bank rate")}: ${formatNumber(amount.div(debited), 4)} ${currency} / ${principal}` : undefined

  const balanceAfter = (balances: readonly Money[] | undefined) => {
    const balance = balanceIn(balances, currency)
    return balance && hasAmount ? ct("Balance after %@", formatMoney(balance)) : undefined
  }

  const canSave =
    hasAmount &&
    source !== undefined &&
    (movesBetweenAccounts ? destinationId !== undefined : category !== undefined) &&
    !debitedInvalid &&
    !saving

  function changeType(next: MovementType) {
    if (next === type) return
    setType(next)
    setError(undefined)
    const nextKind = movementKind(next)
    if (nextKind !== kind) setCategoryId(undefined)
    if (nextKind === "transfer") {
      const currentAccount = sourceAccount && allowsSource(next, sourceAccount) ? sourceAccount.id : undefined
      const fallback = (sourceAccounts(next, context).find((account) => account.id !== destinationId) ?? sourceAccounts(next, context)[0])?.id
      const chosen = selectSource(next, context, currentAccount ?? fallback, destinationId, currency)
      setSource(chosen.source)
      setDestinationId(chosen.destinationId)
      setCurrency(chosen.currency)
    } else {
      setDestinationId(undefined)
      if (source?.type === "card" && context.cards.find((card) => card.id === source.id)?.kind === "transfer" && !existing) setSource(pickerSource(source, context))
      if (!source) setSource(defaultAccounts(next, context, undefined, undefined, currency).source)
    }
  }

  function chooseSourceAccount(id: string) {
    const chosen = selectSource(type, context, id, destinationId, currency)
    setSource(chosen.source)
    setDestinationId(chosen.destinationId)
    setCurrency(chosen.currency)
    setDebitedText("")
  }

  async function save() {
    if (!canSave) {
      if (!hasAmount) setError(ct("Check the amount."))
      return
    }
    setSaving(true)
    setError(undefined)
    try {
      await saveTransaction(ledgerStore, { ...draft, id: existing?.id ?? crypto.randomUUID() })
      toast.add({ title: ct("Saved"), description: `${draft.description} · ${formatMoney({ amount: draft.amount, currency })}`, type: "success" })
      onClose()
    } catch (thrown) {
      setError(errorMessage(t, isDomainError(thrown) ? thrown.code : undefined))
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void save()
    }
  }

  function onAmountKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.metaKey || event.ctrlKey) return
    event.preventDefault()
    const formatted = formatAmountInput(amountText)
    if (formatted) setAmountText(formatted)
    // Enter advances: to the categories when one is still missing, else to the description.
    const search = formRef.current?.querySelector<HTMLInputElement>("[data-editor-category-search]")
    if (!movesBetweenAccounts && !category && search) search.focus()
    else descriptionRef.current?.focus()
  }

  const sourceTitleText = sourceTitle(t, source, context)
  const accountRow = (account: (typeof context.accounts)[number]): { title: string; subtitle?: string | undefined; trailing?: string | undefined; thumbnail: Thumbnail } => {
    const balance = context.balances.get(account.id)
    return {
      title: accountName(account),
      subtitle: accountCardLabel(t, account, context),
      trailing: balance ? balance.map((money) => formatMoney(money, { fractionDigits: 0 })).join(" · ") : undefined,
      thumbnail: accountThumbnail(account, context.cards),
    }
  }
  const title = existing ? t.in("web", "Edit transaction") : typeTitle(t, type)
  const amountClass = kind === "income" ? "text-positive" : "text-foreground"
  const primaryLabel = existing ? t.in("web", "Save changes") : isDraft ? ct("Save as draft") : saveTitle(t, type)

  return (
    <form
      ref={formRef}
      onKeyDown={onKeyDown}
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <header className="flex flex-col gap-3 border-b border-divider px-5 pt-5 pb-4 pr-12">
        <div className="flex items-center gap-2">
          <DialogTitle className="text-heading">{title}</DialogTitle>
          {isDraft ? <Badge className="bg-pending-tint text-pending">{ct("Draft")}</Badge> : null}
        </div>
        <DialogDescription className="sr-only">{ct("What are you recording?")}</DialogDescription>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="radiogroup" aria-label={ct("What are you recording?")}>
          {types.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={type === option}
              title={typeSubtitle(t, option)}
              onClick={() => changeType(option)}
              disabled={existing !== undefined && movementKind(option) !== movementKind(initial.type)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-label transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                type === option ? "bg-primary text-primary-foreground" : "bg-secondary text-text-secondary hover:bg-accent hover:text-foreground",
              )}
            >
              {typeTitle(t, option)}
            </button>
          ))}
        </div>
        <p className="text-caption text-muted-foreground">{typeSubtitle(t, type)}</p>
      </header>

      <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_340px] md:overflow-hidden">
        <div className="flex flex-col gap-6 px-5 py-5 md:overflow-y-auto">
          {movesBetweenAccounts ? (
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <h3 className="text-label text-text-secondary">{sourceQuestion(t, type)}</h3>
                <AccountPicker accounts={sourceAccounts(type, context)} value={sourceAccount?.id} onChange={chooseSourceAccount} describe={accountRow} />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-label text-text-secondary">{destinationQuestion(t, type)}</h3>
                {destinationAccounts(type, context, sourceAccount?.id).length === 0 ? (
                  <p className="text-caption text-muted-foreground">{ct("No account can receive it from this one.")}</p>
                ) : (
                  <AccountPicker accounts={destinationAccounts(type, context, sourceAccount?.id)} value={destinationId} onChange={setDestinationId} describe={accountRow} />
                )}
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            <label htmlFor="editor-amount" className="text-label text-text-secondary">
              {amountQuestion(t, type)}
            </label>
            <div className="flex items-center gap-2 rounded-2xl bg-secondary/50 px-4 py-3 ring-1 ring-border/60 focus-within:ring-2 focus-within:ring-ring">
              <input
                id="editor-amount"
                autoFocus
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amountText}
                onChange={(event) => {
                  setAmountText(event.target.value)
                  setError(undefined)
                }}
                onBlur={() => {
                  const formatted = formatAmountInput(amountText)
                  if (formatted) setAmountText(formatted)
                }}
                onKeyDown={onAmountKeyDown}
                aria-invalid={amountText.trim() !== "" && amount === undefined ? true : undefined}
                className={cn("min-w-0 flex-1 bg-transparent text-amount-lg tabular-nums outline-none placeholder:text-text-faint", amountClass)}
              />
              {currencies.length > 1 ? (
                <div className="flex shrink-0 rounded-full bg-background/60 p-0.5" role="radiogroup" aria-label={t.in("onboarding", "Currency")}>
                  {currencies.map((code) => (
                    <button
                      key={code}
                      type="button"
                      role="radio"
                      aria-checked={currency === code}
                      onClick={() => setCurrency(code)}
                      className={cn("rounded-full px-3 py-1 text-label transition-colors", currency === code ? "bg-primary text-primary-foreground" : "text-text-secondary hover:text-foreground")}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="shrink-0 text-label text-text-secondary">{currency}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-caption">
              {availableLabel ? (
                <span className={cn(exceedsAvailable ? "text-pending" : "text-muted-foreground")}>
                  {exceedsAvailable ? (
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangleIcon className="size-3.5" aria-hidden />
                      {ct("%@ · more than what's there", availableLabel)}
                    </span>
                  ) : (
                    availableLabel
                  )}
                </span>
              ) : null}
              {conversionLine ? <span className="text-muted-foreground tabular-nums">{conversionLine}</span> : null}
            </div>
            {showsDebited ? (
              <div className="flex flex-col gap-1.5 rounded-xl bg-secondary/30 p-3">
                <label htmlFor="editor-debited" className="text-caption text-text-secondary">
                  {ct("%@ charged by the bank", principal)}
                </label>
                <Input
                  id="editor-debited"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={ct("Optional · if a different rate was used")}
                  value={debitedText}
                  onChange={(event) => setDebitedText(event.target.value)}
                  onBlur={() => {
                    const formatted = formatAmountInput(debitedText)
                    if (formatted) setDebitedText(formatted)
                  }}
                  aria-invalid={debitedInvalid ? true : undefined}
                  className="h-9 tabular-nums"
                />
                {bankRateLine ? <span className="text-caption-sm text-muted-foreground tabular-nums">{bankRateLine}</span> : null}
              </div>
            ) : null}
          </section>

          {!movesBetweenAccounts ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-label text-text-secondary">{categoryQuestion(t, kind)}</h3>
              <CategoryPicker
                categories={categories}
                usage={context.categoryUsage}
                value={categoryId}
                onChange={(id) => {
                  setCategoryId(id)
                  setError(undefined)
                }}
                onCreate={() => setCreatingCategory(true)}
              />
              <NewCategoryDialog kind={kind} open={creatingCategory} onOpenChange={setCreatingCategory} onCreated={(created) => setCategoryId(created.id)} />
            </section>
          ) : null}

          {!movesBetweenAccounts ? (
            <section className="flex flex-col gap-2">
              <div className="flex flex-col">
                <h3 className="text-label text-text-secondary">{sourceQuestion(t, type)}</h3>
                <p className="text-caption text-muted-foreground">{ct(kind === "income" ? "The method decides which account increases." : "The method decides which account is charged.")}</p>
              </div>
              <MethodPicker groups={methodGroups(t, context, kind, currency, existing ? source : undefined)} value={source} onChange={setSource} />
            </section>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="editor-description" className="text-caption text-text-secondary">
                {ct("Description")}
              </label>
              <Input
                id="editor-description"
                ref={descriptionRef}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={descriptionPlaceholder(t, type, categoryLabel)}
                autoComplete="off"
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="editor-date" className="inline-flex items-center gap-1.5 text-caption text-text-secondary">
                <CalendarIcon className="size-3.5" aria-hidden />
                {ct("Date")}
              </label>
              <Input id="editor-date" type="datetime-local" value={dateText} onChange={(event) => setDateText(event.target.value)} className="h-9 [color-scheme:dark]" />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-3 py-2">
              <label htmlFor="editor-draft" className="flex flex-col">
                <span className="text-label">{ct("Save as draft")}</span>
                <span className="text-caption-sm text-muted-foreground">{t.in("transactions", "Drafts · they don't affect balances")}</span>
              </label>
              <Switch id="editor-draft" checked={isDraft} onCheckedChange={setIsDraft} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="editor-note" className="inline-flex items-center gap-1.5 text-caption text-text-secondary">
                <StickyNoteIcon className="size-3.5" aria-hidden />
                {ct("Note")}
              </label>
              <Textarea id="editor-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder={ct("Add a note")} rows={2} />
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4 border-t border-divider bg-secondary/25 px-5 py-5 md:overflow-y-auto md:border-t-0 md:border-l">
          <span className="text-caption text-muted-foreground">{reviewTitle(t, type)}</span>
          <div className="flex items-center gap-3">
            {movesBetweenAccounts ? null : <CategoryBadge category={category} size="lg" />}
            <div className="flex min-w-0 flex-col">
              <span className={cn("truncate text-amount-sm tabular-nums", amountClass)}>{formatMoney({ amount: hasAmount ? amount : new Decimal(0), currency })}</span>
              <span className="truncate text-caption text-muted-foreground">
                {[movesBetweenAccounts ? (destinationAccount ? ct("To %@", accountName(destinationAccount)) : undefined) : categoryLabel, sourceTitleText].filter(Boolean).join(" · ")}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {sourceAccount ? (
              <Party
                caption={ct(kind === "expense" ? "Paid with" : kind === "income" ? "Into" : "From")}
                title={movesBetweenAccounts ? accountName(sourceAccount) : (sourceTitleText ?? accountName(sourceAccount))}
                detail={balanceAfter(preview?.sourceAfter)}
                thumbnail={
                  source?.type === "card" && context.cards.find((card) => card.id === source.id)?.kind !== "transfer"
                    ? { kind: "card", color: context.cards.find((card) => card.id === source.id)?.color }
                    : accountThumbnail(sourceAccount, context.cards)
                }
              />
            ) : null}
            {movesBetweenAccounts && destinationAccount ? (
              <>
                <ArrowDownIcon className="mx-auto size-4 text-muted-foreground" aria-hidden />
                <Party caption={ct("To")} title={accountName(destinationAccount)} detail={balanceAfter(preview?.destinationAfter)} thumbnail={accountThumbnail(destinationAccount, context.cards)} />
              </>
            ) : null}
          </div>

          <dl className="flex flex-col gap-1.5 text-caption">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{ct("Date")}</dt>
              <dd>{dayLabel(t, date)}</dd>
            </div>
            {conversionLine ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{ct("Rate used")}</dt>
                <dd className="text-right tabular-nums">{formatRate(rate)}</dd>
              </div>
            ) : null}
          </dl>

          {isDraft ? <p className="rounded-lg bg-pending-tint px-3 py-2 text-caption text-pending">{t.in("web", "Saved as a draft, it doesn't affect balances until you confirm it.")}</p> : null}
          {existing && rate.second !== rate.principal ? <p className="text-caption-sm text-muted-foreground">{t.in("web", "Edits keep the rate this transaction was logged with.")}</p> : null}

          <div className="mt-auto flex flex-col gap-2 pt-2">
            {error ? (
              <p role="alert" className="text-caption text-negative">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="lg" disabled={!canSave} className="h-11 w-full justify-between">
              <span>{primaryLabel}</span>
              <Kbd className="bg-black/10 text-primary-foreground/70">⌘↵</Kbd>
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} className="w-full">
              {t.in("web", "Cancel")}
            </Button>
          </div>
        </aside>
      </div>
    </form>
  )
}

function Party({ caption, title, detail, thumbnail }: { caption: string; title: string; detail?: string | undefined; thumbnail: Thumbnail }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 ring-1 ring-border/60">
      <MethodThumbnail thumbnail={thumbnail} />
      <div className="flex min-w-0 flex-col">
        <span className="text-caption-sm text-muted-foreground">{caption}</span>
        <span className="truncate text-label">{title}</span>
        {detail ? <span className="truncate text-caption-sm text-muted-foreground tabular-nums">{detail}</span> : null}
      </div>
    </div>
  )
}

