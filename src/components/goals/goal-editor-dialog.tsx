"use client"

import { useState } from "react"

import { AmountInput } from "@/components/accounts/form-parts"
import { KWButton, KWSegmented } from "@/components/kw/design"
import { CategoryBadge } from "@/components/kw/primitives"
import { ColorChoices, IconChoices } from "@/components/settings/category-editor-dialog"
import { ConfirmDialog } from "@/components/settings/confirm-dialog"
import { SETTINGS_INPUT } from "@/components/settings/settings-rows"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  decimalText,
  deleteSavingsGoal,
  isDomainError,
  saveSavingsGoal,
  yearMonthContaining,
} from "@/lib/domain"
import {
  formatNumber,
  parseAmount,
} from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"
import { CATEGORY_COLOR_KEYS } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"
import { MAX_GOAL_NAME_LENGTH, type CurrencySettings, type SavingsGoal, type TargetMonth } from "@/lib/schema"
import { cn } from "@/lib/utils"

import { DEFAULT_GOAL_SYMBOL, goalBadge } from "./goal-format"

export type GoalEditorTarget = { mode: "create" } | { mode: "edit"; goal: SavingsGoal }

const YEARS_AHEAD = 30
const SELECT = cn(SETTINGS_INPUT, "w-full appearance-none")

function saveErrorMessage(t: Translator, thrown: unknown): string {
  if (isDomainError(thrown, "missingName")) return t.in("goals", "Give the goal a name.")
  if (isDomainError(thrown, "invalidAmount")) return t.in("goals", "The target has to be greater than zero.")
  return t.in("goals", "We couldn't save the goal. Try again.")
}

/** Month and year selects; the month's empty option is "No date". */
function TargetMonthPicker({
  t,
  value,
  onChange,
}: {
  t: Translator
  value: TargetMonth | undefined
  onChange: (value: TargetMonth | undefined) => void
}) {
  const now = yearMonthContaining(new Date())
  const firstYear = Math.min(now.year, value?.year ?? now.year)
  const years = Array.from({ length: now.year + YEARS_AHEAD - firstYear + 1 }, (_, index) => firstYear + index)
  const monthName = (month: number) => {
    const text = new Date(2000, month - 1, 1).toLocaleDateString(t.locale, { month: "long" })
    return text.charAt(0).toUpperCase() + text.slice(1)
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="type-label text-text-secondary" id="goal-date-label">
        {t.in("goals", "Target date")}
      </span>
      <div className="grid grid-cols-[1fr_auto] gap-2" role="group" aria-labelledby="goal-date-label">
        <select
          className={SELECT}
          aria-label={t.in("goals", "Target date")}
          value={value?.month ?? ""}
          onChange={(event) => {
            const month = Number(event.target.value)
            if (!month) return onChange(undefined)
            // A first pick lands on the next time that month comes around.
            const year = value?.year ?? (month >= now.month ? now.year : now.year + 1)
            onChange({ month, year })
          }}
        >
          <option value="">{t.in("goals", "No date")}</option>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
            <option key={month} value={month}>
              {monthName(month)}
            </option>
          ))}
        </select>
        <select
          className={cn(SELECT, "min-w-24")}
          aria-label={t.in("goals", "Target date")}
          disabled={!value}
          value={value?.year ?? now.year}
          onChange={(event) => value && onChange({ month: value.month, year: Number(event.target.value) })}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

function useGoalEditor(t: Translator, target: GoalEditorTarget, currencies: CurrencySettings, onClose: () => void) {
  const editing = target.mode === "edit" ? target.goal : undefined
  const [name, setName] = useState(editing?.name ?? "")
  const [amountText, setAmountText] = useState(editing ? formatNumber(editing.target.amount) : "")
  const [currency, setCurrency] = useState(editing?.target.currency ?? currencies.principal)
  const [targetMonth, setTargetMonth] = useState<TargetMonth | undefined>(editing?.targetMonth)
  const [icon, setIcon] = useState(editing?.icon ?? DEFAULT_GOAL_SYMBOL)
  const [color, setColor] = useState<string | undefined>(editing ? editing.color : CATEGORY_COLOR_KEYS[0])
  const [error, setError] = useState<string>()
  const [isSaving, setSaving] = useState(false)
  const amount = parseAmount(amountText)
  const canSave = name.trim() !== "" && amount !== undefined && amount.gt(0) && !isSaving

  async function run(work: () => Promise<unknown>) {
    setSaving(true)
    try {
      await work()
      onClose()
    } catch (thrown) {
      setError(saveErrorMessage(t, thrown))
    } finally {
      setSaving(false)
    }
  }

  const save = () =>
    canSave &&
    run(() =>
      saveSavingsGoal(ledgerStore, {
        ...(editing ? { id: editing.id } : {}),
        name,
        targetAmount: amount ? decimalText(amount) : "0",
        currency,
        ...(targetMonth ? { targetMonth } : {}),
        icon,
        ...(color === undefined ? {} : { color }),
      })
    )
  const remove = () => editing && run(() => deleteSavingsGoal(ledgerStore, editing.id))
  const clearing = <T,>(set: (value: T) => void) => (value: T) => {
    set(value)
    setError(undefined)
  }

  return {
    editing,
    name,
    setName: clearing((value: string) => setName(value.slice(0, MAX_GOAL_NAME_LENGTH))),
    amountText,
    setAmountText: clearing(setAmountText),
    currency,
    setCurrency,
    targetMonth,
    setTargetMonth,
    icon,
    setIcon,
    color,
    setColor,
    error,
    isSaving,
    canSave,
    save,
    remove,
  }
}

