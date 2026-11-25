"use client"

import { useState } from "react"

import { AmountInput } from "@/components/accounts/form-parts"
import { KWButton, KWCircleButton } from "@/components/kw/design"
import { SETTINGS_INPUT } from "@/components/settings/settings-rows"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useLedger } from "@/hooks/use-ledger"
import {
  dec,
  debtShareIn,
  equalShare,
  isSettled,
  saveSplit,
  splitDebts,
  ZERO,
  Decimal,
} from "@/lib/domain"
import { formatAmount, formatNumber, parseAmount } from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"
import { newID } from "@/lib/platform/uuid"
import { ledgerStore } from "@/lib/repositories"
import {
  MAX_DEBT_NAME_LENGTH,
  type PersonalDebt,
  type Transaction,
} from "@/lib/schema"

interface Share {
  id: string
  /** The debt this share already is; absent on a person added now. */
  debtId?: string
  person: string
  amountText: string
  /**
   * Settled, or owed in another currency (edited from Debts, where the currency shows): its amount
   * stays as it is.
   */
  isLocked: boolean
  /** A locked share's part of the expense, in the expense's currency. */
  lockedShare?: Decimal
}

const newShare = (): Share => ({
  id: newID(),
  person: "",
  amountText: "",
  isLocked: false,
})

const lockedTotal = (rows: readonly Share[]) =>
  rows.reduce((sum, row) => sum.plus(row.lockedShare ?? ZERO), ZERO)

/** The open shares split `total` equally with the person; locked ones keep theirs. */
const equalRows = (rows: readonly Share[], total: Decimal) => {
  const open = rows.filter((row) => !row.isLocked).length
  const text = formatNumber(
    equalShare(Decimal.max(total.minus(lockedTotal(rows)), ZERO), open)
  )
  return rows.map((row) => (row.isLocked ? row : { ...row, amountText: text }))
}

/**
 * "Split" on an expense: who shared it and how much each owes. A new split starts equal between the
 * person and everyone added, and stays equal until one is typed by hand. An expense already split
 * opens in "Edit split": its people with their shares, ready to change, remove or add to, and the
 * whole set is saved at once (`saveSplit`). Opens once the ledger's debts are read.
 */
export function SplitDialog({
  t,
  transaction,
  onClose,
}: {
  t: Translator
  transaction: Transaction
  onClose: () => void
}) {
  const ledger = useLedger()
  if (!ledger) return null
  return (
    <SplitForm
      t={t}
      transaction={transaction}
      debts={ledger.personalDebts}
      onClose={onClose}
    />
  )
}

