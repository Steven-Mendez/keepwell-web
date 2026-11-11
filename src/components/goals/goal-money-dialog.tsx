"use client"

import { useState } from "react"

import { AmountInput } from "@/components/accounts/form-parts"
import { KWButton } from "@/components/kw/design"
import { BALANCE_MASK, useHiddenBalances } from "@/hooks/use-hidden-balances"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  addToSavingsGoal,
  dec,
  decimalText,
  withdrawFromSavingsGoal,
} from "@/lib/domain"
import {
  formatAmount,
  parseAmount,
} from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"
import { ledgerStore } from "@/lib/repositories"
import type { SavingsGoal } from "@/lib/schema"

export type GoalMoneyMode = "add" | "withdraw"

/** "Add money" or "Withdraw": one amount, in the goal's currency. Accounts don't change. */
export function GoalMoneyDialog({
  t,
  goal,
  mode,
  onClose,
}: {
  t: Translator
  goal: SavingsGoal
  mode: GoalMoneyMode
  onClose: () => void
}) {
  const [hidden] = useHiddenBalances()
  const [text, setText] = useState("")
  const [isSaving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const amount = parseAmount(text)
  const tooMuch = mode === "withdraw" && amount !== undefined && amount.gt(dec(goal.saved))
  const canSave = amount !== undefined && amount.gt(0) && !tooMuch && !isSaving
  const title = mode === "add" ? t.in("goals", "Add money") : t.in("goals", "Withdraw")

  async function save() {
    if (!canSave || !amount) return
    setSaving(true)
    try {
      const run = mode === "add" ? addToSavingsGoal : withdrawFromSavingsGoal
      await run(ledgerStore, goal.id, decimalText(amount))
      onClose()
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-5 rounded-2xl bg-card p-6 ring-1 ring-border/60 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="type-heading">{title}</DialogTitle>
          <p className="type-caption text-muted-foreground">
            {goal.name} ·{" "}
            {t.in(
              "goals",
              "%@ of %@",
              hidden ? BALANCE_MASK : formatAmount(goal.saved, goal.target.currency),
              hidden ? BALANCE_MASK : formatAmount(goal.target.amount, goal.target.currency)
            )}
          </p>
        </DialogHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="goal-money" className="type-label text-text-secondary">
              {t.in("goals", "Amount")}
            </label>
            <AmountInput
              id="goal-money"
              autoFocus
              value={text}
              onChange={(value) => {
                setText(value)
                setFailed(false)
              }}
              currency={goal.target.currency}
              invalid={tooMuch || failed}
            />
            {tooMuch ? (
              <span role="alert" className="type-caption text-negative">
                {t.in("goals", "You can't withdraw more than you've set aside.")}
              </span>
            ) : failed ? (
              <span role="alert" className="type-caption text-negative">
                {t.in("goals", "We couldn't save the goal. Try again.")}
              </span>
            ) : null}
          </div>
          <DialogFooter className="-mx-6 -mb-6 gap-2 rounded-b-2xl border-divider bg-transparent px-6 pb-6">
            <KWButton variant="surface" onClick={onClose}>
              {t.in("goals", "Cancel")}
            </KWButton>
            <KWButton type="submit" disabled={!canSave}>
              {title}
            </KWButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
