"use client"

import type { Transaction } from "@/lib/schema"
import type { TransactionDisplay } from "@/lib/presentation/display"
import { cn } from "@/lib/utils"

import { KWTransactionIcon, transactionAmountClass } from "./design"
import { ListItem } from "./motion"
import { CategoryBadge } from "./primitives"

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
  columns = false,
  className: extraClassName,
}: {
  transaction: Transaction
  display: TransactionDisplay
  onSelect?: (transaction: Transaction) => void
  isSelected?: boolean
  trailing?: React.ReactNode
  dateLabel?: string
  /**
   * Desktop table layout (Mobbin: Monarch, Copilot, Midday transaction lists): from `lg` the
   * category and the account get columns of their own instead of sharing the subtitle.
   */
  columns?: boolean
  className?: string | undefined
}) {
  const style = display.style(transaction)
  const secondary = display.secondaryAmount(transaction)
  const content = (
    <>
      <KWTransactionIcon style={style} />
      <span className="flex min-w-0 flex-1 flex-col text-left">
        {/* KWTransactionRow: title 15/600, subtitle caption muted, amount 15/700, the second amount faint. */}
        <span className="truncate type-body font-semibold text-foreground">
          {transaction.description}
        </span>
        <span
          className={cn(
            "truncate type-caption text-muted-foreground",
            columns && "lg:hidden"
          )}
        >
          {[display.subtitle(transaction), dateLabel]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {columns && transaction.note ? (
          <span className="hidden truncate type-caption text-text-faint lg:block">
            {transaction.note}
          </span>
        ) : null}
      </span>
      {columns ? (
        <>
          <span className="hidden w-44 shrink-0 items-center gap-2 lg:flex">
            {transaction.kind === "transfer" ? (
              <span className="truncate type-caption text-text-secondary">
                {display.subtitle(transaction)}
              </span>
            ) : (
              <>
                <CategoryBadge
                  category={display.category(transaction)}
                  size="xs"
                />
                <span className="truncate type-caption text-text-secondary">
                  {display.categoryName(transaction)}
                </span>
              </>
            )}
          </span>
          <span className="hidden w-44 shrink-0 truncate type-caption text-muted-foreground xl:block">
            {transaction.kind === "transfer"
              ? ""
              : display.methodName(transaction)}
          </span>
        </>
      ) : null}
      <span
        className={cn("flex shrink-0 flex-col items-end", columns && "lg:w-36")}
      >
        <span
          className={cn(
            "type-body font-bold tabular-nums",
            transactionAmountClass(style)
          )}
        >
          {display.amount(transaction)}
        </span>
        {secondary ? (
          <span className="type-caption-sm text-text-faint tabular-nums">
            {secondary}
          </span>
        ) : null}
      </span>
    </>
  )
  const className = cn(
    // A full-width row of a grouped card (KWGroupedCard + dividers), not a floating pill.
    "flex w-full items-center gap-3 px-4 py-3 outline-none",
    onSelect &&
      "cursor-pointer press-row hover:bg-secondary/50 focus-visible:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
    isSelected && "bg-secondary/80 hover:bg-secondary/80"
  )
  const row = onSelect ? (
    <button
      type="button"
      data-movement-row=""
      className={className}
      onClick={() => onSelect(transaction)}
      aria-current={isSelected ? "true" : undefined}
    >
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
  // An action of its own (Confirm) sits beside the row, never inside its button.
  if (!trailing) return <ListItem className={extraClassName}>{row}</ListItem>
  return (
    <ListItem className={extraClassName}>
      <div className="flex items-center gap-2 pr-4">
        <div className="min-w-0 flex-1">{row}</div>
        {trailing}
      </div>
    </ListItem>
  )
}
