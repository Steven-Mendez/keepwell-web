"use client"

import { useState, type FormEvent } from "react"

import { KWButton, KWCircleButton, KWSegmented } from "@/components/kw/design"
import { OptionSelect } from "@/components/kw/pickers"
import { FieldLabel, KW_FIELD } from "@/components/movement-editor/flow-parts"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { formatAmountInput, type OnboardingAccountDraft } from "@/lib/domain"
import { useT, type Translator } from "@/lib/i18n"
import type { CardNetwork, DebtMode } from "@/lib/schema"

import {
  amountText,
  checkAccountForm,
  debtCurrencyFor,
  savedAccountDraft,
  type AccountFormValues,
} from "./account-form-model"

type SetValue = <K extends keyof AccountFormValues>(
  key: K,
  value: AccountFormValues[K]
) => void

/** The sheet's fields, seeded from the draft being added or edited. */
function useAccountFormValues(
  draft: OnboardingAccountDraft,
  second: string | undefined
) {
  const [values, setValues] = useState<AccountFormValues>(() => ({
    bank: draft.bank ?? "",
    name: draft.name,
    currency: draft.currency,
    balanceText: amountText(draft.balance),
    secondText: amountText(draft.secondBalance),
    lastFour: draft.lastFour ?? "",
    network: draft.network ?? "visa",
    debtMode: draft.debtMode ?? (second ? "dual" : "principal"),
  }))
  const setValue: SetValue = (key, value) =>
    setValues((current) => ({ ...current, [key]: value }))
  // On blur the amount is rewritten with grouping ("1250.5" → "1,250.50") when it parses.
  const formatAmountField = (key: "balanceText" | "secondText") =>
    setValues((current) => ({
      ...current,
      [key]: formatAmountInput(current[key]) ?? current[key],
    }))
  return { values, setValue, formatAmountField }
}

const KIND_TITLES = {
  bank: "Bank account",
  credit: "Credit card",
  cash: "Cash",
} as const

/**
 * The account sheet of the onboarding accounts step (iOS OnboardingAccountForm): bank and name,
 * currency or how the card charges, today's balance or debt, and the plastic's last four and network.
 */
