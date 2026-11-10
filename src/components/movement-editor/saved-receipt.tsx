"use client"

import { useMemo } from "react"

import { KWButton } from "@/components/kw/design"
import { receiptOf } from "@/components/receipt/receipt-model"
import {
  ReceiptActions,
  ReceiptTicket,
} from "@/components/receipt/receipt-view"
import { DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { SavedTransaction, TransactionContext } from "@/lib/domain"

import { FlowHeader } from "./flow-parts"
import { useCreateTransactionT } from "./use-movement-editor"

/**
 * iOS SavedView: the receipt of what was just saved, with "Download image" and "Share" at the foot
 * of the ticket, then "Log another" and "Done".
 */
export function SavedReceipt({
  saved,
  context,
  onLogAnother,
  onClose,
}: {
  saved: SavedTransaction
  context: TransactionContext
  onLogAnother: () => void
  onClose: () => void
}) {
  const { t, ct } = useCreateTransactionT()
  // The context refreshes live after saving; the receipt only needs to follow the names in it.
  const receipt = useMemo(
    () => receiptOf(t, saved, context),
    [t, saved, context]
  )
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="px-5 pt-5 md:px-6">
        <FlowHeader leading="close" onLeading={onClose} />
        <DialogTitle className="sr-only">{receipt.headline}</DialogTitle>
        <DialogDescription className="sr-only">
          {receipt.amount}
        </DialogDescription>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 md:px-6">
        <ReceiptTicket
          receipt={receipt}
          footer={<ReceiptActions receipt={receipt} />}
          className="mx-auto w-full max-w-[400px]"
        />
      </div>
      {/* The gutter outside the 400 px column, as around the ticket, so the buttons span exactly the
          ticket's width (inside it they sat 20 px in, and two w-full buttons overflowed it). */}
      <div className="px-5 pt-3 pb-6 md:px-6">
        <div className="mx-auto flex w-full max-w-[400px] gap-2.5">
          <KWButton
            variant="surface"
            className="min-w-0 flex-1"
            onClick={onLogAnother}
          >
            {ct("Log another")}
          </KWButton>
          <KWButton className="min-w-0 flex-1" autoFocus onClick={onClose}>
            {ct("Done")}
          </KWButton>
        </div>
      </div>
    </div>
  )
}
