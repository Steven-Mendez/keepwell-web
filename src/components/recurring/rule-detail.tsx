"use client"

import { useMemo, useState } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { BrandOrCategoryBadge } from "@/components/kw/brand-mark"
import {
  KWButton,
  KWCircleButton,
  KWEmptyState,
  KWTextAction,
  KWTransactionIcon,
} from "@/components/kw/design"
import { transactionAmountClass } from "@/components/kw/design-styles"
import { TransactionRow } from "@/components/kw/transaction-row"
import { FlowHeader } from "@/components/movement-editor/flow-parts"
import { useConfirmDraft } from "@/components/transactions/use-confirm-draft"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { useLedger, useTransactionDisplay } from "@/hooks/use-ledger"
import {
  canLinkPayment,
  linkPayment,
  nextOccurrences,
  paymentCandidates,
  ruleHistory,
  ruleStatus,
  setRecurringRulePaused,
  unlinkPayment,
  type Ledger,
  type RuleState,
} from "@/lib/domain"
import { formatAmount, formatMoney } from "@/lib/domain/format"
import { useT, type Translator } from "@/lib/i18n"
import { dayLabel } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"
import type { RecurringRule, Transaction } from "@/lib/schema"
import { cn } from "@/lib/utils"

import {
  frequencyText,
  nextDateText,
  nextPaymentText,
  rulePaymentText,
  ruleStateLabel,
} from "./recurring-format"

/** Movements offered under "Other movements" before the person searches. */
const OTHER_COUNT = 30

/**
 * A recurring rule read, not edited: whether this cycle is paid, when the next payment is, and every
 * movement that paid it. A payment recorded by hand is linked here ("Link a payment") or taken out
 * again. "Edit" opens the rule's form.
 */
