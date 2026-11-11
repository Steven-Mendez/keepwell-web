"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { useMemo } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getTransactionContext,
  savedTransactionOf,
  type TransactionContext,
} from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { ledgerStore } from "@/lib/repositories"
import type { Transaction } from "@/lib/schema"

import { receiptOf } from "./receipt-model"
import { ReceiptActions, ReceiptTicket } from "./receipt-view"

/** A stored movement's receipt, from its detail panel: the same ticket the editor shows after saving. */
export function ReceiptDialog({
  transaction,
  open,
  onOpenChange,
}: {
  transaction: Transaction
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,880px)] gap-0 overflow-y-auto rounded-[var(--radius-surface)] bg-background p-5 ring-1 ring-border sm:max-w-[440px]">
        {open ? <ReceiptBody transaction={transaction} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function ReceiptBody({ transaction }: { transaction: Transaction }) {
  const context = useLiveQuery(() => getTransactionContext(ledgerStore), [])
  if (!context) return null
  return <LoadedReceipt transaction={transaction} context={context} />
}

function LoadedReceipt({
  transaction,
  context,
}: {
  transaction: Transaction
  context: TransactionContext
}) {
  const t = useT()
  const receipt = useMemo(() => {
    try {
      return receiptOf(
        t,
        savedTransactionOf(
          transaction,
          context.accounts,
          context.transactions,
          context.currencies.principal
        ),
        context
      )
    } catch {
      // Its account was deleted: there's no balance to state.
      return undefined
    }
  }, [t, transaction, context])
  if (!receipt) return null
  return (
    <>
      <DialogTitle className="sr-only">{t.in("transactions", "Receipt")}</DialogTitle>
      <DialogDescription className="sr-only">{`${receipt.headline} ${receipt.amount}`}</DialogDescription>
      <ReceiptTicket
        receipt={receipt}
        footer={<ReceiptActions receipt={receipt} />}
      />
    </>
  )
}
