"use client"

import { HashIcon, MoreHorizontalIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import { SplitDialog } from "@/components/debts/split-dialog"
import { KWIcon } from "@/components/kw/kw-icon"
import { tagLabel } from "@/components/kw/tag-editor"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/toast"
import { confirmPlannedTransaction, deleteTransaction } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { ledgerStore } from "@/lib/repositories"
import type { Transaction } from "@/lib/schema"

import { DeleteDialog } from "./movement-detail"
import { rowMenuActions } from "./row-menu-model"
import { useShowTag } from "./show-tag"

export interface RowMenuItem {
  key: string
  label: string
  icon: ReactNode
  destructive?: boolean
  onSelect: () => void
}

/**
 * The actions of a movement's row menu, in iOS TransactionsView's order: "Show #tag" for each tag,
 * Split (expenses only), Confirm (drafts only) and Delete.
 */
export function rowMenuItems(
  t: Translator,
  transaction: Transaction,
  actions: { showTag: (tag: string) => void; split: () => void; confirm: () => void; remove: () => void }
): RowMenuItem[] {
  return rowMenuActions(transaction).map((action): RowMenuItem => {
    switch (action.kind) {
      case "showTag":
        return { key: `tag:${action.tag}`, label: t.in("transactions", "Show %@", tagLabel(action.tag)), icon: <HashIcon />, onSelect: () => actions.showTag(action.tag) }
      case "split":
        return { key: "split", label: t.in("transactions", "Split"), icon: <KWIcon name="person" size={16} />, onSelect: actions.split }
      case "confirm":
        return { key: "confirm", label: t.in("transactions", "Confirm"), icon: <KWIcon name="check" size={16} />, onSelect: actions.confirm }
      case "delete":
        return { key: "delete", label: t.in("transactions", "Delete"), icon: <KWIcon name="trash" size={16} />, destructive: true, onSelect: actions.remove }
    }
  })
}

/**
 * Wraps each row with its menu: right-click opens it (iOS's long-press menu), and a "…" button
 * does the same by pointer or keyboard, shown on hover and focus (Mobbin: Meetup's transactions
 * table). Returns `wrap` for the rows and `dialogs` to render once beside the list.
 */
export function useRowMenu(t: Translator) {
  const showTag = useShowTag()
  const [splitting, setSplitting] = useState<Transaction>()
  const [deleting, setDeleting] = useState<Transaction>()

  async function confirm(transaction: Transaction) {
    try {
      await confirmPlannedTransaction(ledgerStore, transaction.id)
    } catch {
      toast.add({ title: t.in("home", "We couldn't confirm it. Try again."), type: "error" })
    }
  }

  async function remove() {
    if (!deleting) return
    try {
      await deleteTransaction(ledgerStore, deleting.id)
      setDeleting(undefined)
    } catch {
      toast.add({ title: t.in("transactions", "We couldn't save the change. Try again."), type: "error" })
    }
  }

  const wrap = (transaction: Transaction, row: ReactNode): ReactNode => {
    const items = rowMenuItems(t, transaction, {
      showTag,
      split: () => setSplitting(transaction),
      confirm: () => void confirm(transaction),
      remove: () => setDeleting(transaction),
    })
    return (
      <ContextMenu>
        <ContextMenuTrigger render={<div className="group/row flex items-center" />}>
          <div className="min-w-0 flex-1">{row}</div>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t.in("web", "More actions")}
              className="mr-2 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-opacity hover:bg-secondary focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring data-popup-open:opacity-100 lg:opacity-0 lg:group-focus-within/row:opacity-100 lg:group-hover/row:opacity-100"
            >
              <MoreHorizontalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-44">
              {items.map((item) => (
                <DropdownMenuItem key={item.key} variant={item.destructive ? "destructive" : "default"} onClick={item.onSelect}>
                  {item.icon}
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-44">
          {items.map((item) => (
            <ContextMenuItem key={item.key} variant={item.destructive ? "destructive" : "default"} onClick={item.onSelect}>
              {item.icon}
              {item.label}
            </ContextMenuItem>
          ))}
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  const dialogs = (
    <>
      {splitting ? <SplitDialog key={splitting.id} t={t} transaction={splitting} onClose={() => setSplitting(undefined)} /> : null}
      <DeleteDialog t={t} open={deleting !== undefined} onOpenChange={(open) => !open && setDeleting(undefined)} onDelete={() => void remove()} />
    </>
  )
  return { wrap, dialogs }
}