export function RuleDetail() {
  const { ruleDetailId, showRuleDetail } = useAppActions()
  return (
    <Dialog
      open={ruleDetailId !== undefined}
      onOpenChange={(open) => (open ? undefined : showRuleDetail(undefined))}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(92vh,880px)] flex-col gap-0 overflow-hidden rounded-[var(--radius-surface)] bg-background p-0 ring-1 ring-border max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-h-none max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none sm:max-w-xl"
      >
        {ruleDetailId ? (
          <RuleDetailBody
            key={ruleDetailId}
            ruleId={ruleDetailId}
            onClose={() => showRuleDetail(undefined)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function RuleDetailBody({
  ruleId,
  onClose,
}: {
  ruleId: string
  onClose: () => void
}) {
  const t = useT()
  const ledger = useLedger()
  const [linking, setLinking] = useState(false)
  const rule = ledger?.recurringRules.find(
    (candidate) => candidate.id === ruleId
  )
  if (!ledger) {
    return (
      <div className="flex min-h-64 items-center justify-center" aria-busy>
        <DialogTitle className="sr-only">
          {t.in("recurring", "Recurring")}
        </DialogTitle>
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }
  // Deleted here or on another device while its detail was open.
  if (!rule) {
    return (
      <div className="flex flex-col gap-2 p-(--gutter) md:p-6">
        <FlowHeader leading="close" onLeading={onClose} />
        <DialogTitle className="sr-only">
          {t.in("recurring", "Recurring")}
        </DialogTitle>
        <KWEmptyState
          icon="subscription"
          title={t.in("recurring", "Nothing recurring yet")}
        />
      </div>
    )
  }
  return linking ? (
    <LinkPayment
      t={t}
      rule={rule}
      ledger={ledger}
      onDone={() => setLinking(false)}
    />
  ) : (
    <Detail
      t={t}
      rule={rule}
      ledger={ledger}
      onClose={onClose}
      onLink={() => setLinking(true)}
    />
  )
}

const pillClass: Record<RuleState, string> = {
  paid: "bg-positive-tint text-positive",
  overdue: "bg-pending-tint text-pending",
  toConfirm: "bg-pending-tint text-pending",
  paused: "bg-secondary text-muted-foreground",
  ended: "bg-secondary text-muted-foreground",
  upcoming: "bg-secondary text-text-secondary",
}

function Detail({
  t,
  rule,
  ledger,
  onClose,
  onLink,
}: {
  t: Translator
  rule: RecurringRule
  ledger: Ledger
  onClose: () => void
  onLink: () => void
}) {
  const { openRuleEditor, showDetail } = useAppActions()
  const display = useTransactionDisplay(ledger)
  const { confirming, confirmDraft } = useConfirmDraft(t)
  const [now] = useState(() => new Date())
  const [busy, setBusy] = useState(false)
  const status = useMemo(
    () => ruleStatus(rule, ledger.transactions, now, ledger.timeZone),
    [rule, ledger, now]
  )
  const history = useMemo(
    () => ruleHistory(rule, ledger.transactions, now, ledger.timeZone),
    [rule, ledger, now]
  )
  const nextDates = useMemo(
    () => (rule.isPaused ? [] : nextOccurrences(rule, 3, ledger.timeZone)),
    [rule, ledger.timeZone]
  )
  const category = ledger.categories.find(
    (candidate) => candidate.id === rule.categoryId
  )
  const failed = (title: string) => toast.add({ title, type: "error" })
  const run = (work: () => Promise<unknown>, message: string) => {
    if (busy) return
    setBusy(true)
    work()
      .catch(() => failed(message))
      .finally(() => setBusy(false))
  }
  const edit = () => {
    onClose()
    openRuleEditor({ mode: "edit", ruleId: rule.id })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-(--gutter) md:p-6">
      <FlowHeader
        leading="close"
        onLeading={onClose}
        trailing={
          <KWButton variant="surface" icon="pencil" onClick={edit}>
            {t.in("recurring", "Edit")}
          </KWButton>
        }
      />
      <DialogTitle className="sr-only">{rule.name}</DialogTitle>

      <div className="flex flex-col items-center gap-1 rounded-2xl bg-card px-4 pt-5 pb-4 text-center">
        {rule.kind === "transfer" ? (
          <KWTransactionIcon style="transfer" />
        ) : (
          <BrandOrCategoryBadge text={rule.name} category={category} />
        )}
        <span className="mt-1 max-w-full truncate type-body font-semibold text-foreground">
          {rule.name}
        </span>
        <span
          className={cn(
            "max-w-full overflow-hidden type-amount-lg tabular-nums",
            transactionAmountClass(rule.kind)
          )}
        >
          {formatAmount(rule.amount, rule.currency)}
        </span>
        <span className="max-w-full truncate type-caption text-muted-foreground">
          {[
            frequencyText(t, rule.frequency, rule.interval),
            rulePaymentText(t, rule, ledger),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      <section className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span
            className={cn(
              "inline-flex h-6 w-fit items-center rounded-full px-2.5 type-micro font-bold",
              pillClass[status.state]
            )}
          >
            {status.state === "overdue"
              ? t.in("recurring", "Overdue · %lld days", status.daysOverdue)
              : status.state === "paid" && status.payment
                ? t.in(
                    "recurring",
                    "Paid · %@",
                    nextDateText(t, new Date(status.payment.date), now)
                  )
                : ruleStateLabel(t, status.state)}
          </span>
          {status.nextDate && !rule.isPaused ? (
            <span className="type-body text-foreground">
              <span className="text-muted-foreground">
                {t.in("recurring", "Next payment")}
                {" · "}
              </span>
              {nextPaymentText(t, status, now)}
            </span>
          ) : null}
          {status.state !== "paid" && status.lastPayment ? (
            <span className="type-caption text-muted-foreground">
              {t.in(
                "recurring",
                "Last payment %@",
                nextDateText(t, new Date(status.lastPayment.date), now)
              )}
            </span>
          ) : null}
        </div>
        {status.draft ? (
          <KWButton
            className="shrink-0"
            disabled={confirming.has(status.draft.id)}
            aria-label={t.in(
              "recurring",
              "Confirm %@",
              status.draft.description
            )}
            onClick={() => status.draft && confirmDraft(status.draft)}
          >
            {t.in("recurring", "Confirm")}
          </KWButton>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="type-label text-muted-foreground">
            {t.in("recurring", "Payments")}
          </h3>
          <KWTextAction onClick={onLink}>
            {t.in("recurring", "Link a payment")}
          </KWTextAction>
        </div>
        {history.payments.length === 0 || !display ? (
          <div className="flex flex-col gap-1 rounded-2xl bg-card px-4 py-4">
            <span className="type-body font-semibold text-foreground">
              {t.in("recurring", "No payments yet")}
            </span>
            <span className="type-caption text-muted-foreground">
              {t.in(
                "recurring",
                "Link a movement you already recorded and it counts as a payment of this one."
              )}
            </span>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-2xl bg-card px-4 py-3">
              <span className="type-caption text-muted-foreground">
                {t.in("recurring", "Paid this year")}
              </span>
              <span className="type-body font-semibold text-foreground tabular-nums">
                {formatMoney(history.paidThisYear)}
                <span className="type-caption font-normal text-muted-foreground">
                  {" · "}
                  {t.in("recurring", "%lld payments", history.paidCount)}
                </span>
              </span>
              {history.priceChange ? (
                <span className="basis-full type-caption text-pending">
                  {t.in(
                    "recurring",
                    "Price changed from %@ to %@",
                    formatMoney(history.priceChange.from),
                    formatMoney(history.priceChange.to)
                  )}
                </span>
              ) : null}
            </div>
            <div className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card">
              {history.payments.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  display={display}
                  dateLabel={dayLabel(t, new Date(transaction.date), now)}
                  onSelect={() => {
                    onClose()
                    showDetail(transaction.id)
                  }}
                  // A draft is the rule's own occurrence waiting: only a payment is unlinked.
                  trailing={
                    transaction.status === "planned" ? undefined : (
                      <KWCircleButton
                        icon="close"
                        size={32}
                        label={t.in("recurring", "Unlink payment")}
                        disabled={busy}
                        onClick={(event) => {
                          event.stopPropagation()
                          run(
                            () => unlinkPayment(ledgerStore, transaction.id),
                            t.in("recurring", "We couldn't save it. Try again.")
                          )
                        }}
                      />
                    )
                  }
                />
              ))}
            </div>
          </>
        )}
      </section>

      {nextDates.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="type-label text-muted-foreground">
            {t.in("recurring", "Next dates")}
          </h3>
          <ol className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card">
            {nextDates.map((date) => (
              <li
                key={date.toISOString()}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <span className="type-body text-foreground">
                  {nextDateText(t, date, now)}
                </span>
                <span className="type-caption text-muted-foreground">
                  {date.toLocaleDateString(t.locale, { weekday: "long" })}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="mt-auto flex pt-2">
        <KWButton
          variant="surface"
          fill
          disabled={busy}
          onClick={() =>
            run(
              () =>
                setRecurringRulePaused(ledgerStore, rule.id, !rule.isPaused),
              t.in("recurring", "We couldn't save it. Try again.")
            )
          }
        >
          {t.in("recurring", rule.isPaused ? "Resume" : "Pause")}
        </KWButton>
      </div>
    </div>
  )
}

/**
 * "Link a payment": movements already recorded that could be this rule's payment. The suggested
 * ones match its amount or its name; the rest are found by searching.
 */
function LinkPayment({
  t,
  rule,
  ledger,
  onDone,
}: {
  t: Translator
  rule: RecurringRule
  ledger: Ledger
  onDone: () => void
}) {
  const display = useTransactionDisplay(ledger)
  const [query, setQuery] = useState("")
  const [linkingId, setLinkingId] = useState<string>()
  const [now] = useState(() => new Date())
  const suggested = useMemo(
    () => paymentCandidates(rule, ledger.transactions),
    [rule, ledger.transactions]
  )
  const others = useMemo(() => {
    const taken = new Set(suggested.map((transaction) => transaction.id))
    const needle = query.trim().toLocaleLowerCase()
    return ledger.transactions
      .filter(
        (transaction) =>
          !taken.has(transaction.id) &&
          transaction.recurringId === undefined &&
          transaction.status === "confirmed" &&
          canLinkPayment(rule, transaction) &&
          (needle === "" ||
            `${transaction.description} ${transaction.note ?? ""} ${transaction.amount}`
              .toLocaleLowerCase()
              .includes(needle))
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, OTHER_COUNT)
  }, [ledger.transactions, suggested, query, rule])
  const shownSuggested = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return needle === ""
      ? suggested
      : suggested.filter((transaction) =>
          `${transaction.description} ${transaction.note ?? ""} ${transaction.amount}`
            .toLocaleLowerCase()
            .includes(needle)
        )
  }, [suggested, query])

  const link = (transaction: Transaction) => {
    if (linkingId) return
    setLinkingId(transaction.id)
    linkPayment(ledgerStore, rule.id, transaction.id)
      .then(onDone)
      .catch(() => {
        setLinkingId(undefined)
        toast.add({
          title: t.in("recurring", "We couldn't link it. Try again."),
          type: "error",
        })
      })
  }
  const list = (title: string, transactions: Transaction[]) =>
    transactions.length > 0 && display ? (
      <section className="flex flex-col gap-2">
        <h3 className="type-label text-muted-foreground">{title}</h3>
        <div className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card">
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              display={display}
              dateLabel={dayLabel(t, new Date(transaction.date), now)}
              onSelect={link}
              className={cn(linkingId === transaction.id && "opacity-55")}
            />
          ))}
        </div>
      </section>
    ) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-(--gutter) md:p-6">
      <FlowHeader leading="back" onLeading={onDone} />
      <DialogTitle className="type-title text-foreground">
        {t.in("recurring", "Link a payment")}
      </DialogTitle>
      <Input
        type="search"
        value={query}
        autoFocus
        placeholder={t.in("recurring", "Search movements")}
        aria-label={t.in("recurring", "Search movements")}
        onChange={(event) => setQuery(event.target.value)}
      />
      {list(t.in("recurring", "Suggested"), shownSuggested)}
      {list(t.in("recurring", "Other movements"), others)}
      {shownSuggested.length === 0 && others.length === 0 ? (
        <p className="type-body text-muted-foreground">
          {t.in("recurring", "No movements to link")}
        </p>
      ) : null}
    </div>
  )
}
