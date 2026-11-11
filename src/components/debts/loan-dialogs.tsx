"use client"

import { useState, type CSSProperties } from "react"

import { AmountInput } from "@/components/accounts/form-parts"
import { KWButton, KWGroupedCard, KWSegmented } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { SpringFill } from "@/components/kw/motion"
import { ConfirmDialog } from "@/components/settings/confirm-dialog"
import { SETTINGS_INPUT } from "@/components/settings/settings-rows"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { BALANCE_MASK } from "@/hooks/use-hidden-balances"
import {
  decimalText,
  deleteLoan,
  unpayLoanInstallment,
  isDomainError,
  payLoanInstallment,
  saveLoan,
  type Ledger,
  type LoanProgress,
} from "@/lib/domain"
import { formatAmount, formatNumber, parseAmount } from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"
import { categoryName } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"
import {
  LOAN_PAYMENTS_ID,
  MAX_LOAN_INSTALLMENTS,
  MAX_LOAN_NAME_LENGTH,
  OTHER_EXPENSE_ID,
  orderedCategories,
  type CurrencySettings,
  type Loan,
  type LoanFrequency,
} from "@/lib/schema"

import {
  SELECT_CLASS,
  dateFieldValue,
  dateFromField,
  dayText,
  paidFraction,
  paymentMethods,
} from "./debt-format"

const DIALOG =
  "max-h-[90svh] gap-5 overflow-y-auto rounded-2xl bg-card p-6 ring-1 ring-border/60 sm:max-w-lg"
const FOOTER =
  "-mx-6 -mb-6 gap-2 rounded-b-2xl border-divider bg-transparent px-6 pb-6 sm:justify-between"

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="type-label text-text-secondary">
        {label}
      </label>
      {children}
    </div>
  )
}

function loanError(t: Translator, thrown: unknown): string {
  if (isDomainError(thrown, "missingName"))
    return t.in("debts", "Give the loan a name.")
  if (isDomainError(thrown, "invalidAmount"))
    return t.in("debts", "There are more installments paid than that.")
  return t.in("debts", "We couldn't save the loan. Try again.")
}

