"use client"

import type { Transaction } from "@/lib/schema"
import type { TransactionDisplay } from "@/lib/presentation/display"
import { cn } from "@/lib/utils"

import { KWTransactionIcon, transactionAmountClass } from "./design"

/**
 * KWTransactionRow: the movement's kind icon (not its category: iOS reads direction first),
 * description, subtitle and both amounts in the kind's color. Opens the movement on click.
 */
export function TransactionRow({
  transaction,
  display,
  onSelect,
  isSelected,
  trailing,
  dateLabel,
}: {
  transaction: Transaction
  display: TransactionDisplay
  onSelect?: (transaction: Transaction) => void
  isSelected?: boolean
  trailing?: React.ReactNode
  dateLabel?: string
}) {
  const style = display.style(transaction)
  const secondary = display.secondaryAmount(transaction)
  const content = (
    <>
      <KWTransactionIcon style={style} />
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate type-label text-foreground">{transaction.description}</span>
        <span className="truncate type-caption text-muted-foreground">
          {[display.subtitle(transaction), dateLabel].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className={cn("type-label tabular-nums", transactionAmountClass(style))}>{display.amount(transaction)}</span>
        {secondary ? <span className="type-caption-sm text-muted-foreground tabular-nums">{secondary}</span> : null}
      </span>
    </>
  )
  const className = cn(
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors outline-none",
    onSelect && "cursor-pointer hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/60",
    isSelected && "bg-accent",
  )
  const row = onSelect ? (
    <button type="button" className={className} onClick={() => onSelect(transaction)} aria-current={isSelected ? "true" : undefined}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
  // An action of its own (Confirm) sits beside the row, never inside its button.
  if (!trailing) return row
  return (
    <div className="flex items-center gap-2 pr-2">
      <div className="min-w-0 flex-1">{row}</div>
      {trailing}
    </div>
  )
}
