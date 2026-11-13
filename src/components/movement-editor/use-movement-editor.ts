"use client"

import { newID } from "@/lib/platform/uuid"

import { useLiveQuery } from "dexie-react-hooks"
import { useMemo, useState, type KeyboardEvent } from "react"

import type { EditorRequest } from "@/components/app/app-actions"
import { isFallbackCategory, type CategorizationRule, type RecurringFrequency } from "@/lib/schema"
import { toast } from "@/components/ui/toast"
import {
  fetchCategorizationRules,
  firstMatchingRule,
  isDomainError,
  movementKind,
  previewMovement,
  saveCategorizationRule,
  saveRepeatingTransaction,
  saveTransaction,
  tagUsage,
  type MovementType,
  type SavedTransaction,
  type TransactionContext,
} from "@/lib/domain"
import {
  formatAmountInput,
  formatMoney,
} from "@/lib/domain/format"
import { useT, type Translator } from "@/lib/i18n"
import { categoryName } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"

import { errorMessage, sourceTitle } from "./editor-model"
import {
  carriedDebitText,
  clearingStaleDebit,
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

/** What a categorization rule did to the movement being typed, so it can be undone (iOS `appliedRule`). */
interface RuleState {
  applied: CategorizationRule | undefined
  /** The category before the rule changed it, to put back when the text stops matching. */
  before: string | undefined
  /** The tags the rule added, so another rule (or none) can take them back. */
  added: string[]
}

const NO_RULE: RuleState = { applied: undefined, before: undefined, added: [] }

/**
 * The CreateTransaction view model: the fields, what follows from them, and saving. `seed` opens it
 * on other fields (the recurring rule editor reuses the same form, with `usesRules` off: rules and
 * tags belong to movements the person logs).
 */
export function useMovementEditor(
  request: EditorRequest,
  context: TransactionContext,
  onClose: () => void,
  seed?: { fields: EditorFields; date: Date },
  usesRules = true
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
  const [tags, setTags] = useState<string[]>(() => existing?.tags ?? [])
  const [rule, setRule] = useState<RuleState>(NO_RULE)
  // An edited movement already has its category; a widget's preset doesn't count as picked.
  const [categoryPicked, setCategoryPicked] = useState(existing !== undefined)
  const storedRules = useLiveQuery(() => fetchCategorizationRules(ledgerStore), [])
  // Rules apply while logging a new movement, never to an edit; one whose category is gone does nothing.
  const rules = useMemo(
    () =>
      usesRules && !existing
        ? (storedRules ?? []).filter((candidate) =>
            context.categories.some((category) => category.id === candidate.categoryId && category.kind === candidate.kind)
          )
        : [],
    [usesRules, existing, storedRules, context.categories]
  )
  const usage = useMemo(() => tagUsage(context.transactions), [context.transactions])

  /**
   * iOS `applyRules`: the description or note changed, so the first rule of this kind they match
   * chooses the category and adds its tags, unless the person picked a category themselves (the
   * catch-all "Other" still lets a rule decide). When the text stops matching, the earlier category
   * and the rule's tags go back.
   */
  function applyingRules(next: EditorFields): EditorFields {
    const kind = movementKind(next.type)
    if (kind === "transfer" || rules.length === 0) return next
    const mayChoose =
      !categoryPicked ||
      rule.applied !== undefined ||
      (next.categoryId !== undefined && isFallbackCategory(next.categoryId))
    if (!mayChoose) return next
    const match = firstMatchingRule(rules, kind, next.description, next.note)
    if (match?.id === rule.applied?.id) return next
    const before = rule.applied ? rule.before : next.categoryId
    const kept = tags.filter((tag) => !rule.added.includes(tag))
    const added = match ? (match.tags ?? []).filter((tag) => !kept.includes(tag)) : []
    setTags([...kept, ...added])
    setRule({ applied: match, before, added })
    return { ...next, categoryId: match ? match.categoryId : before }
  }

  const carriedDebit = useMemo(() => (existing ? carriedDebitText(existing) : ""), [existing])
  const update = (patch: Partial<EditorFields>) => {
    const next = { ...fields, ...clearingStaleDebit(fields, patch, carriedDebit) }
    setFields("description" in patch || "note" in patch ? applyingRules(next) : next)
  }

  /** The person chose a category: no rule replaces it from now on. */
  function pickCategory(categoryId: string) {
    setCategoryPicked(true)
    setRule(NO_RULE)
    update({ categoryId })
  }

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
    const patch = typeChange(next, fields, context, existing)
    if ("categoryId" in patch) {
      setRule(NO_RULE)
      setCategoryPicked(false)
    }
    update(patch)
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
      const draft = { ...form.draft, id: existing?.id ?? newID(), tags }
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
      if (existing) offerRule(t, existing.categoryId, form)
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
    tags,
    setTags,
    tagUsage: usage,
    ruleHint: rule.applied
      ? ct("Category from rule: %@", rule.applied.match)
      : undefined,
    pickCategory,
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

/**
 * After the person moves an edited expense or income to another category: "Always use Transport
 * for 'Uber'?", which saves a rule matching the description. Offered once, on the saved toast.
 */
function offerRule(
  t: Translator,
  previousCategoryId: string | undefined,
  form: ReturnType<typeof deriveForm>
) {
  const { category, draft } = form
  const match = draft.description.trim()
  if (!category || draft.kind === "transfer" || category.id === previousCategoryId || match === "") return
  const name = categoryName(t, category)
  toast.add({
    title: t.in("createtransaction", "Always use %@ for “%@”?", name, match),
    timeout: 8000,
    actionProps: {
      children: t.in("settings", "Create rule"),
      onClick: () => {
        saveCategorizationRule(ledgerStore, { match, categoryId: category.id, kind: draft.kind })
          .then(() => toast.add({ title: t.in("createtransaction", "Rule saved"), type: "success" }))
          .catch(() => toast.add({ title: t.in("settings", "We couldn't save the rule. Try again."), type: "error" }))
      },
    },
  })
}