/** A new loan or an existing one: name, lender, what was borrowed, the installment, how many, how often, from when. */
export function LoanEditorDialog({
  t,
  loan,
  currencies,
  onClose,
}: {
  t: Translator
  loan: Loan | undefined
  currencies: CurrencySettings
  onClose: () => void
}) {
  const [name, setName] = useState(loan?.name ?? "")
  const [lender, setLender] = useState(loan?.lender ?? "")
  const [borrowedText, setBorrowedText] = useState(
    loan ? formatNumber(loan.borrowed.amount) : ""
  )
  const [installmentText, setInstallmentText] = useState(
    loan ? formatNumber(loan.installmentAmount) : ""
  )
  const [countText, setCountText] = useState(
    loan ? String(loan.installmentCount) : ""
  )
  const [frequency, setFrequency] = useState<LoanFrequency>(
    loan?.frequency ?? "monthly"
  )
  const [firstDue, setFirstDue] = useState(() =>
    loan ? new Date(loan.firstDueDate) : new Date()
  )
  const [currency, setCurrency] = useState(
    loan?.borrowed.currency ?? currencies.principal
  )
  const [error, setError] = useState<string>()
  const [isSaving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const borrowed = parseAmount(borrowedText)
  const installment = parseAmount(installmentText)
  const count = Number.parseInt(countText, 10)
  const canSave =
    name.trim() !== "" &&
    borrowedText !== "" &&
    installmentText !== "" &&
    countText !== "" &&
    !isSaving
  const second = currencies.second

  async function run(work: () => Promise<unknown>) {
    setSaving(true)
    try {
      await work()
      onClose()
    } catch (thrown) {
      setError(loanError(t, thrown))
    } finally {
      setSaving(false)
    }
  }

  function save() {
    if (!canSave) return
    if (!borrowed?.gt(0) || !installment?.gt(0))
      return setError(t.in("debts", "Amounts have to be greater than zero."))
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > MAX_LOAN_INSTALLMENTS
    ) {
      return setError(t.in("debts", "Enter between 1 and 600 installments."))
    }
    void run(() =>
      saveLoan(ledgerStore, {
        ...(loan ? { id: loan.id } : {}),
        name,
        lender,
        borrowedAmount: decimalText(borrowed),
        currency,
        installmentAmount: decimalText(installment),
        installmentCount: count,
        frequency,
        firstDueDate: firstDue,
      })
    )
  }

  const clearing = (set: (value: string) => void) => (value: string) => {
    set(value)
    setError(undefined)
  }

  return (
    <>
      <Dialog open onOpenChange={(next) => !next && onClose()}>
        <DialogContent className={DIALOG}>
          <DialogHeader>
            <DialogTitle className="type-heading">
              {loan ? t.in("debts", "Edit loan") : t.in("debts", "New loan")}
            </DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.in("debts", "Name")} htmlFor="loan-name">
                <Input
                  id="loan-name"
                  className={SETTINGS_INPUT}
                  autoFocus
                  value={name}
                  maxLength={MAX_LOAN_NAME_LENGTH}
                  placeholder={t.in("debts", "Motorbike, mortgage…")}
                  onChange={(event) => clearing(setName)(event.target.value)}
                />
              </Field>
              <Field label={t.in("debts", "Lender")} htmlFor="loan-lender">
                <Input
                  id="loan-lender"
                  className={SETTINGS_INPUT}
                  value={lender}
                  maxLength={MAX_LOAN_NAME_LENGTH}
                  placeholder={t.in("debts", "Optional")}
                  onChange={(event) => setLender(event.target.value)}
                />
              </Field>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="loan-borrowed"
                  className="type-label text-text-secondary"
                >
                  {t.in("debts", "Amount borrowed")}
                </label>
                {second && !loan ? (
                  <KWSegmented
                    style="compact"
                    aria-label={t.in("debts", "Currency")}
                    value={currency}
                    onChange={setCurrency}
                    options={[
                      {
                        value: currencies.principal,
                        title: currencies.principal,
                      },
                      { value: second, title: second },
                    ]}
                  />
                ) : null}
              </div>
              <AmountInput
                id="loan-borrowed"
                value={borrowedText}
                onChange={clearing(setBorrowedText)}
                currency={currency}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t.in("debts", "Installment")}
                htmlFor="loan-installment"
              >
                <AmountInput
                  id="loan-installment"
                  value={installmentText}
                  onChange={clearing(setInstallmentText)}
                  currency={currency}
                />
              </Field>
              <Field
                label={t.in("debts", "Number of installments")}
                htmlFor="loan-count"
              >
                <Input
                  id="loan-count"
                  className={SETTINGS_INPUT}
                  inputMode="numeric"
                  placeholder="12"
                  value={countText}
                  onChange={(event) =>
                    clearing(setCountText)(
                      event.target.value.replace(/\D/g, "").slice(0, 3)
                    )
                  }
                />
              </Field>
            </div>
            {installment && Number.isInteger(count) && count > 0 ? (
              <p className="type-caption text-muted-foreground">
                {t.in(
                  "debts",
                  "You'll pay %@ in total",
                  formatAmount(installment.times(count), currency)
                )}
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <KWSegmented
                aria-label={t.in("debts", "Schedule")}
                value={frequency}
                onChange={setFrequency}
                options={[
                  { value: "monthly", title: t.in("debts", "Monthly") },
                  { value: "weekly", title: t.in("debts", "Weekly") },
                ]}
              />
              <Field
                label={t.in("debts", "First installment")}
                htmlFor="loan-first"
              >
                <Input
                  id="loan-first"
                  type="date"
                  className={SETTINGS_INPUT}
                  value={dateFieldValue(firstDue)}
                  onChange={(event) =>
                    setFirstDue(dateFromField(event.target.value, firstDue))
                  }
                />
              </Field>
            </div>
            {error ? (
              <p role="alert" className="type-caption text-negative">
                {error}
              </p>
            ) : null}
            <DialogFooter className={FOOTER}>
              {loan ? (
                <KWButton
                  variant="destructive"
                  icon="trash"
                  className="bg-negative-tint"
                  disabled={isSaving}
                  onClick={() => setConfirmDelete(true)}
                >
                  {t.in("debts", "Delete loan")}
                </KWButton>
              ) : (
                <span />
              )}
              <KWButton type="submit" disabled={!canSave}>
                {loan ? t.in("debts", "Save") : t.in("debts", "Add loan")}
              </KWButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t.in("debts", "Delete this loan?")}
        description={t.in(
          "debts",
          "The installments you already paid stay as movements."
        )}
        action={t.in("debts", "Delete")}
        destructive
        onConfirm={() =>
          loan && void run(() => deleteLoan(ledgerStore, loan.id))
        }
      />
    </>
  )
}

