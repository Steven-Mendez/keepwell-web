"use client"

import { useState } from "react"

import { CategoryBadge } from "@/components/kw/primitives"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { MAX_CATEGORY_NAME_LENGTH, isDomainError, saveCategory } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { CATEGORY_COLOR_KEYS, colorName } from "@/lib/presentation/display"
import { SYMBOL_CHOICES, symbolIcon } from "@/lib/presentation/icons"
import { ledgerStore } from "@/lib/repositories"
import type { TransactionCategory, TransactionKind } from "@/lib/schema"
import { cn } from "@/lib/utils"

/**
 * "New category" from inside the flow (iOS CategoryEditorView, create mode): name, icon and color.
 * The created category is picked right away, keeping everything already typed.
 */
export function NewCategoryDialog({
  kind,
  open,
  onOpenChange,
  onCreated,
}: {
  kind: TransactionKind
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (category: TransactionCategory) => void
}) {
  const t = useT()
  const sp = (key: string) => t.in("sharedpresentation", key)
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("square.grid.2x2")
  const [color, setColor] = useState<string>("blue")
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  function reset() {
    setName("")
    setIcon("square.grid.2x2")
    setColor("blue")
    setError(undefined)
  }

  async function create() {
    if (name.trim() === "") {
      setError(sp("Give the category a name."))
      return
    }
    setSaving(true)
    try {
      const category = await saveCategory(ledgerStore, { name, kind, icon, color })
      onCreated(category)
      reset()
      onOpenChange(false)
    } catch (thrown) {
      setError(
        isDomainError(thrown, "duplicateCategoryName")
          ? sp("You already have a category with that name.")
          : isDomainError(thrown, "missingName")
            ? sp("Give the category a name.")
            : sp("We couldn't save the category. Try again."),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="type-heading">{sp("New category")}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void create()
          }}
        >
          <div className="flex items-center gap-3">
            <CategoryBadge category={{ id: "custom-preview", name, kind, icon, color, isRenamed: false }} size="lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor="new-category-name" className="type-caption text-muted-foreground">
                {sp("Category name")}
              </label>
              <Input
                id="new-category-name"
                autoFocus
                value={name}
                maxLength={MAX_CATEGORY_NAME_LENGTH}
                onChange={(event) => {
                  setName(event.target.value)
                  setError(undefined)
                }}
                aria-invalid={error ? true : undefined}
                className="h-9"
              />
            </div>
          </div>
          {error ? <p className="type-caption text-negative">{error}</p> : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 type-caption text-muted-foreground">{sp("Icon")}</legend>
            <div className="grid max-h-44 grid-cols-8 gap-1 overflow-y-auto pr-1" role="radiogroup" aria-label={sp("Icon")}>
              {SYMBOL_CHOICES.map((symbol) => {
                const Icon = symbolIcon(symbol)
                return (
                  <button
                    key={symbol}
                    type="button"
                    role="radio"
                    aria-checked={icon === symbol}
                    aria-label={symbol}
                    onClick={() => setIcon(symbol)}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      icon === symbol ? "bg-accent-tint text-link ring-1 ring-ring/70" : "text-text-secondary hover:bg-accent/60",
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                )
              })}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 type-caption text-muted-foreground">{sp("Color")}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={sp("Color")}>
              {CATEGORY_COLOR_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={color === key}
                  aria-label={colorName(t, key)}
                  title={colorName(t, key)}
                  onClick={() => setColor(key)}
                  className={cn("size-7 rounded-full ring-offset-2 ring-offset-popover outline-none focus-visible:ring-2 focus-visible:ring-ring", color === key && "ring-2 ring-foreground")}
                  style={{ backgroundColor: `var(--category-${key})` }}
                />
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.in("web", "Cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {sp("Create category")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
