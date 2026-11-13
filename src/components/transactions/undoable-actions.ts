"use client"

import { toast } from "@/components/ui/toast"
import { confirmPlannedTransaction, unconfirmTransaction } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { ledgerStore, movementDeletions, UNDO_WINDOW_MS } from "@/lib/repositories"
import type { Transaction } from "@/lib/schema"

const failed = (t: Translator) => () =>
  toast.add({ title: t.in("transactions", "We couldn't save the change. Try again."), type: "error" })

/**
 * Deletes a movement with "Undo" for a few seconds. It disappears at once, but its tombstone (and
 * the sync event) is written only when the notice closes, so undoing leaves no trace. The notice's
 * countdown pauses while the pointer rests on it, so the deletion follows the notice, not a clock;
 * if the tab closes first, `movementDeletions` finishes it.
 */
export function deleteMovement(t: Translator, transaction: Pick<Transaction, "id" | "description">): void {
  const deletions = movementDeletions()
  deletions.schedule(transaction.id, { untilReleased: true })
  const notice = toast.add({
    title: t.in("sharedpresentation", "Transaction deleted"),
    description: transaction.description,
    timeout: UNDO_WINDOW_MS,
    onClose: () => void deletions.release(transaction.id),
    actionProps: {
      children: t.in("sharedpresentation", "Undo"),
      onClick: () => {
        deletions.undo(transaction.id)
        toast.close(notice)
      },
    },
  })
}

/** Confirms a draft with "Undo", which makes it a draft again on its planned date. */
export async function confirmDraft(t: Translator, planned: Pick<Transaction, "id" | "description" | "date">): Promise<void> {
  await confirmPlannedTransaction(ledgerStore, planned.id)
  toast.add({
    title: t.in("sharedpresentation", "Confirmed"),
    description: planned.description,
    type: "success",
    timeout: UNDO_WINDOW_MS,
    actionProps: {
      children: t.in("sharedpresentation", "Undo"),
      onClick: () => void unconfirmTransaction(ledgerStore, planned.id, planned.date).catch(failed(t)),
    },
  })
}
