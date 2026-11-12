"use client"

import { transactionAmountClass } from "@/components/kw/design-styles"
import type { Transaction } from "@/lib/schema"
import type {
  TransactionDisplay,
  TransactionStyle,
} from "@/lib/presentation/display"
import { useT } from "@/lib/i18n"
import { brandFor } from "@/lib/presentation/brands"
import { categoryColor } from "@/lib/presentation/display"
import { cn } from "@/lib/utils"

import { BrandMark } from "./brand-mark"
import { KWTransactionIcon } from "./design"
import { ListItem } from "./motion"
import { CategoryBadge } from "./primitives"
import { tagLine } from "./tag-editor"

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
  brandLogo = false,
  wrap,
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
  /** The brand's logo instead of the kind icon when the description names a known brand (the movement list). */
  brandLogo?: boolean
  /** Wraps the row where it stands, for a menu around it. */
  wrap?: (row: React.ReactNode) => React.ReactNode
  className?: string | undefined
}) {
  const style = display.style(transaction)
  const brand = brandLogo && transaction.kind !== "transfer" ? brandFor(transaction.description) : undefined
  const content = (
    <>
      {brand ? (
        <BrandMark brand={brand} color={categoryColor(display.category(transaction))} />
      ) : (
        <KWTransactionIcon style={style} />
      )}
      <TransactionText
        transaction={transaction}
        display={display}
        dateLabel={dateLabel}
        columns={columns}
      />
      {columns ? (
        <TransactionColumns transaction={transaction} display={display} />
      ) : null}
      <TransactionAmounts
        transaction={transaction}
        display={display}
        style={style}
        columns={columns}
      />
    </>
  )
  const row = (
    <RowShell
      transaction={transaction}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      {content}
    </RowShell>
  )
  // An action of its own (Confirm) sits beside the row, never inside its button.
  if (!trailing) return <ListItem className={extraClassName}>{wrap ? wrap(row) : row}</ListItem>
  return (
    <ListItem className={extraClassName}>
      <div className="flex items-center gap-2 pr-4">
        <div className="min-w-0 flex-1">{row}</div>
        {trailing}
      </div>
    </ListItem>
  )
}

type RowParts = { transaction: Transaction; display: TransactionDisplay }



/** Description, subtitle and (in the desktop table) the note. */
function TransactionText({
  transaction,
  display,
  dateLabel,
  columns,
}: RowParts & { dateLabel: string | undefined; columns: boolean }) {
  const t = useT()
  // Movements an assistant recorded say so, confirmed or not (`source = mcp`).
  const recordedBy = transaction.source === "mcp" ? t.in("sharedpresentation", "Recorded by Claude") : undefined
  return (
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
        {[recordedBy, display.subtitle(transaction), dateLabel, tagLine(transaction.tags)].filter(Boolean).join(" · ")}
      </span>
      {columns && (transaction.note || transaction.tags?.length) ? (
        <span className="hidden truncate type-caption text-text-faint lg:block">
          {[transaction.note, tagLine(transaction.tags)].filter(Boolean).join(" · ")}
        </span>
      ) : null}
    </span>
  )
}

/** The desktop table's category and account columns; a transfer shows its route instead of a category. */
function TransactionColumns({ transaction, display }: RowParts) {
  const isTransfer = transaction.kind === "transfer"
  return (
    <>
      <span className="hidden w-44 shrink-0 items-center gap-2 lg:flex">
        {isTransfer ? (
          <span className="truncate type-caption text-text-secondary">
            {display.subtitle(transaction)}
          </span>
        ) : (
          <>
            <CategoryBadge category={display.category(transaction)} size="xs" />
            <span className="truncate type-caption text-text-secondary">
              {display.categoryName(transaction)}
            </span>
          </>
        )}
      </span>
      <span className="hidden w-44 shrink-0 truncate type-caption text-muted-foreground xl:block">
        {isTransfer ? "" : display.methodName(transaction)}
      </span>
    </>
  )
}

/** Both amounts in the kind's color, the second one faint. */
function TransactionAmounts({
  transaction,
  display,
  style,
  columns,
}: RowParts & {
  style: TransactionStyle
  columns: boolean
}) {
  const secondary = display.secondaryAmount(transaction)
  return (
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
  )
}

/** A button when the row opens the movement, a plain row otherwise. */
function RowShell({
  transaction,
  onSelect,
  isSelected,
  children,
}: {
  transaction: Transaction
  onSelect: ((transaction: Transaction) => void) | undefined
  isSelected: boolean | undefined
  children: React.ReactNode
}) {
  const className = cn(
    // A full-width row of a grouped card (KWGroupedCard + dividers), not a floating pill.
    "flex w-full items-center gap-3 px-4 py-3 outline-none",
    onSelect &&
      "cursor-pointer press-row hover:bg-secondary/50 focus-visible:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
    isSelected && "bg-secondary/80 hover:bg-secondary/80"
  )
  if (!onSelect) return <div className={className}>{children}</div>
  return (
    <button
      type="button"
      data-movement-row=""
      className={className}
      onClick={() => onSelect(transaction)}
      aria-current={isSelected ? "true" : undefined}
    >
      {children}
    </button>
  )
}
