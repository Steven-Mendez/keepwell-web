"use client"

import { useState } from "react"

import { AmountInput } from "@/components/accounts/form-parts"
import {
  KWButton,
  KWCircleButton,
  KWGroupedCard,
  KWSegmented,
  KWValueRow,
} from "@/components/kw/design"
import { KWSwitch } from "@/components/movement-editor/flow-parts"
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
  addDays,
  decimalText,
  debtRemaining,
  deleteDebtRepayment,
  deletePersonalDebt,
  isDomainError,
  reopenPersonalDebt,
  repayPersonalDebt,
  savePersonalDebt,
  settlePersonalDebt,
} from "@/lib/domain"
import { formatAmount, formatNumber, parseAmount } from "@/lib/domain/format"
import type { TimeZone } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { ledgerStore } from "@/lib/repositories"
import { deviceTimeZone } from "@/lib/platform/time-zone"
import { cn } from "@/lib/utils"
import { accountName } from "@/lib/presentation/display"
import {
  MAX_DEBT_NAME_LENGTH,
  type Account,
  type CurrencySettings,
  type DebtDirection,
  type DebtRepayment,
  type PersonalDebt,
} from "@/lib/schema"

import {
  SELECT_CLASS,
  dateFieldValue,
  dateFromField,
  dayText,
  debtDueText,
} from "./debt-format"

const DIALOG =
  "max-h-[90svh] gap-5 overflow-y-auto rounded-2xl bg-card p-6 ring-1 ring-border/60 sm:max-w-lg"
const FOOTER =
  "-mx-6 -mb-6 gap-2 rounded-b-2xl border-divider bg-transparent px-6 pb-6 sm:justify-between"

/** A save's failure, and the field it's about (outlined in red), if any. */
export interface DebtError {
  message: string
  field?: "person" | "amount" | "dueDate"
}

export function debtError(t: Translator, thrown: unknown): DebtError {
  if (isDomainError(thrown, "missingName"))
    return { message: t.in("debts", "Write who it's with."), field: "person" }
  if (isDomainError(thrown, "invalidDueDate"))
    return { message: t.in("debts", "The due date can't be before the debt's date."), field: "dueDate" }
  if (isDomainError(thrown, "invalidAmount"))
    return { message: t.in("debts", "It can't be less than what was already paid back."), field: "amount" }
  return { message: t.in("debts", "We couldn't save the debt. Try again.") }
}

/** "Due Nov 28", "Due today" or "Overdue · 3 days": always said in words, the color only adds to it. */
export function DebtDueLine({
  due,
}: {
  due: { text: string; overdue: boolean } | undefined
}) {
  if (!due) return null
  return (
    <span
      className={cn(
        "type-caption",
        due.overdue ? "text-negative" : "text-muted-foreground"
      )}
    >
      {due.text}
    </span>
  )
}

const DEFAULT_DUE_DAYS = 30

