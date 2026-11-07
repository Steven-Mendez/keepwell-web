"use client"

import type { RefObject } from "react"

import { KWSectionHeader } from "@/components/kw/design"
import { AnimatedNumber } from "@/components/kw/animated-number"
import { AnimatedList, ListItem } from "@/components/kw/motion"
import { TransactionRow } from "@/components/kw/transaction-row"
import { formatMoney } from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"
import { dayLabel, type TransactionDisplay } from "@/lib/presentation/display"
import type { Transaction } from "@/lib/schema"
import { cn } from "@/lib/utils"

import { dayNet, type MovementTotals } from "./movement-totals"

function TotalsStrip({
  t,
  totals,
  principal,
  count,
}: {
  t: Translator
  totals: MovementTotals
  principal: string
  count: number
}) {
  const net = totals.moneyIn.minus(totals.moneyOut)
  const cells: { label: string; value: string; tone?: string }[] = [
    { label: t.in("web", "Movements"), value: String(count) },
    {
      label: t.in("web", "Money in"),
      value: formatMoney({ amount: totals.moneyIn, currency: principal }),
      tone: "text-positive",
    },
    {
      label: t.in("web", "Money out"),
      value: formatMoney({ amount: totals.moneyOut, currency: principal }),
      tone: "text-negative",
    },
    {
      label: t.in("web", "Net"),
      value: formatMoney(
        { amount: net, currency: principal },
        { sign: "always" }
      ),
    },
  ]
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-divider sm:grid-cols-4">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="flex flex-col gap-0.5 bg-card px-4 py-3"
        >
          <dt className="type-caption text-muted-foreground">{cell.label}</dt>
          <dd>
            <AnimatedNumber
              value={cell.value}
              className={cn("type-amount-sm", cell.tone)}
            />
          </dd>
        </div>
      ))}
    </dl>
  )
}

function ColumnHeader({ t }: { t: Translator }) {
  return (
    <div
      className="mb-4 hidden items-center gap-3 px-5 type-caption text-text-faint lg:flex"
      aria-hidden
    >
      <span className="w-10 shrink-0" />
      <span className="flex-1">{t.in("web", "column.description")}</span>
      <span className="w-44 shrink-0">{t.in("web", "column.category")}</span>
      <span className="hidden w-44 shrink-0 xl:block">
        {t.in("web", "column.account")}
      </span>
      <span className="w-36 shrink-0 text-right">
        {t.in("web", "column.amount")}
      </span>
    </div>
  )
}

/** One day: its pinned header with the day's net, and its movements on a card. */
function DayGroup({
  t,
  transactions,
  principal,
  display,
  detailId,
  onSelect,
}: {
  t: Translator
  transactions: readonly Transaction[]
  principal: string
  display: TransactionDisplay
  detailId: string | undefined
  onSelect: (id: string) => void
}) {
  const net = dayNet(transactions, principal)
  return (
    <section className="flex flex-col gap-2 pb-4">
      {/* Day headers stay pinned under the top bar while their movements scroll (Monarch). */}
      <div className="sticky top-16 z-[5] -mx-1 flex items-baseline justify-between gap-2 bg-background/85 px-2 py-1.5 backdrop-blur-xl">
        <KWSectionHeader
          title={dayLabel(t, new Date(transactions[0]!.date))}
          className="px-0"
        />
        {net && !net.isZero() ? (
          <span
            className={cn(
              "type-caption font-semibold tabular-nums",
              net.gt(0) ? "text-positive" : "text-text-secondary"
            )}
          >
            {formatMoney(
              { amount: net, currency: principal },
              { sign: "always" }
            )}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card">
        <AnimatedList>
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              columns
              transaction={transaction}
              display={display}
              onSelect={(tx) => onSelect(tx.id)}
              isSelected={detailId === transaction.id}
            />
          ))}
        </AnimatedList>
      </div>
    </section>
  )
}

/** What the filtered list adds up to, then the movements grouped by day under column headers. */
export function MovementList({
  t,
  list,
  viewKey,
  groups,
  totals,
  principal,
  count,
  display,
  detailId,
  onSelect,
}: {
  t: Translator
  list: RefObject<HTMLDivElement | null>
  /** Changes with the filter, account or search, so a new view swaps in as a whole. */
  viewKey: string
  groups: readonly [string, Transaction[]][]
  totals: MovementTotals
  principal: string
  count: number
  display: TransactionDisplay
  detailId: string | undefined
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Mobbin (Copilot, Mercury): what the filtered list adds up to, above the list. */}
      <TotalsStrip t={t} totals={totals} principal={principal} count={count} />
      {/* A new filter, account or search swaps the whole list in one quick fade; within one view,
          movements logged or deleted grow in and collapse out row by row. */}
      <div ref={list} key={viewKey} className="flex animate-fade-in flex-col">
        {/* No gap: each day carries its own bottom space, so a day collapsing takes its gap with it. */}
        <ColumnHeader t={t} />
        <AnimatedList>
          {groups.map(([key, transactions]) => (
            <ListItem key={key}>
              <DayGroup
                t={t}
                transactions={transactions}
                principal={principal}
                display={display}
                detailId={detailId}
                onSelect={onSelect}
              />
            </ListItem>
          ))}
        </AnimatedList>
      </div>
    </div>
  )
}
