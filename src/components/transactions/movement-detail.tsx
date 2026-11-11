"use client"

import { transactionAmountClass } from "@/components/kw/design-styles"
import { useState } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { SplitDialog } from "@/components/debts/split-dialog"
import { TagChip } from "@/components/kw/tag-editor"
import {
  KWActionButton,
  KWButton,
  KWCircleButton,
  KWGroupedCard,
  KWTransactionIcon,
  KWValueRow,
} from "@/components/kw/design"
import { StatusPill } from "@/components/movement-editor/flow-parts"
import { ReceiptDialog } from "@/components/receipt/receipt-dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useLedger, useTransactionDisplay } from "@/hooks/use-ledger"
import {
  bankRate,
  confirmPlannedTransaction,
  deleteTransaction,
  rateHasSecondCurrency,
} from "@/lib/domain"
import {
  formatNumber,
  formatRate,
} from "@/lib/domain/format"
import { useT, type Translator } from "@/lib/i18n"
import type { TransactionDisplay } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"
import type { RecurringRule, Transaction } from "@/lib/schema"
import { frequencyText } from "@/components/recurring/recurring-format"
import { cn } from "@/lib/utils"

import { movementReference } from "./row-menu-model"
import { useShowTag } from "./show-tag"

function kindText(t: Translator, transaction: Transaction): string {
  return t.in("transactions", `kind.${transaction.kind}`)
}

type Ct = (key: string, ...args: (string | number)[]) => string

/** The kind-specific rows: where a transfer went, or what an expense or income was for. */
function RouteRows({
  ct,
  transaction,
  display,
}: {
  ct: Ct
  transaction: Transaction
  display: TransactionDisplay
}) {
  if (transaction.kind === "transfer") {
    return (
      <>
        <KWValueRow
          label={ct("From")}
          value={display.methodName(transaction)}
        />
        <KWValueRow
          label={ct("To")}
          value={display.accountName(transaction.destinationAccountId)}
        />
      </>
    )
  }
  return (
    <>
      <KWValueRow
        label={ct("Category")}
        value={display.categoryName(transaction) ?? "—"}
      />
      <KWValueRow
        label={transaction.kind === "income" ? ct("Into") : ct("Paid with")}
        value={display.methodName(transaction)}
      />
    </>
  )
}

/** The rate card, only for a movement that involved the second currency. */
function RateCard({ ct, transaction }: { ct: Ct; transaction: Transaction }) {
  const rate = transaction.exchangeRate
  if (!rate || !rateHasSecondCurrency(rate)) return null
  const bank = bankRate(transaction)
  return (
    <KWGroupedCard>
      <KWValueRow
        label={ct("Rate used")}
        value={<span className="tabular-nums">{formatRate(rate)}</span>}
      />
      {bank ? (
        <KWValueRow
          label={ct("Bank rate")}
          value={<span className="tabular-nums">{formatNumber(bank, 4)}</span>}
        />
      ) : null}
    </KWGroupedCard>
  )
}

/** The movement's tags as "#chips"; one narrows Transactions to it. */
function DetailTags({ t, tags }: { t: Translator; tags: readonly string[] }) {
  const showTag = useShowTag()
  return (
    <KWGroupedCard>
      <div className="flex flex-col gap-2 px-4 py-3">
        <span className="type-caption text-muted-foreground">
          {t.in("createtransaction", "Tags")}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <TagChip
              key={tag}
              tag={tag}
              onClick={() => showTag(tag)}
            />
          ))}
        </div>
      </div>
    </KWGroupedCard>
  )
}