/** Money lent or borrowed: which way, who, how much, when, an optional due date and a note. Only tracked, never a movement. */
export function DebtEditorDialog({
  t,
  debt,
  direction: initialDirection,
  currencies,
  onClose,
}: {
  t: Translator
  debt: PersonalDebt | undefined
  direction: DebtDirection
  currencies: CurrencySettings
  onClose: () => void
}) {
  const [direction, setDirection] = useState<DebtDirection>(
    debt?.direction ?? initialDirection
  )
  const [person, setPerson] = useState(debt?.person ?? "")
  const [amountText, setAmountText] = useState(
    debt ? formatNumber(debt.amount.amount) : ""
  )
  const [currency, setCurrency] = useState(
    debt?.amount.currency ?? currencies.principal
  )
  const [date, setDate] = useState(() =>
    debt ? new Date(debt.date) : new Date()
  )
  const [note, setNote] = useState(debt?.note ?? "")
  const [dueDate, setDueDate] = useState<Date | undefined>(() =>
    debt?.dueDate ? new Date(debt.dueDate) : undefined
  )
  const [error, setError] = useState<DebtError>()
  const [isSaving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const amount = parseAmount(amountText)
  const canSave = person.trim() !== "" && amountText !== "" && !isSaving
  const second = currencies.second

  async function run(work: () => Promise<unknown>) {
    setSaving(true)
    try {
      await work()
      onClose()
    } catch (thrown) {
      setError(debtError(t, thrown))
    } finally {
      setSaving(false)
    }
  }

  function save() {
    if (!canSave) return
    if (!amount?.gt(0))
      return setError({ message: t.in("debts", "Amounts have to be greater than zero."), field: "amount" })
    void run(() =>
      savePersonalDebt(ledgerStore, {
        ...(debt ? { id: debt.id } : {}),
        person,
        direction,
        amount: decimalText(amount),
        currency,
        date,
        note,
        dueDate,
      })
    )
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className={DIALOG}>
          <DialogHeader>
            <DialogTitle className="type-heading">
              {debt ? t.in("debts", "Edit debt") : t.in("debts", "New debt")}
            </DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <KWSegmented
              aria-label={
                debt ? t.in("debts", "Edit debt") : t.in("debts", "New debt")
              }
              value={direction}
              onChange={setDirection}
              options={[
                { value: "theyOweMe", title: t.in("debts", "They owe me") },
                { value: "iOwe", title: t.in("debts", "I owe") },
              ]}
            />
            <label className="flex flex-col gap-1.5">
              <span className="type-label text-text-secondary">
                {t.in("debts", "Person")}
              </span>
              <Input
                className={SETTINGS_INPUT}
                autoFocus
                value={person}
                maxLength={MAX_DEBT_NAME_LENGTH}
                placeholder={t.in("debts", "Juan")}
                aria-invalid={error?.field === "person" || undefined}
                onChange={(event) => {
                  setPerson(event.target.value)
                  setError(undefined)
                }}
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="debt-amount"
                  className="type-label text-text-secondary"
                >
                  {t.in("debts", "Amount")}
                </label>
                {second && !debt ? (
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
                id="debt-amount"
                value={amountText}
                onChange={(value) => {
                  setAmountText(value)
                  setError(undefined)
                }}
                currency={currency}
                invalid={error?.field === "amount"}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="type-label text-text-secondary">
                  {t.in("debts", "Date")}
                </span>
                <Input
                  type="date"
                  className={SETTINGS_INPUT}
                  value={dateFieldValue(date)}
                  onChange={(event) => {
                    setDate(dateFromField(event.target.value, date))
                    setError(undefined)
                  }}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="type-label text-text-secondary">
                  {t.in("debts", "Note")}
                </span>
                <Input
                  className={SETTINGS_INPUT}
                  value={note}
                  placeholder={t.in("debts", "Optional")}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-3.5 py-2.5">
                <label htmlFor="debt-due" className="type-body text-foreground">
                  {t.in("debts", "Set a due date")}
                </label>
                <KWSwitch
                  id="debt-due"
                  checked={dueDate !== undefined}
                  label={t.in("debts", "Set a due date")}
                  onChange={(checked) => {
                    setDueDate(
                      checked
                        ? addDays(date, DEFAULT_DUE_DAYS, deviceTimeZone())
                        : undefined
                    )
                    setError(undefined)
                  }}
                />
              </div>
              {dueDate ? (
                <label className="flex flex-col gap-1.5">
                  <span className="type-label text-text-secondary">
                    {t.in("debts", "Due date")}
                  </span>
                  <Input
                    type="date"
                    className={SETTINGS_INPUT}
                    value={dateFieldValue(dueDate)}
                    aria-invalid={error?.field === "dueDate" || undefined}
                    onChange={(event) => {
                      setDueDate(dateFromField(event.target.value, dueDate))
                      setError(undefined)
                    }}
                  />
                </label>
              ) : null}
            </div>
            <p className="type-caption text-muted-foreground">
              {t.in(
                "debts",
                "Only tracked here: it doesn't record a movement or change your balances."
              )}
            </p>
            {error ? (
              <p role="alert" className="type-caption text-negative">
                {error.message}
              </p>
            ) : null}
            <DialogFooter className={FOOTER}>
              {debt ? (
                <KWButton
                  variant="destructive"
                  icon="trash"
                  className="bg-negative-tint"
                  disabled={isSaving}
                  onClick={() => setConfirmDelete(true)}
                >
                  {t.in("debts", "Delete debt")}
                </KWButton>
              ) : (
                <span />
              )}
              <KWButton type="submit" disabled={!canSave}>
                {t.in("debts", "Save")}
              </KWButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t.in("debts", "Delete this debt?")}
        action={t.in("debts", "Delete")}
        destructive
        onConfirm={() =>
          debt && void run(() => deletePersonalDebt(ledgerStore, debt.id))
        }
      />
    </>
  )
}

/**
 * One personal debt: what is left, its repayments, "Record repayment" (optionally deposited into an
 * account), "Mark as settled" or "Reopen".
 */
export function DebtDialog({
  t,
  debt,
  accounts,
  hidden,
  now,
  zone,
  onEdit,
  onClose,
}: {
  t: Translator
  debt: PersonalDebt
  /** Where a repayment can be deposited: the open bank and cash accounts. */
  accounts: readonly Account[]
  hidden: boolean
  now: Date
  zone: TimeZone
  onEdit: () => void
  onClose: () => void
}) {
  const [repaymentText, setRepaymentText] = useState("")
  /** "" records the repayment only, as before; an id also deposits it there. */
  const [depositAccountId, setDepositAccountId] = useState("")
  const [failed, setFailed] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingRepayment, setDeletingRepayment] = useState<DebtRepayment>()
  const canDeposit = debt.direction === "theyOweMe" && accounts.length > 0
  const depositAccount = canDeposit
    ? accounts.find((account) => account.id === depositAccountId)
    : undefined
  const remaining = debtRemaining(debt)
  const repayment = parseAmount(repaymentText)
  const tooMuch = repayment !== undefined && repayment.gt(remaining)
  const settled = debt.settledAt !== undefined
  const canRepay =
    repayment !== undefined &&
    repayment.gt(0) &&
    !tooMuch &&
    !settled &&
    !isSaving
  const money = (amount: Parameters<typeof formatAmount>[0]) =>
    hidden ? BALANCE_MASK : formatAmount(amount, debt.amount.currency)

  async function run(work: () => Promise<unknown>, closes = false) {
    setSaving(true)
    try {
      await work()
      setFailed(false)
      if (closes) onClose()
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className={DIALOG}>
          <DialogHeader className="flex-row items-baseline justify-between gap-3">
            <DialogTitle className="truncate type-heading">
              {debt.direction === "theyOweMe"
                ? t.in("debts", "%@ owes you", debt.person)
                : t.in("debts", "You owe %@", debt.person)}
            </DialogTitle>
            <KWButton
              variant="plain"
              size="small"
              icon="pencil"
              onClick={onEdit}
            >
              {t.in("debts", "Edit")}
            </KWButton>
          </DialogHeader>
          <div className="flex flex-col gap-1 rounded-2xl bg-secondary/60 p-4">
            <span className="type-heading tabular-nums">
              {t.in(
                "debts",
                "%@ left of %@",
                money(remaining),
                money(debt.amount.amount)
              )}
            </span>
            <span className="type-caption text-muted-foreground">
              {dayText(t, debt.date)}
              {debt.note ? ` · ${debt.note}` : ""}
            </span>
            {debt.settledAt ? (
              <span className="type-caption text-positive">
                {t.in("debts", "Settled on %@", dayText(t, debt.settledAt))}
              </span>
            ) : null}
            <DebtDueLine due={debtDueText(t, debt, now, zone)} />
            <span className="type-caption text-muted-foreground">
              {t.in(
                "debts",
                "Only tracked here: it doesn't record a movement or change your balances."
              )}
            </span>
          </div>
          {!settled ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (canRepay && repayment) {
                  void run(async () => {
                    await repayPersonalDebt(
                      ledgerStore,
                      debt.id,
                      decimalText(repayment),
                      new Date(),
                      depositAccount
                        ? { accountId: depositAccount.id }
                        : undefined
                    )
                    setRepaymentText("")
                  })
                }
              }}
            >
              <label
                htmlFor="debt-repayment"
                className="type-label text-text-secondary"
              >
                {t.in("debts", "Amount paid back")}
              </label>
              <AmountInput
                id="debt-repayment"
                value={repaymentText}
                onChange={setRepaymentText}
                currency={debt.amount.currency}
                invalid={tooMuch}
              />
              {tooMuch ? (
                <span role="alert" className="type-caption text-negative">
                  {t.in("debts", "That's more than what's left.")}
                </span>
              ) : null}
              {canDeposit ? (
                <>
                  <label
                    htmlFor="debt-repayment-deposit"
                    className="type-label text-text-secondary"
                  >
                    {t.in("web", "Deposit into account")}
                  </label>
                  <select
                    id="debt-repayment-deposit"
                    className={SELECT_CLASS}
                    value={depositAccountId}
                    onChange={(event) =>
                      setDepositAccountId(event.target.value)
                    }
                  >
                    <option value="">{t.in("web", "Don't deposit")}</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {accountName(account)}
                      </option>
                    ))}
                  </select>
                  {depositAccount ? (
                    <span className="type-caption text-muted-foreground">
                      {t.in(
                        "web",
                        "Records an income in %@. It changes the balance but doesn't count as income: the money only came back.",
                        accountName(depositAccount)
                      )}
                    </span>
                  ) : null}
                </>
              ) : null}
              <KWButton type="submit" disabled={!canRepay}>
                {t.in("debts", "Record repayment")}
              </KWButton>
            </form>
          ) : null}
          {failed ? (
            <p role="alert" className="type-caption text-negative">
              {t.in("debts", "We couldn't save the debt. Try again.")}
            </p>
          ) : null}
          {debt.repayments.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="type-label text-muted-foreground">
                {t.in("debts", "Repayments")}
              </span>
              <KWGroupedCard className="bg-secondary/40">
                {debt.repayments.map((row, index) => (
                  <KWValueRow
                    key={row.id ?? index}
                    label={
                      row.transactionId
                        ? t.in(
                            "web",
                            "%@ · deposited",
                            dayText(t, row.date)
                          )
                        : dayText(t, row.date)
                    }
                    value={
                      <span className="tabular-nums">{money(row.amount)}</span>
                    }
                    trailing={
                      row.id ? (
                        <KWCircleButton
                          icon="trash"
                          size={28}
                          label={t.in("web", "Delete repayment")}
                          disabled={isSaving}
                          onClick={() => setDeletingRepayment(row)}
                        />
                      ) : null
                    }
                  />
                ))}
              </KWGroupedCard>
            </div>
          ) : null}
          <DialogFooter className={FOOTER}>
            <KWButton
              variant="destructive"
              icon="trash"
              className="bg-negative-tint"
              disabled={isSaving}
              onClick={() => setConfirmDelete(true)}
            >
              {t.in("debts", "Delete debt")}
            </KWButton>
            {settled ? (
              remaining.gt(0) ? (
                <KWButton
                  variant="surface"
                  disabled={isSaving}
                  onClick={() =>
                    void run(() => reopenPersonalDebt(ledgerStore, debt.id))
                  }
                >
                  {t.in("debts", "Reopen")}
                </KWButton>
              ) : null
            ) : (
              <KWButton
                variant="surface"
                icon="check"
                disabled={isSaving}
                onClick={() =>
                  void run(() =>
                    settlePersonalDebt(ledgerStore, debt.id, new Date())
                  )
                }
              >
                {t.in("debts", "Mark as settled")}
              </KWButton>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t.in("debts", "Delete this debt?")}
        description={
          debt.repayments.some((row) => row.transactionId)
            ? t.in(
                "web",
                "Repayments you deposited stay as movements in their accounts."
              )
            : undefined
        }
        action={t.in("debts", "Delete")}
        destructive
        onConfirm={() =>
          void run(() => deletePersonalDebt(ledgerStore, debt.id), true)
        }
      />
      <ConfirmDialog
        open={deletingRepayment !== undefined}
        onOpenChange={(open) => !open && setDeletingRepayment(undefined)}
        title={t.in("web", "Delete this repayment?")}
        description={
          deletingRepayment?.transactionId
            ? t.in(
                "web",
                "The income it deposited is deleted too, and the balance goes back."
              )
            : undefined
        }
        action={t.in("debts", "Delete")}
        destructive
        onConfirm={() => {
          const row = deletingRepayment
          setDeletingRepayment(undefined)
          if (row?.id)
            void run(() => deleteDebtRepayment(ledgerStore, debt.id, row.id!))
        }}
      />
    </>
  )
}
