"use client"

import Link from "next/link"

import { KWSection } from "@/components/kw/design"
import { BALANCE_MASK } from "@/hooks/use-hidden-balances"
import {
  debtTotals,
  formatAmount,
  orderedLoans,
  type Ledger,
  type Money,
} from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/**
 * iOS HomeDebtsCard: always on Home, so debts have a way in before the first one. It shows the next
 * loan installment and what the person owes and is owed, one amount per currency.
 */
export function DebtsSection({
  t,
  ledger,
  now,
  hidden,
}: {
  t: Translator
  ledger: Ledger
  now: Date
  hidden: boolean
}) {
  const totals = debtTotals(ledger.loans, ledger.personalDebts)
  const next = orderedLoans(ledger.loans, now).find((progress) => progress.next)
  const text = (lines: readonly Money[]) =>
    lines.length === 0
      ? undefined
      : lines
          .map((line) =>
            hidden ? BALANCE_MASK : formatAmount(line.amount, line.currency)
          )
          .join(" · ")
  const owe = text(totals.youOwe)
  const owed = text(totals.owedToYou)
  return (
    <KWSection
      title={t.in("home", "Debts")}
      action={
        <Link
          href="/debts"
          className="type-label text-link transition-colors outline-none hover:text-link-hover focus-visible:underline"
        >
          {t.in("home", "See all")}
        </Link>
      }
    >
      <Link
        href="/debts"
        className="flex flex-col gap-3 rounded-2xl bg-card px-4 py-3 press-row outline-none hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {owe === undefined && owed === undefined ? (
          <span className="type-body text-muted-foreground">
            {t.in("home", "No debts yet")}
          </span>
        ) : (
          <>
            {next?.next ? (
              <span
                className={cn(
                  "type-caption tabular-nums",
                  next.isNextOverdue ? "text-pending" : "text-text-secondary"
                )}
              >
                {t.in(
                  "home",
                  "%@ · %lld/%lld on %@ · %@",
                  next.loan.name,
                  next.next.number,
                  next.loan.installmentCount,
                  next.next.dueDate.toLocaleDateString(t.locale, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }),
                  hidden
                    ? BALANCE_MASK
                    : formatAmount(
                        next.loan.installmentAmount,
                        next.loan.borrowed.currency
                      )
                )}
              </span>
            ) : null}
            <span className="grid grid-cols-2 gap-4">
              <Total
                title={t.in("home", "You owe")}
                value={owe}
                tone="text-negative"
              />
              <Total
                title={t.in("home", "Owed to you")}
                value={owed}
                tone="text-positive"
              />
            </span>
          </>
        )}
      </Link>
    </KWSection>
  )
}

function Total({
  title,
  value,
  tone,
}: {
  title: string
  value: string | undefined
  tone: string
}) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="type-caption text-muted-foreground">{title}</span>
      <span
        className={cn(
          "type-body font-semibold break-words tabular-nums",
          value === undefined ? "text-muted-foreground" : tone
        )}
      >
        {value ?? "—"}
      </span>
    </span>
  )
}