/** A new goal or an existing one: name, target and its currency, the month to reach it, look, delete. */
export function GoalEditorDialog({
  t,
  target,
  currencies,
  onClose,
}: {
  t: Translator
  target: GoalEditorTarget
  currencies: CurrencySettings
  onClose: () => void
}) {
  const editor = useGoalEditor(t, target, currencies, onClose)
  const { editing } = editor
  const [confirmDelete, setConfirmDelete] = useState(false)
  const second = currencies.second

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90svh] gap-5 overflow-y-auto rounded-2xl bg-card p-6 ring-1 ring-border/60 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="type-heading">
              {editing ? t.in("goals", "Edit goal") : t.in("goals", "New goal")}
            </DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              void editor.save()
            }}
          >
            <div className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
              <CategoryBadge
                category={goalBadge({ id: editing?.id ?? "", name: editor.name, ...(editor.color ? { color: editor.color } : {}) })}
                symbol={editor.icon}
                size="lg"
              />
              <span className={cn("truncate type-heading", editor.name.trim() === "" && "text-muted-foreground")}>
                {editor.name.trim() === "" ? t.in("goals", "Goal name") : editor.name}
              </span>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="type-label text-text-secondary">{t.in("goals", "Name")}</span>
              <Input
                className={SETTINGS_INPUT}
                autoFocus
                value={editor.name}
                maxLength={MAX_GOAL_NAME_LENGTH}
                placeholder={t.in("goals", "Goal name")}
                onChange={(event) => editor.setName(event.target.value)}
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="goal-target" className="type-label text-text-secondary">
                  {t.in("goals", "Target")}
                </label>
                {second && !editing ? (
                  <KWSegmented
                    style="compact"
                    aria-label={t.in("goals", "Currency")}
                    value={editor.currency}
                    onChange={editor.setCurrency}
                    options={[
                      { value: currencies.principal, title: currencies.principal },
                      { value: second, title: second },
                    ]}
                  />
                ) : null}
              </div>
              <AmountInput
                id="goal-target"
                value={editor.amountText}
                onChange={editor.setAmountText}
                currency={editor.currency}
                invalid={editor.error !== undefined}
              />
            </div>
            <TargetMonthPicker t={t} value={editor.targetMonth} onChange={editor.setTargetMonth} />
            <ColorChoices t={t} color={editor.color} onChange={editor.setColor} />
            <IconChoices t={t} icon={editor.icon} onChange={editor.setIcon} />
            <p className="type-caption text-muted-foreground">
              {t.in("goals", "What you've set aside is only tracked here; your accounts don't change.")}
            </p>
            {editor.error ? (
              <p role="alert" className="type-caption text-negative">
                {editor.error}
              </p>
            ) : null}
            <DialogFooter className="-mx-6 -mb-6 gap-2 rounded-b-2xl border-divider bg-transparent px-6 pb-6 sm:justify-between">
              {editing ? (
                <KWButton
                  variant="destructive"
                  icon="trash"
                  className="bg-negative-tint"
                  disabled={editor.isSaving}
                  onClick={() => setConfirmDelete(true)}
                >
                  {t.in("goals", "Delete goal")}
                </KWButton>
              ) : (
                <span />
              )}
              <KWButton type="submit" disabled={!editor.canSave}>
                {editing ? t.in("goals", "Save") : t.in("goals", "Create goal")}
              </KWButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t.in("goals", "Delete this goal?")}
        description={t.in("goals", "What you've set aside is only tracked here; your accounts don't change.")}
        action={t.in("goals", "Delete")}
        destructive
        onConfirm={() => void editor.remove()}
      />
    </>
  )
}
