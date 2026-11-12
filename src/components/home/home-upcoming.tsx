"use client"

import Link from "next/link"

import { useAppActions } from "@/components/app/app-actions"
import { KWButton, KWSection, KWTransactionIcon } from "@/components/kw/design"
import { transactionAmountClass } from "@/components/kw/design-styles"
import { BrandOrCategoryBadge } from "@/components/kw/brand-mark"
import { KWIcon } from "@/components/kw/kw-icon"
import { AnimatedList } from "@/components/kw/motion"
import { nextDateText } from "@/components/recurring/recurring-format"
import { deleteMovement } from "@/components/transactions/undoable-actions"
import { BALANCE_MASK } from "@/hooks/use-hidden-balances"
import type { Ledger, UpcomingPayment } from "@/lib/domain"
import { formatMoney } from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"
import { accountName, type TransactionDisplay } from "@/lib/presentation/display"
import type { Transaction } from "@/lib/schema"
import { cn } from "@/lib/utils"

import { homeUpcomingShown } from "./home-status"

/**
 * "Upcoming": what's pending from the same `upcomingPayments` list as the line under the greeting.
 * Everything overdue first, marked in the warning color and in words, then the next three within a
 * week: drafts (with Confirm), recurring movements, card payments and loan installments. "See all"
 * leads to the drafts when there are some, else to Recurring. Hidden when there's nothing.
 */
export function UpcomingSection({
  t,
  ledger,
  payments,
  display,
  now,
  hidden,
  confirming,
  onConfirm,
  onSelect,
}: {
  t: Translator
  ledger: Ledger
  payments: readonly UpcomingPayment[]
  display: TransactionDisplay
  now: Date
  hidden: boolean
  confirming: ReadonlySet<string>
  onConfirm: (planned: Transaction) => void
  onSelect: (transaction: Transaction) => void
}) {
  const shown = homeUpcomingShown(payments)
  if (shown.length === 0) return null
  const hasDrafts = ledger.transactions.some((transaction) => transaction.status === "planned")
  return (
    <KWSection
      title={t.in("home", "Upcoming")}
      action={
        <Link
          href={hasDrafts ? "/transactions?filter=planned" : "/recurring"}
          className="type-label text-link transition-colors outline-none hover:text-link-hover focus-visible:underline"
        >
          {t.in("home", "See all")}
        </Link>
      }
    >
      <div className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card">
        <AnimatedList>
          {shown.map((payment) => (
            <UpcomingRow
              key={payment.id}
              t={t}
              ledger={ledger}
              payment={payment}
              display={display}
              now={now}
              hidden={hidden}
              confirming={confirming}
              onConfirm={onConfirm}
              onSelect={onSelect}
            />
          ))}
        </AnimatedList>
      </div>
    </KWSection>
  )
}

/** "Overdue · 3 days", "Today", "Tomorrow" or the date. */
function statusText(t: Translator, payment: UpcomingPayment, now: Date): string {
  return payment.status === "overdue"
    ? t.in("home", "Overdue · %lld days", -payment.daysFromToday)
    : nextDateText(t, payment.date, now)
}

function UpcomingRow({
  t,
  ledger,
  payment,
  display,
  now,
  hidden,
  confirming,
  onConfirm,
  onSelect,
}: {
  t: Translator
  ledger: Ledger
  payment: UpcomingPayment
  display: TransactionDisplay
  now: Date
  hidden: boolean
  confirming: ReadonlySet<string>
  onConfirm: (planned: Transaction) => void
  onSelect: (transaction: Transaction) => void
}) {
  const { openRuleEditor } = useAppActions()
  const row = describe(t, ledger, payment, display)
  const status = statusText(t, payment, now)
  const overdue = payment.status === "overdue"
  const content = (
    <>
      {row.icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-label text-foreground">{row.title}</span>
        <span className="truncate type-caption text-muted-foreground">
          {row.subtitle ? `${row.subtitle} · ` : ""}
          {/* Overdue reads in the warning color, and says so in words too. */}
          <span className={cn(overdue && "font-semibold text-pending")}>{status}</span>
        </span>
      </span>
      <span className={cn("shrink-0 type-label tabular-nums", row.amountClass)}>
        {hidden ? BALANCE_MASK : formatMoney(payment.amount)}
      </span>
    </>
  )
  const rowClass =
    "flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left press-row outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50"

  switch (payment.kind) {
    case "draft": {
      const { transaction } = payment
      const busy = confirming.has(transaction.id)
      return (
        <div className={cn("flex items-center", busy && "animate-row-out")}>
          <button type="button" className={rowClass} onClick={() => onSelect(transaction)}>
            {content}
          </button>
          <span className="flex shrink-0 items-center gap-2 pr-4">
            {/* An assistant's movement can also be thrown away: it never happened. */}
            {transaction.source === "mcp" ? (
              <KWButton size="mini" variant="secondary" disabled={busy} onClick={() => deleteMovement(t, transaction)}>
                {t.in("home", "Discard")}
              </KWButton>
            ) : null}
            <KWButton size="mini" disabled={busy} onClick={() => onConfirm(transaction)}>
              {t.in("home", "Confirm")}
            </KWButton>
          </span>
        </div>
      )
    }
    case "recurring":
      return (
        <button type="button" className={cn(rowClass, "w-full")} onClick={() => openRuleEditor({ mode: "edit", ruleId: payment.rule.id })}>
          {content}
        </button>
      )
    case "card":
      return (
        <Link href={`/accounts?id=${payment.accountId}`} className={rowClass}>
          {content}
        </Link>
      )
    case "installment":
    case "debt":
      return (
        <Link href="/debts" className={rowClass}>
          {content}
        </Link>
      )
  }
}

/** Each kind's icon, title, subtitle and amount color, from the rows that already exist. */
function describe(t: Translator, ledger: Ledger, payment: UpcomingPayment, display: TransactionDisplay) {
  const glyph = (name: "creditCard" | "calendarCheck" | "person") => (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-text-secondary">
      <KWIcon name={name} size={16} />
    </span>
  )
  switch (payment.kind) {
    case "draft": {
      const style = display.style(payment.transaction)
      return {
        icon: <KWTransactionIcon style={style} className="size-8" />,
        title: payment.transaction.description,
        subtitle: undefined,
        amountClass: transactionAmountClass(payment.transaction.kind),
      }
    }
    case "recurring": {
      const { rule } = payment
      const category = ledger.categories.find((candidate) => candidate.id === rule.categoryId)
      return {
        icon: rule.kind === "transfer" ? <KWTransactionIcon style="transfer" className="size-8" /> : <BrandOrCategoryBadge text={rule.name} category={category} size="sm" />,
        title: rule.name,
        subtitle: undefined,
        amountClass: transactionAmountClass(rule.kind),
      }
    }
    case "card": {
      const account = ledger.accounts.find((candidate) => candidate.id === payment.accountId)
      return {
        icon: glyph("creditCard"),
        title: account ? accountName(account) : "",
        subtitle: t.in("home", "Card payment"),
        amountClass: transactionAmountClass("expense"),
      }
    }
    case "installment": {
      const loan = ledger.loans.find((candidate) => candidate.id === payment.loanId)
      return {
        icon: glyph("calendarCheck"),
        title: loan?.name ?? "",
        subtitle: t.in("home", "Installment %lld of %lld", payment.number, payment.count),
        amountClass: transactionAmountClass("expense"),
      }
    }
    case "debt":
      return {
        icon: glyph("person"),
        title: payment.person,
        subtitle: undefined,
        amountClass: transactionAmountClass(payment.direction === "theyOweMe" ? "income" : "expense"),
      }
  }
}
