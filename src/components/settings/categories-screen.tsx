"use client"

import { GripVerticalIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import {
  KWButton,
  KWCircleButton,
  KWGroupedCard,
  KWLargeTitleHeader,
  KWSegmented,
} from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { CategoryBadge, Page } from "@/components/kw/primitives"
import { toast } from "@/components/ui/toast"
import { CategoriesSkeleton } from "@/components/kw/skeletons"
import { useLedger } from "@/hooks/use-ledger"
import { reorderCategories, restoreDefaultCategories } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { categoryName, fallbackCategoryName } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"
import { isFallbackCategory, type TransactionCategory } from "@/lib/schema"
import { cn } from "@/lib/utils"

import {
  CategoryEditorDialog,
  type EditorTarget,
} from "./category-editor-dialog"
import { ConfirmDialog } from "./confirm-dialog"

type Kind = "expense" | "income"

/**
 * Settings › Categories (iOS CategoriesView): each kind in the person's order with "Other" last,
 * create, edit and delete, reorder by dragging or with Move up/Move down, and restore defaults.
 */
export function CategoriesScreen() {
  const t = useT()
  const ledger = useLedger()
  const [kind, setKind] = useState<Kind>("expense")
  const [editor, setEditor] = useState<EditorTarget>()
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [dragging, setDragging] = useState<string>()
  const [over, setOver] = useState<string>()

  // Settings links straight to a kind ("#income").
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the hash is only readable after mount
    if (window.location.hash === "#income") setKind("income")
  }, [])

  const all = ledger?.categories ?? []
  const listed = all.filter((category) => category.kind === kind)
  const movable = listed.filter((category) => !isFallbackCategory(category.id))

  /** The whole list in its new order: this kind rearranged, the other kind where it was. */
  async function persist(order: readonly TransactionCategory[]) {
    const fallback = listed.filter((category) =>
      isFallbackCategory(category.id)
    )
    const queue = [...order, ...fallback]
    const ids = all.map((category) =>
      category.kind === kind ? (queue.shift()?.id ?? category.id) : category.id
    )
    try {
      await reorderCategories(ledgerStore, ids)
    } catch {
      toast.add({
        title: t.in("settings", "We couldn't save the new order. Try again."),
        type: "error",
      })
    }
  }

  function move(id: string, to: number) {
    const from = movable.findIndex((category) => category.id === id)
    if (from < 0 || to < 0 || to >= movable.length || from === to) return
    const order = [...movable]
    const [item] = order.splice(from, 1)
    if (item) order.splice(to, 0, item)
    void persist(order)
  }

  async function restore() {
    try {
      await restoreDefaultCategories(ledgerStore)
    } catch {
      toast.add({
        title: t.in(
          "settings",
          "We couldn't restore the default categories. Try again."
        ),
        type: "error",
      })
    }
  }

  const fallbackName = (() => {
    const other = listed.find((category) => isFallbackCategory(category.id))
    return other ? categoryName(t, other) : fallbackCategoryName(t, kind)
  })()

  return (
    <Page>
      <Link
        href="/settings"
        className="-mb-2 inline-flex w-fit items-center gap-1 rounded-md type-label text-link outline-none hover:text-link-hover focus-visible:ring-2 focus-visible:ring-ring"
      >
        <KWIcon name="chevronLeft" size={16} />
        {t.in("settings", "Settings")}
      </Link>
      <KWLargeTitleHeader
        title={t.in("settings", "Categories")}
        trailing={
          <KWButton
            icon="plus"
            onClick={() => setEditor({ mode: "create", kind })}
          >
            {t.in("settings", "New category")}
          </KWButton>
        }
      />
      <div className="flex flex-col gap-2">
        <KWSegmented
          aria-label={t.in("settings", "Categories")}
          className="sm:max-w-sm"
          value={kind}
          onChange={setKind}
          options={[
            { value: "expense", title: t.in("settings", "Expenses") },
            { value: "income", title: t.in("settings", "Income") },
          ]}
        />
        <span className="px-1 type-caption text-muted-foreground">
          {t.in("web", "Drag to reorder, or use the arrows.")}
        </span>
      </div>

      {!ledger ? (
        <CategoriesSkeleton />
      ) : (
        <KWGroupedCard>
          <ol className="flex flex-col divide-y divide-divider">
            {listed.map((category) => {
              const index = movable.findIndex(
                (candidate) => candidate.id === category.id
              )
              const isFallback = index < 0
              return (
                <li
                  key={category.id}
                  draggable={!isFallback}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move"
                    setDragging(category.id)
                  }}
                  onDragOver={(event) => {
                    if (!dragging || isFallback) return
                    event.preventDefault()
                    setOver(category.id)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (dragging && !isFallback) move(dragging, index)
                    setDragging(undefined)
                    setOver(undefined)
                  }}
                  onDragEnd={() => {
                    setDragging(undefined)
                    setOver(undefined)
                  }}
                  className={cn(
                    "group flex min-h-14 items-center gap-2 px-2 transition-colors",
                    dragging === category.id && "opacity-40",
                    over === category.id &&
                      dragging !== category.id &&
                      "bg-accent-tint"
                  )}
                >
                  <span
                    className={cn(
                      "cursor-grab text-text-faint",
                      isFallback && "invisible"
                    )}
                    aria-hidden
                  >
                    <GripVerticalIcon className="size-4" />
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditor({ mode: "edit", category })}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50"
                  >
                    <CategoryBadge category={category} />
                    <span className="min-w-0 flex-1 truncate type-body text-foreground">
                      {categoryName(t, category)}
                    </span>
                    <KWIcon
                      name="chevronRight"
                      size={16}
                      className="shrink-0 text-text-faint"
                    />
                  </button>
                  {isFallback ? null : (
                    <span className="flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                      <KWCircleButton
                        icon="arrowUp"
                        size={32}
                        label={t.in("settings", "Move up")}
                        disabled={index === 0}
                        onClick={() => move(category.id, index - 1)}
                      />
                      <KWCircleButton
                        icon="arrowDown"
                        size={32}
                        label={t.in("settings", "Move down")}
                        disabled={index === movable.length - 1}
                        onClick={() => move(category.id, index + 1)}
                      />
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </KWGroupedCard>
      )}

      <div className="flex flex-col gap-2">
        <KWButton
          variant="surface"
          size="row"
          fill
          onClick={() => setRestoreOpen(true)}
        >
          {t.in("settings", "Restore default categories")}
        </KWButton>
        <p className="px-1 type-caption text-muted-foreground">
          {t.in(
            "settings",
            "Deleting a category moves its movements to “%@”, which stays so they always have a place.",
            fallbackName
          )}
        </p>
      </div>

      {editor ? (
        <CategoryEditorDialog
          key={
            editor.mode === "edit" ? editor.category.id : `new-${editor.kind}`
          }
          t={t}
          target={editor}
          fallbackName={fallbackName}
          onClose={() => setEditor(undefined)}
        />
      ) : null}
      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title={t.in("settings", "Restore default categories?")}
        description={t.in(
          "settings",
          "Deleted defaults come back and edits to them are undone. Your own categories and movements stay."
        )}
        action={t.in("settings", "Restore")}
        onConfirm={() => void restore()}
      />
    </Page>
  )
}
