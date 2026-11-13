"use client"

import { useState } from "react"

import { toast } from "@/components/ui/toast"
import type { Translator } from "@/lib/i18n"
import type { Transaction } from "@/lib/schema"

import { confirmDraft as confirmDraftWithUndo } from "./undoable-actions"

/**
 * "Confirm" on a draft, from Home or a Recurring row: it confirms straight away (no dialog) and offers
 * "Undo". `confirming` holds the drafts on their way, so their buttons turn off and a list can slide
 * them out before the ledger drops them (iOS animates removal).
 */
export function useConfirmDraft(t: Translator) {
  const [confirming, setConfirming] = useState<ReadonlySet<string>>(new Set())
  const confirmDraft = (planned: Transaction) => {
    const id = planned.id
    if (confirming.has(id)) return
    setConfirming((current) => new Set(current).add(id))
    window.setTimeout(() => {
      confirmDraftWithUndo(t, planned)
        .catch(() =>
          toast.add({
            title: t.in("home", "We couldn't confirm it. Try again."),
            type: "error",
          })
        )
        .finally(() =>
          setConfirming((current) => {
            const next = new Set(current)
            next.delete(id)
            return next
          })
        )
    }, 200)
  }
  return { confirming, confirmDraft }
}
