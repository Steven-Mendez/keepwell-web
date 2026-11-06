"use client"

import { newID } from "@/lib/platform/uuid"

import { useMemo, useState, type KeyboardEvent } from "react"

import type { EditorRequest } from "@/components/app/app-actions"
import type { RecurringFrequency } from "@/lib/schema"
import { toast } from "@/components/ui/toast"
import {
  formatAmountInput,
  formatMoney,
  isDomainError,
  previewMovement,
  saveRepeatingTransaction,
  saveTransaction,
  type MovementType,
  type SavedTransaction,
  type TransactionContext,
} from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { ledgerStore } from "@/lib/repositories"

import { errorMessage, sourceTitle } from "./editor-model"
import {
  deriveForm,
  deriveReview,
  editorTypes,
  initialFields,
  previewDraft,
  selectSource,
  typeChange,
  type CreateTransactionText,
  type EditorFields,
} from "./editor-state"

/** The translator and its `createtransaction` shorthand, which every editor section reads from. */
export function useCreateTransactionT() {
  const t = useT()
  const ct: CreateTransactionText = (key, ...args) =>
    t.in("createtransaction", key, ...args)
  return { t, ct }
}

/** "Repeat" on a new movement: none, or the rule it starts. */
export type RepeatChoice = "none" | RecurringFrequency

/**
 * The CreateTransaction view model: the fields, what follows from them, and saving. `seed` opens it
 * on other fields (the recurring rule editor reuses the same form).
 */
export function useMovementEditor(
  request: EditorRequest,
  context: TransactionContext,
  onClose: () => void,
  seed?: { fields: EditorFields; date: Date }
) {
  const { t, ct } = useCreateTransactionT()
  const existing = request.mode === "edit" ? request.transaction : undefined
  const types = useMemo(
    () => editorTypes(context, existing),
    [context, existing]
  )
  const [initial] = useState(
    () => seed ?? initialFields(request, context, types)
  )
  const [fields, setFields] = useState(initial.fields)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [repeat, setRepeat] = useState<RepeatChoice>("none")
  // A new movement ends on its receipt (iOS SavedView); an edit just closes.
  const [saved, setSaved] = useState<SavedTransaction>()

  const update = (patch: Partial<EditorFields>) =>
    setFields((current) => ({ ...current, ...patch }))

  const form = deriveForm(t, context, request, fields, initial.date)
  const preview = useMemo(
    () => previewMovement(context, previewDraft(form), existing),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the draft is rebuilt every render; these are what it depends on
    [
      context,
      existing,
      form.kind,
      fields.amountText,
      fields.currency,
      fields.source,
      fields.destinationId,
      fields.debitedText,
      fields.dateText,
    ]
  )
  const review = deriveReview(ct, form, fields, preview, saving)

  function changeType(next: MovementType) {
    if (next === fields.type) return
    setError(undefined)
    update(typeChange(next, fields, context, existing))
  }

  function chooseSourceAccount(id: string) {
    update({
      ...selectSource(
        fields.type,
        context,
        id,
        fields.destinationId,
        fields.currency
      ),
      debitedText: "",
    })
  }

  async function save() {
    if (!review.canSave) {
      if (!review.hasAmount) setError(ct("Check the amount."))
      return
    }
    setSaving(true)
    setError(undefined)
    try {
      const draft = { ...form.draft, id: existing?.id ?? newID() }
      const result =
        !existing && repeat !== "none"
          ? await saveRepeatingTransaction(ledgerStore, draft, repeat)
          : await saveTransaction(ledgerStore, draft)
      if (!existing) {
        setSaved(result)
        return
      }
      toast.add({
        title: ct("Saved"),
        description: `${form.draft.description} · ${formatMoney({ amount: form.draft.amount, currency: fields.currency })}`,
        type: "success",
      })
      onClose()
    } catch (thrown) {
      setError(errorMessage(t, isDomainError(thrown) ? thrown.code : undefined))
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void save()
    }
  }

  function onAmountKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.metaKey || event.ctrlKey) return
    event.preventDefault()
    const formatted = formatAmountInput(fields.amountText)
    if (formatted) update({ amountText: formatted })
    // Enter advances: to the categories when one is still missing, else to the description.
    // Both live in the amount's own form, so it's looked up from there rather than through refs.
    const owner = event.currentTarget.form
    const search = owner?.querySelector<HTMLInputElement>(
      "[data-editor-category-search]"
    )
    if (!form.movesBetweenAccounts && !form.category && search) search.focus()
    else owner?.querySelector<HTMLInputElement>("#editor-description")?.focus()
  }

  return {
    context,
    existing,
    types,
    initialType: initial.fields.type,
    fields,
    update,
    form,
    preview,
    review,
    sourceTitleText: sourceTitle(t, fields.source, context),
    error,
    setError,
    creatingCategory,
    setCreatingCategory,
    repeat,
    setRepeat,
    saved,
    changeType,
    chooseSourceAccount,
    save,
    onKeyDown,
    onAmountKeyDown,
  }
}

export type MovementEditorModel = ReturnType<typeof useMovementEditor>
