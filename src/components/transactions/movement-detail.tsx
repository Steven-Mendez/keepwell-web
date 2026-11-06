"use client"

import { transactionAmountClass } from "@/components/kw/design-styles"
import { useState } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { KWActionButton, KWButton, KWCircleButton, KWGroupedCard, KWTransactionIcon, KWValueRow } from "@/components/kw/design"
import { StatusPill } from "@/components/movement-editor/flow-parts"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useLedger, useTransactionDisplay } from "@/hooks/use-ledger"
import { bankRate, confirmPlannedTransaction, deleteTransaction, formatNumber, formatRate, rateHasSecondCurrency } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { ledgerStore } from "@/lib/repositories"
import { cn } from "@/lib/utils"

/**
 * A movement's detail in a side panel (Mobbin: Revolut web's transaction panel), drawn like the iOS
 * receipt: the kind icon, the amount in its color, description and status, the details as
 * KWValueRows on grouped cards, and the actions as KWActionButtons (Confirm, Edit, Delete).
 */
export function MovementDetail() {
  const t = useT()
  const ct = (key: string, ...args: (string | number)[]) => t.in("createtransaction", key, ...args)
  const ledger = useLedger()
  const display = useTransactionDisplay(ledger)
  const { detailId, showDetail, openEditor } = useAppActions()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const transaction = ledger?.transactions.find((candidate) => candidate.id === detailId)
  const open = detailId !== undefined && transaction !== undefined

  async function remove() {
    if (!transaction) return
    try {
      await deleteTransaction(ledgerStore, transaction.id)
      setConfirmingDelete(false)
      showDetail(undefined)
    } catch {
      toast.add({ title: t.in("transactions", "We couldn't save the change. Try again."), type: "error" })
    }
  }

  async function confirm() {
    if (!transaction) return
    try {
      await confirmPlannedTransaction(ledgerStore, transaction.id)
    } catch {
      toast.add({ title: t.in("home", "We couldn't confirm it. Try again."), type: "error" })
    }
  }

  const style = transaction && display ? display.style(transaction) : "expense"
  const rate = transaction?.exchangeRate
  const bank = transaction ? bankRate(transaction) : undefined
  const secondary = transaction && display ? display.secondaryAmount(transaction) : undefined

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && showDetail(undefined)}>
        <SheetContent side="right" showCloseButton={false} className="w-full gap-0 overflow-y-auto border-divider bg-background sm:max-w-md">
          {transaction && display ? (
            <>
              <div className="flex items-center justify-between px-5 pt-5">
                <KWCircleButton icon="close" label={t.in("designsystem", "Close")} shortcut="Esc" onClick={() => showDetail(undefined)} />
                {transaction.status === "planned" ? <StatusPill confirmed={false}>{ct("Draft")}</StatusPill> : null}
              </div>
              <header className="flex flex-col items-center gap-1 px-5 pt-4 pb-6 text-center">
                <KWTransactionIcon style={style} className="mb-2 size-14" />
                <SheetTitle className={cn("max-w-full truncate type-amount-lg tabular-nums", transactionAmountClass(style))}>{display.amount(transaction)}</SheetTitle>
                <SheetDescription className="max-w-full truncate type-body font-semibold text-foreground">{transaction.description}</SheetDescription>
                {secondary ? <p className="type-caption text-muted-foreground tabular-nums">{secondary}</p> : null}
              </header>

              <div className="flex justify-center gap-6 px-5 pb-6">
                {transaction.status === "planned" ? <KWActionButton icon="check" title={t.in("transactions", "Confirm")} variant="prominent" onClick={() => void confirm()} /> : null}
                <KWActionButton
                  icon="pencil"
                  title={t.in("web", "Edit")}
                  variant={transaction.status === "planned" ? "neutral" : "prominent"}
                  onClick={() => {
                    showDetail(undefined)
                    openEditor({ mode: "edit", transaction })
                  }}
                />
                <KWActionButton icon="trash" title={t.in("transactions", "Delete")} onClick={() => setConfirmingDelete(true)} />
              </div>

              <div className="flex flex-col gap-4 px-5 pb-6">
                <KWGroupedCard>
                  <KWValueRow label={ct("Date")} value={new Date(transaction.date).toLocaleString(t.locale, { dateStyle: "medium", timeStyle: "short" })} />
                  {transaction.kind === "transfer" ? (
                    <>
                      <KWValueRow label={ct("From")} value={display.methodName(transaction)} />
                      <KWValueRow label={ct("To")} value={display.accountName(transaction.destinationAccountId)} />
                    </>
                  ) : (
                    <>
                      <KWValueRow label={ct("Category")} value={display.categoryName(transaction) ?? "—"} />
                      <KWValueRow label={ct("Paid with")} value={display.methodName(transaction)} />
                    </>
                  )}
                  <KWValueRow
                    label={t.in("web", "Status")}
                    value={<StatusPill confirmed={transaction.status === "confirmed"}>{transaction.status === "planned" ? t.in("web", "Planned") : ct("Confirmed")}</StatusPill>}
                  />
                </KWGroupedCard>
                {rate && rateHasSecondCurrency(rate) ? (
                  <KWGroupedCard>
                    <KWValueRow label={ct("Rate used")} value={<span className="tabular-nums">{formatRate(rate)}</span>} />
                    {bank ? <KWValueRow label={ct("Bank rate")} value={<span className="tabular-nums">{formatNumber(bank, 4)}</span>} /> : null}
                  </KWGroupedCard>
                ) : null}
                {transaction.note ? (
                  <KWGroupedCard>
                    <div className="flex flex-col gap-1 px-4 py-3">
                      <span className="type-caption text-muted-foreground">{ct("Note")}</span>
                      <p className="type-body break-words text-foreground">{transaction.note}</p>
                    </div>
                  </KWGroupedCard>
                ) : null}
                <KWGroupedCard>
                  <KWValueRow label={ct("Reference")} value={<span className="font-mono type-caption text-muted-foreground">{transaction.id.slice(0, 8).toUpperCase()}</span>} />
                </KWGroupedCard>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent className="gap-5 rounded-[var(--radius-surface)] bg-background p-5 ring-1 ring-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="type-heading text-foreground">{t.in("transactions", "Delete this transaction?")}</AlertDialogTitle>
            <AlertDialogDescription className="type-body text-muted-foreground">{t.in("transactions", "Balances update as if it never happened.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <KWButton variant="plain" onClick={() => setConfirmingDelete(false)}>
              {t.in("web", "Cancel")}
            </KWButton>
            <KWButton variant="destructive" icon="trash" onClick={() => void remove()}>
              {t.in("transactions", "Delete")}
            </KWButton>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
