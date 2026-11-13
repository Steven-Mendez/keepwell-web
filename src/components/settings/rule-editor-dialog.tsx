"use client"

import { useState } from "react"

import { KWButton, KWSegmented } from "@/components/kw/design"
import { TagEditor } from "@/components/kw/tag-editor"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useMerchants } from "@/hooks/use-ledger"
import {
  applyRuleToPast,
  deleteCategorizationRule,
  orderedCategories,
  pastMatchCount,
  saveCategorizationRule,
} from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { categoryName } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"
import {
  MAX_RULE_MATCH_LENGTH,
  type CategorizationRule,
  type TransactionCategory,
} from "@/lib/schema"

import { ConfirmDialog } from "./confirm-dialog"
import { SETTINGS_INPUT } from "./settings-rows"

type Kind = "expense" | "income"

export type RuleEditorTarget =
  | { mode: "create" }
  | { mode: "edit"; rule: CategorizationRule }

/**
 * Creates or edits one categorization rule (iOS RuleEditorView): expense or income, the text the
 * description or note contains, the category and tags to add. A saved rule can also be applied to
 * past movements that are still uncategorized or in "Other", after a confirmation with the count.
 */
export function RuleEditorDialog({
  t,
  target,
  categories,
  tagUsage,
  onClose,
}: {
  t: Translator
  target: RuleEditorTarget
  categories: readonly TransactionCategory[]
  tagUsage: readonly string[]
  onClose: () => void
}) {
  const editing = target.mode === "edit" ? target.rule : undefined
  const [kind, setKind] = useState<Kind>(
    editing?.kind === "income" ? "income" : "expense"
  )
  const [match, setMatch] = useState(editing?.match ?? "")
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "")
  const [tags, setTags] = useState<string[]>(editing?.tags ?? [])
  const [merchantId, setMerchantId] = useState(editing?.merchantId ?? "")
  const merchants = useMerchants() ?? []
  const [isSaving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pastCount, setPastCount] = useState<number>()
  const [applied, setApplied] = useState<string>()

  const options = orderedCategories([...categories]).filter(
    (category) => category.kind === kind
  )
  const canSave = match.trim() !== "" && categoryId !== "" && !isSaving
  const ruleCategory = editing
    ? categories.find((category) => category.id === editing.categoryId)
    : undefined

  async function save() {
    if (!canSave) return
    setSaving(true)
    try {
      await saveCategorizationRule(ledgerStore, {
        ...(editing ? { id: editing.id } : {}),
        match,
        categoryId,
        kind,
        tags,
        ...(merchantId ? { merchantId } : {}),
      })
      onClose()
    } catch {
      setError(t.in("settings", "We couldn't save the rule. Try again."))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!editing) return
    try {
      await deleteCategorizationRule(ledgerStore, editing.id)
      onClose()
    } catch {
      setError(t.in("settings", "We couldn't delete the rule. Try again."))
    }
  }

  /** Counts what the saved rule would change and asks; with nothing to change it says so instead. */
  async function prepareApplyToPast() {
    if (!editing) return
    setApplied(undefined)
    try {
      const count = await pastMatchCount(ledgerStore, editing)
      if (count === 0)
        setApplied(t.in("settings", "No past movements to change."))
      else setPastCount(count)
    } catch {
      setError(t.in("settings", "We couldn't look at your movements. Try again."))
    }
  }

  async function applyToPast() {
    if (!editing) return
    setPastCount(undefined)
    try {
      const count = await applyRuleToPast(ledgerStore, editing)
      setApplied(t.in("settings", "%lld movements updated.", count))
    } catch {
      setError(t.in("settings", "We couldn't update your movements. Try again."))
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90svh] gap-5 overflow-y-auto rounded-2xl bg-card p-6 ring-1 ring-border/60 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="type-heading">
              {editing
                ? t.in("settings", "Edit rule")
                : t.in("settings", "New rule")}
            </DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <KWSegmented
              aria-label={t.in("transactions", "Type")}
              value={kind}
              onChange={(next) => {
                if (next !== kind) setCategoryId("")
                setKind(next)
              }}
              options={[
                { value: "expense", title: t.in("settings", "Expenses") },
                { value: "income", title: t.in("settings", "Income") },
              ]}
            />
            <label className="flex flex-col gap-1.5">
              <span className="type-label text-text-secondary">
                {t.in("settings", "If the description or note contains")}
              </span>
              <Input
                className={SETTINGS_INPUT}
                autoFocus={!editing}
                value={match}
                maxLength={MAX_RULE_MATCH_LENGTH}
                placeholder={t.in("settings", "Uber")}
                aria-label={t.in("settings", "Text to look for")}
                autoComplete="off"
                onChange={(event) => setMatch(event.target.value)}
              />
              <span className="type-caption text-muted-foreground">
                {t.in("settings", "Capitals and accents don't matter.")}
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="type-label text-text-secondary">
                {t.in("settings", "Category")}
              </span>
              <select
                className={SETTINGS_INPUT}
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="" disabled>
                  {t.in("settings", "Choose")}
                </option>
                {options.map((category) => (
                  <option key={category.id} value={category.id}>
                    {categoryName(t, category)}
                  </option>
                ))}
              </select>
            </label>
            {merchants.length > 0 || merchantId ? (
              <label className="flex flex-col gap-1.5">
                <span className="type-label text-text-secondary">
                  {t.in("web", "Business")}
                </span>
                <select
                  className={SETTINGS_INPUT}
                  value={merchantId}
                  onChange={(event) => setMerchantId(event.target.value)}
                >
                  <option value="">{t.in("web", "None")}</option>
                  {/* The rule's business before this browser has it: shown, and kept on save. */}
                  {merchantId &&
                  !merchants.some((merchant) => merchant.id === merchantId) ? (
                    <option value={merchantId}>
                      {t.in("web", "A business not on this device yet")}
                    </option>
                  ) : null}
                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <span className="type-label text-text-secondary">
                {t.in("settings", "Tags to add")}
              </span>
              <TagEditor tags={tags} onChange={setTags} usage={tagUsage} />
            </div>
            {error ? (
              <p className="type-caption text-negative">{error}</p>
            ) : null}
            {editing ? (
              <div className="flex flex-col gap-2">
                <KWButton
                  variant="surface"
                  size="row"
                  fill
                  onClick={() => void prepareApplyToPast()}
                >
                  {t.in("settings", "Apply to past movements")}
                </KWButton>
                {applied ? (
                  <p className="type-caption text-text-secondary" aria-live="polite">
                    {applied}
                  </p>
                ) : null}
              </div>
            ) : null}
            <DialogFooter className="-mx-6 -mb-6 gap-2 rounded-b-2xl border-divider bg-transparent px-6 pb-6 sm:justify-between">
              {editing ? (
                <KWButton
                  variant="destructive"
                  icon="trash"
                  className="bg-negative-tint"
                  disabled={isSaving}
                  onClick={() => setConfirmDelete(true)}
                >
                  {t.in("settings", "Delete rule")}
                </KWButton>
              ) : (
                <span />
              )}
              <KWButton type="submit" disabled={!canSave}>
                {editing
                  ? t.in("settings", "Save")
                  : t.in("settings", "Create rule")}
              </KWButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t.in("settings", "Delete this rule?")}
        description={t.in(
          "settings",
          "Movements it already categorized stay as they are."
        )}
        action={t.in("settings", "Delete")}
        destructive
        onConfirm={() => void remove()}
      />
      <ConfirmDialog
        open={pastCount !== undefined}
        onOpenChange={(open) => !open && setPastCount(undefined)}
        title={t.in(
          "settings",
          "Move %lld movements to %@?",
          pastCount ?? 0,
          ruleCategory ? categoryName(t, ruleCategory) : ""
        )}
        description={t.in(
          "settings",
          "Only movements without a category or in “Other” that match change."
        )}
        action={t.in("settings", "Apply")}
        onConfirm={() => void applyToPast()}
      />
    </>
  )
}