/** The details as KWValueRows on grouped cards: when, where, status, rate, note and reference. */
function DetailCards({
  t,
  ct,
  transaction,
  display,
  rule,
  onOpenRule,
}: {
  t: Translator
  ct: Ct
  transaction: Transaction
  display: TransactionDisplay
  rule: RecurringRule | undefined
  onOpenRule: () => void
}) {
  return (
    <div className="flex flex-col gap-4 px-(--gutter) pb-6">
      <KWGroupedCard>
        <KWValueRow
          label={ct("Date")}
          value={new Date(transaction.date).toLocaleString(t.locale, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        />
        <RouteRows ct={ct} transaction={transaction} display={display} />
        <KWValueRow label={t.in("transactions", "Type")} value={kindText(t, transaction)} />
        <KWValueRow
          label={t.in("transactions", "Status")}
          value={
            <StatusPill confirmed={transaction.status === "confirmed"}>
              {transaction.status === "planned"
                ? ct("Draft")
                : ct("Confirmed")}
            </StatusPill>
          }
        />
        {rule ? (
          <KWValueRow
            label={t.in("transactions", "Repeats")}
            value={frequencyText(t, rule.frequency, rule.interval)}
            onClick={onOpenRule}
          />
        ) : null}
      </KWGroupedCard>
      <RateCard ct={ct} transaction={transaction} />
      {transaction.note ? (
        <KWGroupedCard>
          <div className="flex flex-col gap-1 px-4 py-3">
            <span className="type-caption text-muted-foreground">
              {ct("Note")}
            </span>
            <p className="type-body break-words text-foreground">
              {transaction.note}
            </p>
          </div>
        </KWGroupedCard>
      ) : null}
      {transaction.tags?.length ? <DetailTags t={t} tags={transaction.tags} /> : null}
      <KWGroupedCard>
        <KWValueRow
          label={ct("Reference")}
          value={
            <span className="font-mono type-caption text-muted-foreground">
              {movementReference(transaction.id)}
            </span>
          }
        />
      </KWGroupedCard>
    </div>
  )
}

/** The receipt itself: close and draft badge, the amount header, the actions and the detail cards. */
function DetailBody({
  t,
  transaction,
  display,
  onClose,
  onConfirm,
  onEdit,
  onDelete,
  onReceipt,
  onSplit,
  rule,
  onOpenRule,
}: {
  t: Translator
  transaction: Transaction
  display: TransactionDisplay
  onClose: () => void
  onConfirm: () => void
  onEdit: () => void
  onDelete: () => void
  onReceipt: () => void
  /** Expenses only: share it with others, who then owe their part. */
  onSplit: () => void
  /** The recurring rule that produced it, while the rule exists. */
  rule: RecurringRule | undefined
  onOpenRule: () => void
}) {
  const ct: Ct = (key, ...args) => t.in("createtransaction", key, ...args)
  const style = display.style(transaction)
  const secondary = display.secondaryAmount(transaction)
  const planned = transaction.status === "planned"
  return (
    <>
      <div className="flex items-center justify-between px-(--gutter) pt-5">
        <KWCircleButton
          icon="close"
          label={t.in("designsystem", "Close")}
          shortcut="Esc"
          onClick={onClose}
        />
        {planned ? (
          <StatusPill confirmed={false}>{ct("Draft")}</StatusPill>
        ) : null}
      </div>
      <header className="flex flex-col items-center gap-1 px-(--gutter) pt-4 pb-6 text-center">
        <KWTransactionIcon style={style} className="mb-2 size-14" />
        <SheetTitle
          className={cn(
            "max-w-full truncate type-amount-lg tabular-nums",
            transactionAmountClass(style)
          )}
        >
          {display.amount(transaction)}
        </SheetTitle>
        <SheetDescription className="max-w-full truncate type-body font-semibold text-foreground">
          {transaction.description}
        </SheetDescription>
        {secondary ? (
          <p className="type-caption text-muted-foreground tabular-nums">
            {secondary}
          </p>
        ) : null}
      </header>

      <div className="grid auto-cols-fr grid-flow-col justify-items-center gap-1 px-(--gutter) pb-6">
        {planned ? (
          <KWActionButton
            icon="check"
            title={t.in("transactions", "Confirm")}
            variant="prominent"
            onClick={onConfirm}
          />
        ) : null}
        <KWActionButton
          icon="pencil"
          title={t.in("transactions", "Edit")}
          variant={planned ? "neutral" : "prominent"}
          onClick={onEdit}
        />
        {transaction.kind === "expense" ? (
          <KWActionButton
            icon="person"
            title={t.in("transactions", "Split")}
            onClick={onSplit}
          />
        ) : null}
        <KWActionButton
          icon="share"
          title={t.in("transactions", "Receipt")}
          onClick={onReceipt}
        />
        <KWActionButton
          icon="trash"
          title={t.in("transactions", "Delete")}
          onClick={onDelete}
        />
      </div>

      <DetailCards
        t={t}
        ct={ct}
        transaction={transaction}
        display={display}
        rule={rule}
        onOpenRule={onOpenRule}
      />
    </>
  )
}

export function DeleteDialog({
  t,
  open,
  onOpenChange,
  onDelete,
}: {
  t: Translator
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-5 rounded-[var(--radius-surface)] bg-background p-5 ring-1 ring-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="type-heading text-foreground">
            {t.in("transactions", "Delete this transaction?")}
          </AlertDialogTitle>
          <AlertDialogDescription className="type-body text-muted-foreground">
            {t.in("transactions", "Balances update as if it never happened.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <KWButton variant="plain" onClick={() => onOpenChange(false)}>
            {t.in("web", "Cancel")}
          </KWButton>
          <KWButton variant="destructive" icon="trash" onClick={onDelete}>
            {t.in("transactions", "Delete")}
          </KWButton>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * A movement's detail in a side panel (Mobbin: Revolut web's transaction panel), drawn like the iOS
 * receipt: the kind icon, the amount in its color, description and status, the details as
 * KWValueRows on grouped cards, and the actions as KWActionButtons (Confirm, Edit, Delete).
 */
export function MovementDetail() {
  const t = useT()
  const ledger = useLedger()
  const display = useTransactionDisplay(ledger)
  const { detailId, showDetail, openEditor, openRuleEditor } = useAppActions()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [showingReceipt, setShowingReceipt] = useState(false)
  const [splitting, setSplitting] = useState<Transaction>()
  const transaction = ledger?.transactions.find(
    (candidate) => candidate.id === detailId
  )
  const open = detailId !== undefined && transaction !== undefined
  const rule = transaction?.recurringId
    ? ledger?.recurringRules.find(
        (candidate) => candidate.id === transaction.recurringId
      )
    : undefined

  async function remove() {
    if (!transaction) return
    try {
      await deleteTransaction(ledgerStore, transaction.id)
      setConfirmingDelete(false)
      showDetail(undefined)
    } catch {
      toast.add({
        title: t.in("transactions", "We couldn't save the change. Try again."),
        type: "error",
      })
    }
  }

  async function confirm() {
    if (!transaction) return
    try {
      await confirmPlannedTransaction(ledgerStore, transaction.id)
    } catch {
      toast.add({
        title: t.in("home", "We couldn't confirm it. Try again."),
        type: "error",
      })
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => !next && showDetail(undefined)}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full gap-0 overflow-y-auto border-divider bg-background sm:max-w-md"
        >
          {transaction && display ? (
            <DetailBody
              t={t}
              transaction={transaction}
              display={display}
              onClose={() => showDetail(undefined)}
              onConfirm={() => void confirm()}
              onEdit={() => {
                showDetail(undefined)
                openEditor({ mode: "edit", transaction })
              }}
              onDelete={() => setConfirmingDelete(true)}
              onReceipt={() => setShowingReceipt(true)}
              onSplit={() => {
                showDetail(undefined)
                setSplitting(transaction)
              }}
              rule={rule}
              onOpenRule={() => {
                if (!rule) return
                showDetail(undefined)
                openRuleEditor({ mode: "edit", ruleId: rule.id })
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
      {transaction ? (
        <ReceiptDialog
          transaction={transaction}
          open={showingReceipt && open}
          onOpenChange={setShowingReceipt}
        />
      ) : null}
      {splitting ? (
        <SplitDialog
          key={splitting.id}
          t={t}
          transaction={splitting}
          onClose={() => setSplitting(undefined)}
        />
      ) : null}
      <DeleteDialog
        t={t}
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        onDelete={() => void remove()}
      />
    </>
  )
}
