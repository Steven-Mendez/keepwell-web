"use client"

import { ArrowLeftRightIcon, CheckIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { CategoryBadge, DetailGroup, DetailRow, IconBadge } from "@/components/kw/primitives"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useLedger, useTransactionDisplay } from "@/hooks/use-ledger"
import { bankRate, confirmPlannedTransaction, deleteTransaction, formatNumber, formatRate, rateHasSecondCurrency } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { ledgerStore } from "@/lib/repositories"
import { cn } from "@/lib/utils"

/**
 * A movement's detail in a side panel (Mobbin: Revolut web's transaction panel): what, when, how it
 * was paid, both currencies and the rate it keeps, with confirm, edit and delete.
 */
export function MovementDetail() {
  const t = useT()
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

  const style = transaction && display ? display.style(transaction) : undefined
  const rate = transaction?.exchangeRate
  const bank = transaction ? bankRate(transaction) : undefined

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && showDetail(undefined)}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
          {transaction && display ? (
            <>
              <SheetHeader className="gap-3 border-b border-divider p-5">
                <div className="flex items-center gap-3">
                  {transaction.kind === "transfer" ? <IconBadge icon={ArrowLeftRightIcon} tone="accent" /> : <CategoryBadge category={display.category(transaction)} size="lg" />}
                  {transaction.status === "planned" ? <Badge className="bg-pending-tint text-pending">{t.in("createtransaction", "Draft")}</Badge> : null}
                </div>
                <SheetTitle className={cn("text-amount-lg", style === "income" && "text-positive", style === "planned" && "text-pending")}>{display.amount(transaction)}</SheetTitle>
                <SheetDescription className="text-body text-foreground">{transaction.description}</SheetDescription>
                {display.secondaryAmount(transaction) ? <p className="text-caption text-muted-foreground tabular-nums">{display.secondaryAmount(transaction)}</p> : null}
              </SheetHeader>
              <div className="flex flex-col gap-4 p-5">
                <DetailGroup>
                  <DetailRow label={t.in("createtransaction", "Date")}>
                    {new Date(transaction.date).toLocaleString(t.locale, { dateStyle: "full", timeStyle: "short" })}
                  </DetailRow>
                  {transaction.kind === "transfer" ? (
                    <>
                      <DetailRow label={t.in("createtransaction", "From")}>{display.methodName(transaction)}</DetailRow>
                      <DetailRow label={t.in("createtransaction", "To")}>{display.accountName(transaction.destinationAccountId)}</DetailRow>
                    </>
                  ) : (
                    <>
                      <DetailRow label={t.in("createtransaction", "Category")}>{display.categoryName(transaction) ?? "—"}</DetailRow>
                      <DetailRow label={t.in("createtransaction", "Paid with")}>{display.methodName(transaction)}</DetailRow>
                    </>
                  )}
                  <DetailRow label={t.in("web", "Status")}>
                    {transaction.status === "planned" ? t.in("web", "Planned") : t.in("createtransaction", "Confirmed")}
                  </DetailRow>
                </DetailGroup>
                {rate && rateHasSecondCurrency(rate) ? (
                  <DetailGroup>
                    <DetailRow label={t.in("createtransaction", "Rate used")}>{formatRate(rate)}</DetailRow>
                    {bank ? <DetailRow label={t.in("createtransaction", "Bank rate")}>{formatNumber(bank, 4)}</DetailRow> : null}
                  </DetailGroup>
                ) : null}
                {transaction.note ? (
                  <DetailGroup>
                    <DetailRow label={t.in("createtransaction", "Note")}>{transaction.note}</DetailRow>
                  </DetailGroup>
                ) : null}
                <DetailGroup>
                  <DetailRow label={t.in("createtransaction", "Reference")}>
                    <span className="font-mono text-caption text-muted-foreground">{transaction.id.slice(0, 8).toUpperCase()}</span>
                  </DetailRow>
                </DetailGroup>
                <div className="flex flex-wrap gap-2">
                  {transaction.status === "planned" ? (
                    <Button onClick={() => void confirm()}>
                      <CheckIcon data-icon="inline-start" />
                      {t.in("transactions", "Confirm")}
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      showDetail(undefined)
                      openEditor({ mode: "edit", transaction })
                    }}
                  >
                    <PencilIcon data-icon="inline-start" />
                    {t.in("web", "Edit")}
                  </Button>
                  <Button variant="destructive" onClick={() => setConfirmingDelete(true)}>
                    <Trash2Icon data-icon="inline-start" />
                    {t.in("transactions", "Delete")}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.in("transactions", "Delete this transaction?")}</AlertDialogTitle>
            <AlertDialogDescription>{t.in("transactions", "Balances update as if it never happened.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.in("web", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void remove()}>
              {t.in("transactions", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