/** A loan's schedule and "Pay installment", which records the installment as a confirmed expense. */
export function LoanDialog({
  t,
  progress,
  ledger,
  hidden,
  onEdit,
  onClose,
}: {
  t: Translator
  progress: LoanProgress
  ledger: Ledger
  hidden: boolean
  onEdit: () => void
  onClose: () => void
}) {
  const { loan, next } = progress
  const methods = paymentMethods(t, ledger)
  const expenseCategories = orderedCategories(ledger.categories).filter(
    (category) => category.kind === "expense"
  )
  const [methodKey, setMethodKey] = useState(
    () => lastUsedMethod(ledger, methods) ?? methods[0]?.key ?? ""
  )
  // "Loan payments" until the person picks, or "Other" once they deleted it.
  const [categoryId, setCategoryId] = useState(() =>
    expenseCategories.some((category) => category.id === LOAN_PAYMENTS_ID)
      ? LOAN_PAYMENTS_ID
      : OTHER_EXPENSE_ID
  )
  const [paidOn, setPaidOn] = useState(() => new Date())
  const [isPaying, setPaying] = useState(false)
  const [failed, setFailed] = useState(false)
  /** The paid installment waiting for "Mark unpaid" to be confirmed. */
  const [unpaying, setUnpaying] = useState<number>()
  const [unpayFailed, setUnpayFailed] = useState(false)
  const method = methods.find((option) => option.key === methodKey)
  const money = (amount: Parameters<typeof formatAmount>[0]) =>
    hidden ? BALANCE_MASK : formatAmount(amount, loan.borrowed.currency)
  const borrowed = money(loan.borrowed.amount)

  async function pay() {
    if (!method || !next) return
    setPaying(true)
    try {
      await payLoanInstallment(ledgerStore, {
        loanId: loan.id,
        source: method.source,
        categoryId,
        date: paidOn,
      })
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setPaying(false)
    }
  }

  /** The installment is due again and the expense it recorded is deleted, in one write. */
  async function markUnpaid(number: number) {
    try {
      await unpayLoanInstallment(ledgerStore, loan.id, number)
      setUnpayFailed(false)
    } catch {
      setUnpayFailed(true)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={DIALOG}>
        <DialogHeader className="flex-row items-baseline justify-between gap-3">
          <DialogTitle className="truncate type-heading">
            {loan.name}
          </DialogTitle>
          <KWButton variant="plain" size="small" icon="pencil" onClick={onEdit}>
            {t.in("debts", "Edit")}
          </KWButton>
        </DialogHeader>
        <div className="flex flex-col gap-2 rounded-2xl bg-secondary/60 p-4">
          <span className="type-body font-semibold tabular-nums">
            {t.in(
              "debts",
              "%lld of %lld paid · %@ left",
              loan.payments.length,
              loan.installmentCount,
              money(progress.remaining)
            )}
          </span>
          <span
            className="h-2 overflow-hidden rounded-full bg-secondary"
            style={
              {
                "--fill": progress.isPaidOff
                  ? "var(--positive)"
                  : "var(--accent)",
              } as CSSProperties
            }
            aria-hidden
          >
            <SpringFill
              fraction={paidFraction(progress)}
              className="bg-(--fill)"
            />
          </span>
          <span className="type-caption text-muted-foreground">
            {loan.lender
              ? t.in("debts", "Borrowed %@ from %@", borrowed, loan.lender)
              : t.in("debts", "Borrowed %@", borrowed)}
          </span>
        </div>
        {next ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void pay()
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t.in("debts", "Pay from")} htmlFor="loan-pay-from">
                <select
                  id="loan-pay-from"
                  className={SELECT_CLASS}
                  value={methodKey}
                  onChange={(event) => setMethodKey(event.target.value)}
                >
                  {methods.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={t.in("debts", "Category")}
                htmlFor="loan-pay-category"
              >
                <select
                  id="loan-pay-category"
                  className={SELECT_CLASS}
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {categoryName(t, category)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t.in("debts", "Paid on")} htmlFor="loan-pay-date">
                <Input
                  id="loan-pay-date"
                  type="date"
                  className={SETTINGS_INPUT}
                  value={dateFieldValue(paidOn)}
                  onChange={(event) =>
                    setPaidOn(dateFromField(event.target.value, paidOn))
                  }
                />
              </Field>
            </div>
            {failed ? (
              <p role="alert" className="type-caption text-negative">
                {t.in("debts", "We couldn't record the payment. Try again.")}
              </p>
            ) : null}
            <KWButton type="submit" disabled={!method || isPaying}>
              {t.in(
                "debts",
                "Pay %lld/%lld · %@",
                next.number,
                loan.installmentCount,
                formatAmount(loan.installmentAmount, loan.borrowed.currency)
              )}
            </KWButton>
            <p className="type-caption text-muted-foreground">
              {t.in(
                "debts",
                "Records a confirmed expense from the account or card you pick."
              )}
            </p>
          </form>
        ) : null}
        <div className="flex flex-col gap-2">
          <span className="type-label text-muted-foreground">
            {t.in("debts", "Schedule")}
          </span>
          <KWGroupedCard className="bg-secondary/40">
            {progress.installments.map((installment) => (
              <div
                key={installment.number}
                className="flex items-center gap-3 px-4 py-2"
              >
                <KWIcon
                  name={installment.payment ? "check" : "clock"}
                  size={16}
                  className={
                    installment.payment
                      ? "text-positive"
                      : "text-muted-foreground"
                  }
                />
                <span className="type-body font-semibold tabular-nums">
                  {installment.number}/{loan.installmentCount}
                </span>
                <span className="flex-1 text-right type-caption text-text-secondary">
                  {dayText(t, installment.dueDate)}
                </span>
                <span
                  className={
                    installment.payment
                      ? "w-20 text-right type-caption text-positive"
                      : "w-20 text-right type-caption text-muted-foreground"
                  }
                >
                  {installment.payment
                    ? t.in("debts", "Paid")
                    : t.in("debts", "Due")}
                </span>
                {installment.payment ? (
                  <KWButton
                    variant="plain"
                    size="small"
                    onClick={() => setUnpaying(installment.number)}
                  >
                    {t.in("debts", "Mark unpaid")}
                  </KWButton>
                ) : null}
              </div>
            ))}
          </KWGroupedCard>
          {unpayFailed ? (
            <p className="type-caption text-negative">
              {t.in("debts", "We couldn't mark it unpaid. Try again.")}
            </p>
          ) : null}
        </div>
        <ConfirmDialog
          open={unpaying !== undefined}
          onOpenChange={(open) => !open && setUnpaying(undefined)}
          title={t.in(
            "debts",
            "Mark %lld/%lld unpaid?",
            unpaying ?? 0,
            loan.installmentCount
          )}
          description={t.in(
            "debts",
            "The expense it recorded is deleted, so balances go back to before you paid it."
          )}
          action={t.in("debts", "Mark unpaid")}
          destructive
          onConfirm={() => {
            if (unpaying !== undefined) void markUnpaid(unpaying)
          }}
        />
        <DialogFooter className={FOOTER}>
          <span />
          <KWButton variant="surface" onClick={onClose}>
            {t.in("web", "OK")}
          </KWButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The method the person paid with last, as the movement flow defaults to it. */
function lastUsedMethod(
  ledger: Ledger,
  methods: readonly { key: string }[]
): string | undefined {
  const latest = [...ledger.transactions].sort((a, b) =>
    a.date < b.date ? 1 : -1
  )[0]
  if (!latest) return undefined
  const key = latest.cardId
    ? `card:${latest.cardId}`
    : `account:${latest.accountId}`
  return methods.some((option) => option.key === key) ? key : undefined
}