function SplitForm({
  t,
  transaction,
  debts,
  onClose,
}: {
  t: Translator
  transaction: Transaction
  debts: readonly PersonalDebt[]
  onClose: () => void
}) {
  const total = dec(transaction.amount)
  const [existing] = useState(() => splitDebts(transaction, debts))
  const isEditing = existing.length > 0
  const [rows, setRows] = useState<Share[]>(() =>
    isEditing
      ? existing.map((debt) => {
          const foreign = debt.amount.currency !== transaction.currency
          const isLocked = foreign || isSettled(debt)
          return {
            id: debt.id,
            debtId: debt.id,
            person: debt.person,
            amountText: formatNumber(dec(debt.amount.amount)),
            isLocked,
            ...(isLocked
              ? {
                  lockedShare: foreign
                    ? (debtShareIn(debt, transaction, transaction.currency) ??
                      ZERO)
                    : dec(debt.amount.amount),
                }
              : {}),
          }
        })
      : equalRows([newShare()], total)
  )
  // An existing split keeps its amounts as they are: adding someone doesn't redistribute them.
  const [isEdited, setEdited] = useState(isEditing)
  const [error, setError] = useState<string>()
  const [isSaving, setSaving] = useState(false)
  const amounts = rows.map((row) => parseAmount(row.amountText))
  const others = rows.reduce<Decimal>(
    (sum, row, index) =>
      sum.plus(
        row.lockedShare ?? (row.isLocked ? ZERO : (amounts[index] ?? ZERO))
      ),
    ZERO
  )
  const yours = Decimal.max(total.minus(others), ZERO)
  const canSave =
    !isSaving &&
    (isEditing || rows.length > 0) &&
    rows.every((row) => row.person.trim() !== "") &&
    amounts.every((amount) => amount?.gt(0))

  const update = (next: Share[], keepEqual = !isEdited) => {
    setRows(keepEqual ? equalRows(next, total) : next)
    setError(undefined)
  }

  async function save() {
    if (!canSave) return
    if (others.gt(total))
      return setError(
        t.in("debts", "The shares add up to more than the expense.")
      )
    setSaving(true)
    try {
      await saveSplit(
        ledgerStore,
        transaction.id,
        rows.map((row, index) => ({
          ...(row.debtId === undefined ? {} : { debtId: row.debtId }),
          person: row.person,
          amount: amounts[index]!,
        }))
      )
      onClose()
    } catch {
      setError(t.in("debts", "We couldn't split the expense. Try again."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90svh] grid-cols-[minmax(0,1fr)] gap-5 overflow-y-auto rounded-2xl bg-card p-6 ring-1 ring-border/60 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="type-heading">
            {isEditing
              ? t.in("web", "Edit split")
              : t.in("debts", "Split the expense")}
          </DialogTitle>
          <p className="truncate type-caption text-muted-foreground">
            {transaction.description} ·{" "}
            {formatAmount(transaction.amount, transaction.currency)}
          </p>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <div className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-center gap-2"
              >
                <Input
                  className={SETTINGS_INPUT}
                  aria-label={t.in("debts", "Name")}
                  placeholder={t.in("debts", "Name")}
                  autoFocus={
                    row.debtId === undefined && index === rows.length - 1
                  }
                  maxLength={MAX_DEBT_NAME_LENGTH}
                  value={row.person}
                  onChange={(event) =>
                    update(
                      rows.map((other) =>
                        other.id === row.id
                          ? { ...other, person: event.target.value }
                          : other
                      ),
                      false
                    )
                  }
                />
                {row.isLocked ? (
                  <span className="flex flex-col items-end px-3 tabular-nums">
                    <span className="type-body">
                      {formatAmount(
                        amounts[index] ?? ZERO,
                        existing.find((debt) => debt.id === row.debtId)?.amount
                          .currency ?? transaction.currency
                      )}
                    </span>
                    {existing.some(
                      (debt) => debt.id === row.debtId && isSettled(debt)
                    ) ? (
                      <span className="type-caption text-positive">
                        {t.in("debts", "Paid")}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <AmountInput
                    id={`split-${row.id}`}
                    value={row.amountText}
                    currency={transaction.currency}
                    onChange={(value) => {
                      setEdited(true)
                      update(
                        rows.map((other) =>
                          other.id === row.id
                            ? { ...other, amountText: value }
                            : other
                        ),
                        false
                      )
                    }}
                  />
                )}
                {isEditing || rows.length > 1 ? (
                  <KWCircleButton
                    icon="close"
                    label={t.in("debts", "Remove")}
                    onClick={() =>
                      update(rows.filter((other) => other.id !== row.id))
                    }
                  />
                ) : (
                  <span className="size-10" />
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <KWButton
              variant="surface"
              size="small"
              icon="plus"
              onClick={() => update([...rows, newShare()])}
            >
              {t.in("debts", "Add person")}
            </KWButton>
            {rows.length > 0 ? (
              <KWButton
                variant="surface"
                size="small"
                onClick={() => {
                  setEdited(false)
                  update(rows, true)
                }}
              >
                {t.in("debts", "Split equally")}
              </KWButton>
            ) : null}
          </div>
          <p className="type-body text-text-secondary tabular-nums">
            {t.in(
              "web",
              "Your share: %@ of %@",
              formatAmount(yours, transaction.currency),
              formatAmount(total, transaction.currency)
            )}
          </p>
          <p className="type-caption text-muted-foreground">
            {isEditing
              ? t.in(
                  "web",
                  "Removing someone deletes their debt. Repayments they deposited stay in their accounts."
                )
              : t.in(
                  "debts",
                  "Each person gets a debt that owes you their share. Your movement doesn't change."
                )}
          </p>
          {error ? (
            <p role="alert" className="type-caption text-negative">
              {error}
            </p>
          ) : null}
          <DialogFooter className="-mx-6 -mb-6 gap-2 rounded-b-2xl border-divider bg-transparent px-6 pb-6">
            <KWButton variant="surface" onClick={onClose}>
              {t.in("debts", "Cancel")}
            </KWButton>
            <KWButton type="submit" disabled={!canSave}>
              {isEditing ? t.in("debts", "Save") : t.in("debts", "Split")}
            </KWButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
