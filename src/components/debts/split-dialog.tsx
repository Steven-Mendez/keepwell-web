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
import {
  dec,
  equalShare,
  formatAmount,
  formatNumber,
  parseAmount,
  splitTransaction,
  ZERO,
  Decimal,
} from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { newID } from "@/lib/platform/uuid"
import { ledgerStore } from "@/lib/repositories"
import { MAX_DEBT_NAME_LENGTH, type Transaction } from "@/lib/schema"

interface Share {
  id: string
  person: string
  amountText: string
}

const equalRows = (rows: readonly Share[], total: Decimal) => {
  const text = formatNumber(equalShare(total, rows.length))
  return rows.map((row) => ({ ...row, amountText: text }))
}

/**
 * "Split" on an expense: who shared it and how much each owes. Shares start equal between the person
 * and everyone added, and stay equal until one is typed by hand; each person then owes their share.
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
  const total = dec(transaction.amount)
  const [rows, setRows] = useState<Share[]>(() =>
    equalRows([{ id: newID(), person: "", amountText: "" }], total)
  )
  const [isEdited, setEdited] = useState(false)
  const [error, setError] = useState<string>()
  const [isSaving, setSaving] = useState(false)
  const amounts = rows.map((row) => parseAmount(row.amountText))
  const others = amounts.reduce<Decimal>(
    (sum, amount) => sum.plus(amount ?? ZERO),
    ZERO
  )
  const yours = Decimal.max(total.minus(others), ZERO)
  const canSave =
    !isSaving &&
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
      await splitTransaction(
        ledgerStore,
        transaction.id,
        rows.map((row, index) => ({
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
      <DialogContent className="max-h-[90svh] gap-5 overflow-y-auto rounded-2xl bg-card p-6 ring-1 ring-border/60 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="type-heading">
            {t.in("debts", "Split the expense")}
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
                className="grid grid-cols-[1fr_9rem_auto] items-center gap-2"
              >
                <Input
                  className={SETTINGS_INPUT}
                  aria-label={t.in("debts", "Name")}
                  placeholder={t.in("debts", "Name")}
                  autoFocus={index === rows.length - 1}
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
                {rows.length > 1 ? (
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
              onClick={() =>
                update([...rows, { id: newID(), person: "", amountText: "" }])
              }
            >
              {t.in("debts", "Add person")}
            </KWButton>
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
          </div>
          <p className="type-body text-text-secondary tabular-nums">
            {t.in(
              "debts",
              "Your share: %@",
              formatAmount(yours, transaction.currency)
            )}
          </p>
          <p className="type-caption text-muted-foreground">
            {t.in(
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
              {t.in("debts", "Split")}
            </KWButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
