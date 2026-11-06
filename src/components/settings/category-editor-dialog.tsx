"use client"

import { createElement, useState } from "react"

import { KWButton } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { CategoryBadge } from "@/components/kw/primitives"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { MAX_CATEGORY_NAME_LENGTH, deleteCategory, isDomainError, saveCategory, translatesById, type CategoryDraft } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { CATEGORY_COLOR_KEYS, categoryName, categorySymbol, colorName } from "@/lib/presentation/display"
import { SYMBOL_CHOICES, symbolIcon } from "@/lib/presentation/icons"
import { ledgerStore } from "@/lib/repositories"
import { isFallbackCategory, type TransactionCategory, type TransactionKind } from "@/lib/schema"
import { cn } from "@/lib/utils"

import { ConfirmDialog } from "./confirm-dialog"
import { SETTINGS_INPUT } from "./settings-rows"

export type EditorTarget = { mode: "create"; kind: TransactionKind } | { mode: "edit"; category: TransactionCategory }

/**
 * Port of SharedPresentation/CategoryEditor: name, color and icon of a new or existing category,
 * and deleting it (its movements move to "Other"). Keyed by target, so it opens fresh each time.
 */
export function CategoryEditorDialog({ t, target, fallbackName, onClose }: { t: Translator; target: EditorTarget; fallbackName: string; onClose: () => void }) {
  const editing = target.mode === "edit" ? target.category : undefined
  const kind = editing?.kind ?? (target.mode === "create" ? target.kind : "expense")
  // A default that still translates opens with the name the person reads, not the stored English.
  const initialName = editing ? categoryName(t, editing) : ""
  const [name, setName] = useState(initialName)
  const [icon, setIcon] = useState(editing ? categorySymbol(editing) : (SYMBOL_CHOICES[0] ?? "square.grid.2x2"))
  const [color, setColor] = useState<string | undefined>(editing ? editing.color : CATEGORY_COLOR_KEYS[0])
  const [error, setError] = useState<string>()
  const [isSaving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isFallback = editing ? isFallbackCategory(editing.id) : false
  const canSave = name.trim() !== "" && !isSaving

  const draft = (): CategoryDraft => {
    const trimmed = name.trim()
    const keepsName = editing !== undefined && translatesById(editing) && trimmed === initialName
    const keepsIcon = editing !== undefined && editing.icon === undefined && icon === categorySymbol(editing)
    return {
      ...(editing ? { id: editing.id } : {}),
      name: keepsName && editing ? editing.name : name,
      kind,
      ...(keepsIcon ? {} : { icon }),
      ...(color === undefined ? {} : { color }),
    }
  }

  async function save() {
    if (!canSave) return
    setSaving(true)
    try {
      await saveCategory(ledgerStore, draft())
      onClose()
    } catch (thrown) {
      setError(
        isDomainError(thrown, "missingName")
          ? t.in("sharedpresentation", "Give the category a name.")
          : isDomainError(thrown, "duplicateCategoryName")
            ? t.in("sharedpresentation", "You already have a category with that name.")
            : t.in("sharedpresentation", "We couldn't save the category. Try again."),
      )
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!editing) return
    setSaving(true)
    try {
      await deleteCategory(ledgerStore, editing.id)
      onClose()
    } catch {
      setError(t.in("sharedpresentation", "We couldn't delete the category. Try again."))
    } finally {
      setSaving(false)
    }
  }

  const preview = { id: editing?.id ?? "", ...(color === undefined ? {} : { color }) }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90svh] gap-5 overflow-y-auto rounded-2xl bg-card p-6 ring-1 ring-border/60 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="type-heading">{t.in("sharedpresentation", editing ? "Edit category" : "New category")}</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <div className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-3">
              <CategoryBadge category={{ ...preview, name, kind, isRenamed: false }} symbol={icon} size="lg" />
              <span className={cn("truncate type-heading", name.trim() === "" && "text-muted-foreground")}>{name.trim() === "" ? t.in("sharedpresentation", "Category name") : name}</span>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="type-label text-text-secondary">{t.in("sharedpresentation", "Name")}</span>
              <Input
                className={SETTINGS_INPUT}
                autoFocus
                value={name}
                maxLength={MAX_CATEGORY_NAME_LENGTH}
                placeholder={t.in("sharedpresentation", "Category name")}
                aria-invalid={error ? true : undefined}
                onChange={(event) => {
                  setName(event.target.value.slice(0, MAX_CATEGORY_NAME_LENGTH))
                  setError(undefined)
                }}
              />
              {error ? <span className="type-caption text-negative">{error}</span> : null}
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 type-label text-text-secondary">{t.in("sharedpresentation", "Color")}</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLOR_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setColor(key)}
                    aria-label={colorName(t, key)}
                    aria-pressed={color === key}
                    title={colorName(t, key)}
                    className={cn("flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring", color === key && "ring-2 ring-foreground")}
                    style={{ backgroundColor: `var(--category-${key})` }}
                  >
                    {color === key ? <KWIcon name="check" size={16} strokeWidth={2.4} className="text-black/70" /> : null}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 type-label text-text-secondary">{t.in("sharedpresentation", "Icon")}</legend>
              <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-11">
                {SYMBOL_CHOICES.map((symbol) => {
                  return (
                    <button
                      key={symbol}
                      type="button"
                      onClick={() => setIcon(symbol)}
                      aria-pressed={icon === symbol}
                      aria-label={symbol}
                      className={cn("flex aspect-square items-center justify-center rounded-xl bg-secondary/60 text-text-secondary transition-colors outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring", icon === symbol && "bg-white text-black hover:bg-white")}
                    >
                      {createElement(symbolIcon(symbol), { className: "size-4", strokeWidth: 2, "aria-hidden": true })}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            {isFallback ? (
              <p className="type-caption text-muted-foreground">{t.in("sharedpresentation", "Movements from deleted categories land here, so this one can be renamed but not deleted.")}</p>
            ) : null}
            <DialogFooter className="-mx-6 -mb-6 gap-2 rounded-b-2xl border-divider bg-transparent px-6 pb-6 sm:justify-between">
              {editing && !isFallback ? (
                <KWButton variant="destructive" icon="trash" className="bg-negative-tint" disabled={isSaving} onClick={() => setConfirmDelete(true)}>
                  {t.in("sharedpresentation", "Delete category")}
                </KWButton>
              ) : (
                <span />
              )}
              <KWButton type="submit" disabled={!canSave}>
                {editing ? t.in("sharedpresentation", "Save") : t.in("sharedpresentation", "Create category")}
              </KWButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t.in("sharedpresentation", "Delete this category?")}
        description={t.in("sharedpresentation", "Its movements move to “%@”.", fallbackName)}
        action={t.in("sharedpresentation", "Delete")}
        destructive
        onConfirm={() => void remove()}
      />
    </>
  )
}
