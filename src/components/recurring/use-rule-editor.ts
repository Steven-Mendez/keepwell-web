"use client"

import { useState } from "react"

import { toast } from "@/components/ui/toast"
import { errorMessage } from "@/components/movement-editor/editor-model"
import {
  localDateTime,
  type EditorFields,
} from "@/components/movement-editor/editor-state"
import { useMovementEditor } from "@/components/movement-editor/use-movement-editor"
import {
  SUBSCRIPTIONS_CATEGORY_ID,
  dayKey,
  dec,
  deleteRecurringRule,
  firstNextDate,
  formatMoney,
  formatNumber,
  isDomainError,
  movementTypeOf,
  occurrencesFrom,
  parseDayKey,
  saveRecurringRule,
  setRecurringRulePaused,
  sourceOf,
  type TransactionContext,
} from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { ledgerStore } from "@/lib/repositories"
import {
  MAX_RECURRING_INTERVAL,
  type RecurringFrequency,
  type RecurringRule,
} from "@/lib/schema"

/** The movement form's fields for an existing rule: its first occurrence stands in for the date. */
function seedFrom(rule: RecurringRule, context: TransactionContext) {
  const amount = dec(rule.amount)
  const date = new Date(rule.startDate)
  const fields: EditorFields = {
    type: movementTypeOf(rule, context.accounts),
    amountText: formatNumber(amount, Math.max(2, amount.decimalPlaces())),
    currency: rule.currency,
    categoryId: rule.categoryId,
    source: sourceOf(rule),
    destinationId: rule.destinationAccountId,
    description: rule.name,
    dateText: localDateTime(date),
    note: rule.note ?? "",
    isDraft: !rule.autoConfirm,
    debitedText: "",
  }
  return { fields, date }
}

function saveError(t: Translator, thrown: unknown): string {
  if (isDomainError(thrown, "missingName"))
    return t.in("web", "Give it a name.")
  if (isDomainError(thrown, "invalidInterval"))
    return t.in("web", "Repeat every 1 to 99.")
  if (isDomainError(thrown, "invalidEndDate"))
    return t.in("web", "The end can't be before the start.")
  return errorMessage(t, isDomainError(thrown) ? thrown.code : undefined)
}

/**
 * The rule editor's view model: the movement form (amount, method, category or accounts, name, start
 * and note, through `useMovementEditor`) plus how it repeats, when it ends, whether it's a
 * subscription and whether it records itself; saving, pausing and deleting.
 */
export function useRuleEditor(
  t: Translator,
  context: TransactionContext,
  rule: RecurringRule | undefined,
  onClose: () => void
) {
  const [seed] = useState(() => (rule ? seedFrom(rule, context) : undefined))
  const editor = useMovementEditor({ mode: "create" }, context, onClose, seed, false)
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    rule?.frequency ?? "monthly"
  )
  const [intervalText, setIntervalText] = useState(String(rule?.interval ?? 1))
  const [endsText, setEndsText] = useState(
    rule?.endDate ? dayKey(new Date(rule.endDate)) : ""
  )
  const [hasEnd, setHasEnd] = useState(rule?.endDate !== undefined)
  // A new rule follows its category until the person flips the switch.
  const [subscriptionChoice, setSubscription] = useState<boolean | undefined>(
    rule?.isSubscription
  )
  const [autoConfirm, setAutoConfirm] = useState(rule?.autoConfirm ?? false)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const { form, fields } = editor
  const interval = /^\d+$/.test(intervalText.trim())
    ? Number(intervalText.trim())
    : Number.NaN
  const intervalValid =
    Number.isInteger(interval) &&
    interval >= 1 &&
    interval <= MAX_RECURRING_INTERVAL
  const endDate = hasEnd ? parseDayKey(endsText) : undefined
  const endValid =
    !hasEnd || (endDate !== undefined && dayKey(endDate) >= dayKey(form.date))
  const isSubscription =
    subscriptionChoice ??
    (form.kind === "expense" && fields.categoryId === SUBSCRIPTIONS_CATEGORY_ID)
  const schedule = {
    frequency,
    interval: intervalValid ? interval : 1,
    startDate: form.date.toISOString(),
    ...(endDate && endValid ? { endDate: endDate.toISOString() } : {}),
  }
  const keepsSchedule =
    rule !== undefined &&
    rule.startDate === schedule.startDate &&
    rule.frequency === schedule.frequency &&
    rule.interval === schedule.interval
  const nextDates = intervalValid
    ? occurrencesFrom(
        schedule,
        keepsSchedule ? new Date(rule.nextDate) : firstNextDate(schedule),
        3
      )
    : []
  const canSave = editor.review.canSave && intervalValid && endValid && !busy

  async function save() {
    if (!canSave) {
      if (!editor.review.hasAmount)
        editor.setError(t.in("createtransaction", "Check the amount."))
      else if (!intervalValid)
        editor.setError(t.in("web", "Repeat every 1 to 99."))
      else if (!endValid)
        editor.setError(t.in("web", "The end can't be before the start."))
      return
    }
    setBusy(true)
    editor.setError(undefined)
    const { draft } = form
    try {
      await saveRecurringRule(ledgerStore, {
        ...(rule ? { id: rule.id } : {}),
        name: draft.description,
        kind: draft.kind,
        amount: draft.amount,
        currency: draft.currency,
        ...(draft.categoryId ? { categoryId: draft.categoryId } : {}),
        ...(draft.source ? { source: draft.source } : {}),
        ...(draft.destinationAccountId
          ? { destinationAccountId: draft.destinationAccountId }
          : {}),
        frequency,
        interval,
        startDate: draft.date,
        ...(endDate ? { endDate } : {}),
        isSubscription,
        autoConfirm,
        note: draft.note,
      })
      toast.add({
        title: t.in("createtransaction", "Saved"),
        description: `${draft.description.trim()} · ${formatMoney({ amount: draft.amount, currency: draft.currency })}`,
        type: "success",
      })
      onClose()
    } catch (thrown) {
      editor.setError(saveError(t, thrown))
    } finally {
      setBusy(false)
    }
  }

  async function run(work: () => Promise<void>, closes: boolean) {
    setBusy(true)
    try {
      await work()
      if (closes) onClose()
    } catch {
      toast.add({
        title: t.in("web", "We couldn't save the change. Try again."),
        type: "error",
      })
    } finally {
      setBusy(false)
    }
  }

  return {
    editor,
    rule,
    frequency,
    setFrequency,
    intervalText,
    setIntervalText,
    interval: intervalValid ? interval : 1,
    intervalValid,
    hasEnd,
    setHasEnd,
    endsText,
    setEndsText,
    endValid,
    isSubscription,
    setSubscription,
    autoConfirm,
    setAutoConfirm,
    nextDates,
    canSave,
    busy,
    save,
    confirmingDelete,
    setConfirmingDelete,
    togglePause: () =>
      rule
        ? run(
            () => setRecurringRulePaused(ledgerStore, rule.id, !rule.isPaused),
            false
          )
        : undefined,
    remove: () =>
      rule
        ? run(() => deleteRecurringRule(ledgerStore, rule.id), true)
        : undefined,
  }
}

export type RuleEditorModel = ReturnType<typeof useRuleEditor>
