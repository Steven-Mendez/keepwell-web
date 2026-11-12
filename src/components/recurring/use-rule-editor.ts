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
  isDomainError,
  type MovementType,
  movementTypeOf,
  occurrencesFrom,
  parseDayKey,
  saveRecurringRule,
  setRecurringRulePaused,
  sourceOf,
  type TransactionContext,
} from "@/lib/domain"
import {
  formatMoney,
  formatNumber,
} from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"
import { ledgerStore } from "@/lib/repositories"
import {
  MAX_RECURRING_INTERVAL,
  type RecurringFrequency,
  type RecurringRule,
} from "@/lib/schema"

import {
  periodOf,
  periodSchedule,
  recurringDraft,
  ruleIsSubscription,
  type SubscriptionPeriod,
} from "./rule-draft"

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
    return t.in("recurring", "Give it a name.")
  if (isDomainError(thrown, "invalidInterval"))
    return t.in("recurring", "It can repeat every 1 to 99.")
  if (isDomainError(thrown, "invalidEndDate"))
    return t.in("recurring", "It can't end before it starts.")
  if (
    isDomainError(thrown, "invalidAmount") ||
    isDomainError(thrown, "invalidTransferDestination")
  )
    return errorMessage(t, thrown.code)
  return t.in("recurring", "We couldn't save it. Try again.")
}

/**
 * The rule editor's view model: the movement form (amount, method, category or accounts, name, start
 * and note, through `useMovementEditor`) plus how it repeats, when it ends, whether it's a
 * subscription and whether it records itself; saving, pausing and deleting.
 *
 * `isNewSubscription` starts a new rule as an expense in "Subscriptions", marked as one, on the short
 * form (name, amount, period and billing day) until `showMoreOptions` shows every field.
 */
export function useRuleEditor(
  t: Translator,
  context: TransactionContext,
  rule: RecurringRule | undefined,
  onClose: () => void,
  isNewSubscription = false
) {
  const [seed] = useState(() => (rule ? seedFrom(rule, context) : undefined))
  const subscription = isNewSubscription && !rule
  const editor = useMovementEditor(
    subscription
      ? { mode: "create", type: "expense", categoryId: SUBSCRIPTIONS_CATEGORY_ID }
      : { mode: "create" },
    context,
    onClose,
    seed,
    false
  )
  const [showsAllFields, setShowsAllFields] = useState(!subscription)
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
    subscription ? true : rule?.isSubscription
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
  const isSubscription = ruleIsSubscription(
    form.kind,
    fields.categoryId,
    subscriptionChoice
  )
  const hasName = fields.description.trim() !== ""
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
  const canSave =
    editor.review.canSave && hasName && intervalValid && endValid && !busy

  async function save() {
    if (!canSave) {
      if (!hasName) editor.setError(t.in("recurring", "Give it a name."))
      else if (!editor.review.hasAmount)
        editor.setError(t.in("createtransaction", "Check the amount."))
      else if (!intervalValid)
        editor.setError(t.in("recurring", "It can repeat every 1 to 99."))
      else if (!endValid)
        editor.setError(t.in("recurring", "It can't end before it starts."))
      return
    }
    setBusy(true)
    editor.setError(undefined)
    const { draft } = form
    try {
      await saveRecurringRule(
        ledgerStore,
        recurringDraft(draft, {
          ...(rule ? { id: rule.id } : {}),
          frequency,
          interval,
          ...(endDate ? { endDate } : {}),
          isSubscription,
          autoConfirm,
        })
      )
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

  async function run(
    work: () => Promise<void>,
    closes: boolean,
    failure: string
  ) {
    setBusy(true)
    try {
      await work()
      if (closes) onClose()
    } catch {
      toast.add({
        title: failure,
        type: "error",
      })
    } finally {
      setBusy(false)
    }
  }

  return {
    editor,
    rule,
    isNewSubscription: subscription,
    showsAllFields,
    showMoreOptions: () => setShowsAllFields(true),
    /** The short form hides only what already has a value: a method, and the category it opened with. */
    shortFormNeedsChoices: !fields.source || !form.category,
    /** The schedule as one of the short form's four periods; monthly while another one is chosen. */
    period: periodOf(frequency, intervalValid ? interval : Number.NaN) ?? "monthly",
    setPeriod: (period: SubscriptionPeriod) => {
      const schedule = periodSchedule(period)
      setFrequency(schedule.frequency)
      setIntervalText(String(schedule.interval))
    },
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
    /** Changing the kind clears the subscription choice: only an expense can be one (iOS). */
    changeType: (next: MovementType) => {
      setSubscription(undefined)
      editor.changeType(next)
    },
    /** The last day when the end switch turns on: a year after the start (iOS). */
    defaultEnd: () => {
      const start = form.date
      return dayKey(
        new Date(start.getFullYear() + 1, start.getMonth(), start.getDate())
      )
    },
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
            false,
            t.in("recurring", "We couldn't save it. Try again.")
          )
        : undefined,
    remove: () =>
      rule
        ? run(
            () => deleteRecurringRule(ledgerStore, rule.id),
            true,
            t.in("recurring", "We couldn't delete it. Try again.")
          )
        : undefined,
  }
}

export type RuleEditorModel = ReturnType<typeof useRuleEditor>