export function AccountForm({
  draft,
  isNew,
  currencies,
  principal,
  second,
  onSave,
  onCancel,
  onRemove,
}: {
  draft: OnboardingAccountDraft
  isNew: boolean
  currencies: string[]
  principal: string
  second: string | undefined
  onSave: (draft: OnboardingAccountDraft) => void
  onCancel: () => void
  onRemove: () => void
}) {
  const t = useT()
  const { values, setValue, formatAmountField } = useAccountFormValues(
    draft,
    second
  )
  const [showErrors, setShowErrors] = useState(false)
  const check = checkAccountForm(draft.kind, values)
  const { balance, lastFourInvalid, balanceInvalid, secondInvalid } = check

  function submit(event: FormEvent) {
    event.preventDefault()
    if (lastFourInvalid || balanceInvalid || secondInvalid || !balance) {
      setShowErrors(true)
      return
    }
    onSave(
      savedAccountDraft({
        t,
        draft,
        values,
        balance,
        secondBalance: check.secondBalance,
        principal,
        second,
      })
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 rounded-[var(--radius-surface)] bg-background p-5 ring-1 ring-border sm:max-w-lg"
      >
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader className="flex-row items-center justify-between gap-3">
            <DialogTitle className="type-title-sm text-foreground">
              {t.in("onboarding", KIND_TITLES[draft.kind])}
            </DialogTitle>
            <KWCircleButton
              icon="close"
              label={t.in("designsystem", "Close")}
              shortcut="Esc"
              onClick={onCancel}
            />
          </DialogHeader>
          {draft.kind !== "cash" ? (
            <NameFields
              t={t}
              kind={draft.kind}
              values={values}
              setValue={setValue}
            />
          ) : null}
          {draft.kind !== "credit" && currencies.length > 1 ? (
            <CurrencyField
              t={t}
              currencies={currencies}
              value={values.currency}
              onChange={(currency) => setValue("currency", currency)}
            />
          ) : null}
          {draft.kind === "credit" && second ? (
            <DebtModeField
              t={t}
              principal={principal}
              second={second}
              value={values.debtMode}
              onChange={(debtMode) => setValue("debtMode", debtMode)}
            />
          ) : null}
          <BalanceFields
            t={t}
            kind={draft.kind}
            values={values}
            setValue={setValue}
            formatAmountField={formatAmountField}
            principal={principal}
            second={second}
            balanceError={showErrors && balanceInvalid}
            secondError={showErrors && secondInvalid}
          />
          {draft.kind !== "cash" ? (
            <CardFields
              t={t}
              kind={draft.kind}
              values={values}
              setValue={setValue}
              lastFourError={showErrors && lastFourInvalid}
            />
          ) : null}
          <FormActions
            t={t}
            isNew={isNew}
            onCancel={onCancel}
            onRemove={onRemove}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FieldError({ text }: { text: string }) {
  return <p className="px-1 type-caption text-negative">{text}</p>
}

/** Bank and account name, for bank accounts and cards (cash has neither). */
function NameFields({
  t,
  kind,
  values,
  setValue,
}: {
  t: Translator
  kind: OnboardingAccountDraft["kind"]
  values: AccountFormValues
  setValue: SetValue
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="bank">{t.in("onboarding", "Bank")}</FieldLabel>
        <Input
          id="bank"
          value={values.bank}
          onChange={(event) => setValue("bank", event.target.value)}
          placeholder={t.in("onboarding", "Bank name")}
          autoFocus
          className={KW_FIELD}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="account-name">
          {t.in("onboarding", "Name")}
        </FieldLabel>
        <Input
          id="account-name"
          value={values.name}
          onChange={(event) => setValue("name", event.target.value)}
          placeholder={
            kind === "credit" ? "Visa" : t.in("onboarding", "Savings")
          }
          className={KW_FIELD}
        />
      </div>
    </div>
  )
}

/** The account's currency, offered only when onboarding set up two. */
function CurrencyField({
  t,
  currencies,
  value,
  onChange,
}: {
  t: Translator
  currencies: string[]
  value: string
  onChange: (currency: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{t.in("onboarding", "Currency")}</FieldLabel>
      <KWSegmented
        aria-label={t.in("onboarding", "Currency")}
        value={value}
        onChange={onChange}
        options={currencies.map((code) => ({
          value: code,
          title: code,
        }))}
      />
    </div>
  )
}

/** How a card charges when there are two currencies: both, or only one of them. */
function DebtModeField({
  t,
  principal,
  second,
  value,
  onChange,
}: {
  t: Translator
  principal: string
  second: string
  value: DebtMode
  onChange: (debtMode: DebtMode) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>
        {t.in("onboarding", "Which currencies does it charge you in?")}
      </FieldLabel>
      <KWSegmented<DebtMode>
        aria-label={t.in(
          "onboarding",
          "Which currencies does it charge you in?"
        )}
        value={value}
        onChange={onChange}
        options={[
          {
            value: "dual",
            title: t.in("onboarding", "Two currencies"),
          },
          {
            value: "principal",
            title: t.in("onboarding", "Only %@", principal),
          },
          {
            value: "second",
            title: t.in("onboarding", "Only %@", second),
          },
        ]}
      />
    </div>
  )
}

/** One amount input, regrouped on blur, with its error under it. */
function AmountField({
  t,
  id,
  label,
  value,
  onChange,
  onBlur,
  autoFocus,
  invalid,
}: {
  t: Translator
  id: string
  label: string
  value: string
  onChange: (text: string) => void
  onBlur: () => void
  autoFocus?: boolean
  invalid: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder="10,000.00"
        className={`${KW_FIELD} tabular-nums`}
        autoFocus={autoFocus}
        aria-invalid={invalid}
      />
      {invalid ? (
        <FieldError
          text={t.in("onboarding", "Enter an amount like 1,250.50.")}
        />
      ) : null}
    </div>
  )
}

/** Today's balance, or a card's debt (in both currencies when it charges in two). */
function BalanceFields({
  t,
  kind,
  values,
  setValue,
  formatAmountField,
  principal,
  second,
  balanceError,
  secondError,
}: {
  t: Translator
  kind: OnboardingAccountDraft["kind"]
  values: AccountFormValues
  setValue: SetValue
  formatAmountField: (key: "balanceText" | "secondText") => void
  principal: string
  second: string | undefined
  balanceError: boolean
  secondError: boolean
}) {
  const debtCurrency = debtCurrencyFor(values.debtMode, principal, second)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <AmountField
        t={t}
        id="balance"
        label={
          kind === "credit"
            ? t.in("onboarding", "Debt in %@", debtCurrency)
            : t.in("onboarding", "Today's balance")
        }
        value={values.balanceText}
        onChange={(text) => setValue("balanceText", text)}
        onBlur={() => formatAmountField("balanceText")}
        autoFocus={kind === "cash"}
        invalid={balanceError}
      />
      {kind === "credit" && values.debtMode === "dual" && second ? (
        <AmountField
          t={t}
          id="second-balance"
          label={t.in("onboarding", "Debt in %@", second)}
          value={values.secondText}
          onChange={(text) => setValue("secondText", text)}
          onBlur={() => formatAmountField("secondText")}
          invalid={secondError}
        />
      ) : null}
    </div>
  )
}

/** The plastic's last four digits and network, for bank accounts (debit) and cards. */
function CardFields({
  t,
  kind,
  values,
  setValue,
  lastFourError,
}: {
  t: Translator
  kind: OnboardingAccountDraft["kind"]
  values: AccountFormValues
  setValue: SetValue
  lastFourError: boolean
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="last-four">
          {t.in(
            "onboarding",
            kind === "bank" ? "Debit, last 4" : "Last 4 digits"
          )}
        </FieldLabel>
        <Input
          id="last-four"
          inputMode="numeric"
          maxLength={4}
          value={values.lastFour}
          onChange={(event) =>
            setValue("lastFour", event.target.value.replace(/\D/g, ""))
          }
          placeholder={t.in("onboarding", "Optional")}
          className={`${KW_FIELD} font-mono tracking-widest`}
          aria-invalid={lastFourError}
        />
        {lastFourError ? (
          <FieldError
            text={t.in("onboarding", "Enter all 4 digits or leave it empty.")}
          />
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="network">{t.in("addcard", "Network")}</FieldLabel>
        <OptionSelect<CardNetwork>
          id="network"
          value={values.network}
          onChange={(network) => setValue("network", network)}
          options={[
            { value: "visa", label: "Visa" },
            { value: "mastercard", label: "Mastercard" },
            { value: "amex", label: "Amex" },
            { value: "other", label: t.in("onboarding", "Other") },
          ]}
        />
      </div>
    </div>
  )
}

/** Remove (existing accounts only), Cancel and Add/Save. */
function FormActions({
  t,
  isNew,
  onCancel,
  onRemove,
}: {
  t: Translator
  isNew: boolean
  onCancel: () => void
  onRemove: () => void
}) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center">
      {!isNew ? (
        <KWButton
          variant="destructive"
          icon="trash"
          className="sm:mr-auto"
          onClick={onRemove}
        >
          {t.in("onboarding", "Remove account")}
        </KWButton>
      ) : (
        <span className="hidden sm:mr-auto sm:block" />
      )}
      <KWButton variant="plain" onClick={onCancel}>
        {t.in("web", "Cancel")}
      </KWButton>
      <KWButton type="submit">
        {t.in("onboarding", isNew ? "Add" : "Save")}
      </KWButton>
    </div>
  )
}
