"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { KWButton, KWCircleButton } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import type { KWIconName } from "@/components/kw/kw-icon-data"
import { CardArt } from "@/components/kw/primitives"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { OptionSelect } from "@/components/kw/pickers"
import { toast } from "@/components/ui/toast"
import { useLedger, usePreferredName } from "@/hooks/use-ledger"
import { ZERO, addAccount, addCreditCard, parseAmount } from "@/lib/domain"
import { useT, type Translator } from "@/lib/i18n"
import type {
  CardColor,
  CardNetwork,
  CurrencySettings,
  DebtMode,
} from "@/lib/schema"
import {
  cardKindLabel,
  networkName,
  SELECTABLE_CARD_COLORS,
} from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"

import {
  AmountInput,
  ColorSwatches,
  KW_INPUT,
  LabeledField,
  NETWORKS,
  Segmented,
  digitsOnly,
  domainErrorText,
} from "./form-parts"
import { DaySelect } from "./manage-dialogs"

type Kind = "debit" | "credit" | "wallet"

/** "Add account or card" (iOS AddCardFlowView): pick what to add, then its one form. */
export function AddAccountDialog() {
  const t = useT()
  const { addAccount: request, closeAddAccount } = useAppActions()
  const ledger = useLedger()
  const [chosen, setChosen] = useState<Kind>()
  const [lastRequest, setLastRequest] = useState(request)
  // A new request starts on what it asks for, or on the menu.
  if (request !== lastRequest) {
    setLastRequest(request)
    setChosen(request?.kind)
  }
  const currencies = ledger?.settings.currencies ?? {
    principal: "USD",
    rate: "1",
  }
  const kind = chosen

  return (
    <Dialog
      open={request !== undefined}
      onOpenChange={(open) => !open && closeAddAccount()}
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] gap-5 overflow-y-auto rounded-2xl bg-nav p-6 ring-divider sm:max-w-lg">
        {kind === undefined ? (
          <>
            <DialogHeader>
              <DialogTitle className="type-title-sm text-foreground">
                {t.in("addcard", "What do you want to add?")}
              </DialogTitle>
              <DialogDescription className="type-body text-muted-foreground">
                {t.in(
                  "addcard",
                  "We never ask for the full number or the CVV."
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card">
              <Choice
                icon="bank"
                title={t.in("addcard", "Debit card")}
                description={t.in(
                  "addcard",
                  "Your bank account, shown as its card: balance, bank and last 4"
                )}
                onClick={() => setChosen("debit")}
              />
              <Choice
                icon="creditCard"
                title={t.in("addcard", "Credit card")}
                description={t.in(
                  "addcard",
                  "It's its own account: debt in one or two currencies, cutoff and due dates"
                )}
                onClick={() => setChosen("credit")}
              />
              <Choice
                icon="wallet"
                title={t.in("addcard", "Other wallet")}
                description={t.in("addcard", "Without a card")}
                onClick={() => setChosen("wallet")}
              />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <KWCircleButton
                  icon="chevronLeft"
                  size={32}
                  label={t.in("web", "Back")}
                  onClick={() => setChosen(undefined)}
                />
                <DialogTitle className="type-heading text-foreground">
                  {kind === "debit"
                    ? t.in("addcard", "Your debit card")
                    : kind === "credit"
                      ? t.in("addcard", "Your credit card")
                      : t.in("addcard", "Other wallet")}
                </DialogTitle>
              </div>
            </DialogHeader>
            {kind === "credit" ? (
              <CreditForm
                t={t}
                currencies={currencies}
                onDone={closeAddAccount}
              />
            ) : (
              <AccountForm
                t={t}
                kind={kind}
                currencies={currencies}
                onDone={closeAddAccount}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** One of the iOS add-card choices: icon, title and what it is, as a navigation row. */
function Choice({
  icon,
  title,
  description,
  onClick,
}: {
  icon: KWIconName
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50"
    >
      <span
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-link"
        aria-hidden
      >
        <KWIcon name={icon} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="type-label text-foreground">{title}</span>
        <span className="type-caption text-muted-foreground">
          {description}
        </span>
      </span>
      <KWIcon name="chevronRight" size={16} className="text-text-faint" />
    </button>
  )
}

function currencyChoices(currencies: CurrencySettings): string[] {
  return currencies.second
    ? [currencies.principal, currencies.second]
    : [currencies.principal]
}

function useAfterAdding() {
  const router = useRouter()
  return (accountId: string, onDone: () => void, title: string) => {
    toast.add({ title, type: "success" })
    onDone()
    router.push(`/accounts?id=${accountId}`)
  }
}

/** Debit card (a bank account with its card) and Other wallet (cash). */
function AccountForm({
  t,
  kind,
  currencies,
  onDone,
}: {
  t: Translator
  kind: "debit" | "wallet"
  currencies: CurrencySettings
  onDone: () => void
}) {
  const owner = usePreferredName()
  const afterAdding = useAfterAdding()
  const [form, setForm] = useState({
    bank: "",
    name: "",
    currency: currencies.principal,
    balance: "",
    lastFour: "",
    network: "visa" as CardNetwork | "",
    color: "verde" as CardColor,
  })
  const [errors, setErrors] = useState<{
    name?: string
    balance?: string
    lastFour?: string
    form?: string
  }>({})
  const [busy, setBusy] = useState(false)
  const isBank = kind === "debit"

  async function submit(event: FormEvent) {
    event.preventDefault()
    const balance =
      form.balance.trim() === "" ? ZERO : parseAmount(form.balance)
    const next: typeof errors = {}
    if (form.name.trim() === "")
      next.name = t.in("accounts", "Write a name for the account.")
    if (!balance) next.balance = t.in("addcard", "Check the balance.")
    if (isBank && form.lastFour !== "" && form.lastFour.length !== 4)
      next.lastFour = t.in(
        "onboarding",
        "Enter all 4 digits or leave it empty."
      )
    setErrors(next)
    if (Object.keys(next).length > 0 || !balance) return
    setBusy(true)
    try {
      const account = await addAccount(ledgerStore, {
        kind: isBank ? "deposit" : "cash",
        name: form.name,
        ...(isBank && form.bank.trim() ? { bank: form.bank } : {}),
        balance: { amount: balance, currency: form.currency },
        ...(isBank
          ? {
              debitCard: {
                ...(form.lastFour ? { lastFour: form.lastFour } : {}),
                ...(form.network ? { network: form.network } : {}),
                color: form.color,
              },
            }
          : {}),
      })
      afterAdding(
        account.id,
        onDone,
        isBank ? t.in("addcard", "Card added") : account.name
      )
    } catch (error) {
      setErrors({
        form: domainErrorText(
          t,
          error,
          t.in("addcard", "We couldn't save the account.")
        ),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-4"
    >
      {isBank ? (
        <div className="mx-auto w-full max-w-xs">
          <CardArt
            color={form.color}
            bank={form.bank || t.in("addcard", "Bank")}
            network={form.network || undefined}
            lastFour={form.lastFour.length === 4 ? form.lastFour : undefined}
            kind="debit"
            kindLabel={cardKindLabel(t, "debit")}
            holder={owner?.toLocaleUpperCase(t.locale)}
          />
        </div>
      ) : null}
      {isBank ? (
        <LabeledField id="add-bank" label={t.in("addcard", "Bank")}>
          <Input
            className={KW_INPUT}
            id="add-bank"
            placeholder={t.in("addcard", "Bank name")}
            value={form.bank}
            maxLength={40}
            onChange={(event) => setForm({ ...form, bank: event.target.value })}
          />
        </LabeledField>
      ) : null}
      <LabeledField
        id="add-name"
        label={isBank ? t.in("addcard", "Account") : t.in("addcard", "Name")}
        error={errors.name}
      >
        <Input
          className={KW_INPUT}
          id="add-name"
          autoFocus
          placeholder={
            isBank ? t.in("addcard", "Savings") : t.in("addcard", "Envelope")
          }
          value={form.name}
          maxLength={40}
          aria-invalid={errors.name ? true : undefined}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </LabeledField>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <LabeledField
          id="add-balance"
          label={t.in("addcard", "Today's balance")}
          error={errors.balance}
        >
          <AmountInput
            id="add-balance"
            currency={form.currency}
            value={form.balance}
            invalid={errors.balance !== undefined}
            onChange={(balance) => setForm({ ...form, balance })}
          />
        </LabeledField>
        <LabeledField id="add-currency" label={t.in("addcard", "Currency")}>
          <OptionSelect
            id="add-currency"
            value={form.currency}
            onChange={(currency) => setForm({ ...form, currency })}
            options={currencyChoices(currencies).map((code) => ({
              value: code,
              label: code,
            }))}
          />
        </LabeledField>
      </div>
      {isBank ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <LabeledField
              id="add-digits"
              label={t.in("addcard", "Last 4 digits")}
              error={errors.lastFour}
            >
              <Input
                id="add-digits"
                inputMode="numeric"
                placeholder="0000"
                className={`${KW_INPUT} tracking-widest tabular-nums`}
                value={form.lastFour}
                aria-invalid={errors.lastFour ? true : undefined}
                onChange={(event) =>
                  setForm({ ...form, lastFour: digitsOnly(event.target.value) })
                }
              />
            </LabeledField>
            <LabeledField id="add-network" label={t.in("addcard", "Network")}>
              <OptionSelect<CardNetwork | "">
                id="add-network"
                value={form.network}
                onChange={(network) => setForm({ ...form, network })}
                options={[
                  { value: "", label: t.in("addcard", "Not set") },
                  ...NETWORKS.map((network) => ({
                    value: network,
                    label: networkName(t, network),
                  })),
                ]}
              />
            </LabeledField>
          </div>
          <LabeledField id="add-color" label={t.in("accounts", "Card color")}>
            <ColorSwatches
              t={t}
              value={form.color}
              onChange={(color) => setForm({ ...form, color })}
              colors={SELECTABLE_CARD_COLORS}
            />
          </LabeledField>
        </>
      ) : null}
      {errors.form ? (
        <p role="alert" className="type-caption text-negative">
          {errors.form}
        </p>
      ) : null}
      <KWButton type="submit" size="large" fill disabled={busy}>
        {isBank ? t.in("addcard", "Add card") : t.in("addcard", "Add")}
      </KWButton>
    </form>
  )
}

function CreditForm({
  t,
  currencies,
  onDone,
}: {
  t: Translator
  currencies: CurrencySettings
  onDone: () => void
}) {
  const owner = usePreferredName()
  const afterAdding = useAfterAdding()
  const second = currencies.second
  const [form, setForm] = useState({
    bank: "",
    lastFour: "",
    network: "visa" as CardNetwork,
    color: "azul" as CardColor,
    debtMode: (second ? "dual" : "principal") as DebtMode,
    principalDebt: "",
    secondDebt: "",
    limit: "",
    cutoff: "",
    due: "",
  })
  const [errors, setErrors] = useState<{
    lastFour?: string
    principalDebt?: string
    secondDebt?: string
    limit?: string
    form?: string
  }>({})
  const [busy, setBusy] = useState(false)
  const debtCurrency =
    form.debtMode === "second" && second ? second : currencies.principal

  async function submit(event: FormEvent) {
    event.preventDefault()
    const amount = (text: string) =>
      text.trim() === "" ? ZERO : parseAmount(text)
    const principalDebt = amount(form.principalDebt)
    const secondDebt = form.debtMode === "dual" ? amount(form.secondDebt) : ZERO
    const limit = form.limit.trim() === "" ? undefined : parseAmount(form.limit)
    const next: typeof errors = {}
    if (form.lastFour.length !== 4)
      next.lastFour = t.in(
        "onboarding",
        "Enter all 4 digits or leave it empty."
      )
    if (!principalDebt)
      next.principalDebt = t.in("addcard", "Check the balance.")
    if (!secondDebt) next.secondDebt = t.in("addcard", "Check the balance.")
    if (form.limit.trim() !== "" && (!limit || limit.lte(0)))
      next.limit = t.in("creditcard", "Check the credit limit.")
    setErrors(next)
    if (Object.keys(next).length > 0 || !principalDebt || !secondDebt) return
    setBusy(true)
    try {
      const { account } = await addCreditCard(ledgerStore, {
        bank: form.bank,
        lastFour: form.lastFour,
        network: form.network,
        color: form.color,
        debtMode: form.debtMode,
        principalDebt,
        secondDebt,
        ...(limit ? { limit } : {}),
        ...(form.cutoff ? { cutoffDay: Number(form.cutoff) } : {}),
        ...(form.due ? { dueDay: Number(form.due) } : {}),
      })
      afterAdding(account.id, onDone, t.in("addcard", "Card added"))
    } catch (error) {
      setErrors({
        form: domainErrorText(
          t,
          error,
          t.in("addcard", "We couldn't add the card. Try again.")
        ),
      })
    } finally {
      setBusy(false)
    }
  }

  const modes: { value: DebtMode; label: string }[] = second
    ? [
        { value: "dual", label: t.in("addcard", "Two currencies") },
        {
          value: "principal",
          label: t.in("addcard", "Only %@", currencies.principal),
        },
        { value: "second", label: t.in("addcard", "Only %@", second) },
      ]
    : []
  const modeDescription =
    form.debtMode === "dual" && second
      ? t.in(
          "addcard",
          "%@ and %@, paid separately",
          currencies.principal,
          second
        )
      : t.in("addcard", "Everything is converted to %@", debtCurrency)

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-4"
    >
      <div className="mx-auto w-full max-w-xs">
        <CardArt
          color={form.color}
          bank={form.bank || t.in("addcard", "Bank")}
          network={form.network}
          lastFour={form.lastFour.length === 4 ? form.lastFour : undefined}
          kind="creditHolder"
          kindLabel={cardKindLabel(t, "creditHolder")}
          holder={owner?.toLocaleUpperCase(t.locale)}
        />
      </div>
      <LabeledField id="credit-bank" label={t.in("addcard", "Bank")}>
        <Input
          className={KW_INPUT}
          id="credit-bank"
          autoFocus
          placeholder={t.in("addcard", "Bank name")}
          value={form.bank}
          maxLength={40}
          onChange={(event) => setForm({ ...form, bank: event.target.value })}
        />
      </LabeledField>
      <div className="grid grid-cols-2 gap-3">
        <LabeledField
          id="credit-digits"
          label={t.in("addcard", "Last 4 digits")}
          error={errors.lastFour}
        >
          <Input
            id="credit-digits"
            inputMode="numeric"
            placeholder="0000"
            className={`${KW_INPUT} tracking-widest tabular-nums`}
            value={form.lastFour}
            aria-invalid={errors.lastFour ? true : undefined}
            onChange={(event) =>
              setForm({ ...form, lastFour: digitsOnly(event.target.value) })
            }
          />
        </LabeledField>
        <LabeledField id="credit-network" label={t.in("addcard", "Network")}>
          <OptionSelect<CardNetwork>
            id="credit-network"
            value={form.network}
            onChange={(network) => setForm({ ...form, network })}
            options={NETWORKS.map((network) => ({
              value: network,
              label: networkName(t, network),
            }))}
          />
        </LabeledField>
      </div>
      <LabeledField id="credit-color" label={t.in("accounts", "Card color")}>
        <ColorSwatches
          t={t}
          value={form.color}
          onChange={(color) => setForm({ ...form, color })}
          colors={SELECTABLE_CARD_COLORS}
        />
      </LabeledField>
      {second ? (
        <LabeledField
          id="credit-mode"
          label={t.in("addcard", "Which currencies does it charge you in?")}
          description={modeDescription}
        >
          <Segmented
            label={t.in("addcard", "How the debt works")}
            value={form.debtMode}
            onChange={(debtMode) => setForm({ ...form, debtMode })}
            options={modes}
          />
        </LabeledField>
      ) : null}
      <div
        className={
          form.debtMode === "dual" && second
            ? "grid grid-cols-2 gap-3"
            : "grid gap-3"
        }
      >
        <LabeledField
          id="credit-debt"
          label={t.in("addcard", "Debt in %@", debtCurrency)}
          description={t.in("addcard", "What you owe today")}
          error={errors.principalDebt}
        >
          <AmountInput
            id="credit-debt"
            currency={debtCurrency}
            value={form.principalDebt}
            invalid={errors.principalDebt !== undefined}
            onChange={(principalDebt) => setForm({ ...form, principalDebt })}
          />
        </LabeledField>
        {form.debtMode === "dual" && second ? (
          <LabeledField
            id="credit-second-debt"
            label={t.in("addcard", "Debt in %@", second)}
            error={errors.secondDebt}
          >
            <AmountInput
              id="credit-second-debt"
              currency={second}
              value={form.secondDebt}
              invalid={errors.secondDebt !== undefined}
              onChange={(secondDebt) => setForm({ ...form, secondDebt })}
            />
          </LabeledField>
        ) : null}
      </div>
      <LabeledField
        id="credit-limit-new"
        label={t.in("addcard", "Limit")}
        description={t.in("creditcard", "Optional")}
        error={errors.limit}
      >
        <AmountInput
          id="credit-limit-new"
          currency={debtCurrency}
          value={form.limit}
          invalid={errors.limit !== undefined}
          onChange={(limit) => setForm({ ...form, limit })}
        />
      </LabeledField>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 type-label text-text-secondary">
          {t.in("addcard", "Cycle (optional)")}
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <LabeledField
            id="credit-new-cutoff"
            label={t.in("addcard", "Cutoff day")}
          >
            <DaySelect
              id="credit-new-cutoff"
              value={form.cutoff}
              notSetLabel={t.in("addcard", "Not set")}
              onChange={(cutoff) => setForm({ ...form, cutoff })}
            />
          </LabeledField>
          <LabeledField id="credit-new-due" label={t.in("addcard", "Due day")}>
            <DaySelect
              id="credit-new-due"
              value={form.due}
              notSetLabel={t.in("addcard", "Not set")}
              onChange={(due) => setForm({ ...form, due })}
            />
          </LabeledField>
        </div>
      </fieldset>
      {errors.form ? (
        <p role="alert" className="type-caption text-negative">
          {errors.form}
        </p>
      ) : null}
      <KWButton type="submit" size="large" fill disabled={busy}>
        {t.in("addcard", "Add card")}
      </KWButton>
    </form>
  )
}
