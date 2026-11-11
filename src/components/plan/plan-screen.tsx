"use client"

import Link from "next/link"
import { useState, type CSSProperties, type ReactNode } from "react"

import { DEFAULT_GOAL_SYMBOL, goalBadge } from "@/components/goals/goal-format"
import { KWCircleButton, KWLargeTitleHeader } from "@/components/kw/design"
import { AnimatedNumber } from "@/components/kw/animated-number"
import { KWIcon } from "@/components/kw/kw-icon"
import { SpringFill } from "@/components/kw/motion"
import { CategoryBadge, Page } from "@/components/kw/primitives"
import { SkeletonList } from "@/components/kw/skeletons"
import { loanLine, totalsText } from "@/components/debts/debt-format"
import { nextDateText } from "@/components/recurring/recurring-format"
import { BALANCE_MASK, useHiddenBalances } from "@/hooks/use-hidden-balances"
import { useLedger } from "@/hooks/use-ledger"
import { formatAmount, formatMoney } from "@/lib/domain/format"
import { useT, type Translator } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { planSummary, type PlanSummary } from "./plan-summary"

/**
 * The Plan hub (iOS Plan tab): three tappable summary cards, one per planning screen (Recurring,
 * Savings goals, Debts), laid out as titled cards with a chevron, a headline value and a caption
 * (Mobbin: Revolut web Analytics). The eye hides every amount, shared with Home.
 */
export function PlanScreen() {
  const t = useT()
  const ledger = useLedger()
  const [hidden, toggleHidden] = useHiddenBalances()
  // Fixed per visit, like Home.
  const [now] = useState(() => new Date())
  const summary = ledger ? planSummary(ledger, now) : undefined

  return (
    <Page>
      <KWLargeTitleHeader
        title={t.in("plan", "Plan")}
        trailing={
          <KWCircleButton
            icon={hidden ? "eye" : "eyeOff"}
            label={t.in("recurring", hidden ? "Show amounts" : "Hide amounts")}
            onClick={toggleHidden}
          />
        }
      />
      {!summary ? (
        <SkeletonList rows={3} />
      ) : (
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          <RecurringCard t={t} summary={summary} now={now} hidden={hidden} />
          <GoalsCard t={t} summary={summary} hidden={hidden} />
          <DebtsCard t={t} summary={summary} hidden={hidden} />
        </div>
      )}
    </Page>
  )
}

function PlanCard({
  href,
  title,
  children,
}: {
  href: string
  title: string
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex min-h-40 flex-col gap-3 rounded-2xl bg-card p-4 press-row outline-none hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="type-label text-text-secondary">{title}</span>
        <KWIcon name="chevronRight" size={16} className="text-text-faint" />
      </span>
      {children}
    </Link>
  )
}

const Empty = ({ children }: { children: ReactNode }) => (
  <span className="type-body text-muted-foreground">{children}</span>
)

function RecurringCard({
  t,
  summary,
  now,
  hidden,
}: {
  t: Translator
  summary: PlanSummary
  now: Date
  hidden: boolean
}) {
  const { recurring } = summary
  return (
    <PlanCard href="/recurring" title={t.in("recurring", "Recurring")}>
      {recurring.ruleCount === 0 ? (
        <Empty>{t.in("recurring", "Nothing recurring yet")}</Empty>
      ) : (
        <>
          <span className="flex flex-col gap-1">
            <AnimatedNumber
              value={
                hidden
                  ? BALANCE_MASK
                  : formatMoney(recurring.subscriptionsPerMonth)
              }
              className="type-amount-lg text-foreground"
            />
            <span className="type-caption text-muted-foreground">
              {t.in("recurring", "Subscriptions per month")}
            </span>
          </span>
          {recurring.next ? (
            <span className="truncate type-caption text-text-secondary tabular-nums">
              {t.in(
                "home",
                "%@ on %@",
                recurring.next.rule.name,
                nextDateText(t, recurring.next.date, now)
              )}
            </span>
          ) : null}
        </>
      )}
    </PlanCard>
  )
}

function GoalsCard({
  t,
  summary,
  hidden,
}: {
  t: Translator
  summary: PlanSummary
  hidden: boolean
}) {
  const { count, first } = summary.goals
  return (
    <PlanCard href="/goals" title={t.in("home", "Savings goals")}>
      {first ? (
        <>
          <span className="flex items-center gap-3">
            <CategoryBadge
              category={goalBadge(first.goal)}
              symbol={first.goal.icon ?? DEFAULT_GOAL_SYMBOL}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate type-body font-semibold">
                  {first.goal.name}
                </span>
                <span className="shrink-0 type-caption text-muted-foreground tabular-nums">
                  {t.in(
                    "home",
                    "%@ of %@",
                    hidden
                      ? BALANCE_MASK
                      : formatAmount(first.goal.saved, first.goal.target.currency),
                    hidden
                      ? BALANCE_MASK
                      : formatAmount(
                          first.goal.target.amount,
                          first.goal.target.currency
                        )
                  )}
                </span>
              </span>
              <span
                className="h-1.5 overflow-hidden rounded-full bg-secondary"
                style={
                  {
                    "--fill": first.progress.isReached
                      ? "var(--positive)"
                      : "var(--accent)",
                  } as CSSProperties
                }
                aria-hidden
              >
                <SpringFill
                  fraction={first.progress.fraction.toNumber()}
                  className="bg-(--fill)"
                />
              </span>
            </span>
          </span>
          <span className="type-caption text-muted-foreground tabular-nums">
            {t.in("plan", "%lld goals", count)}
          </span>
        </>
      ) : (
        <Empty>{t.in("home", "No goals yet")}</Empty>
      )}
    </PlanCard>
  )
}

function DebtsCard({
  t,
  summary,
  hidden,
}: {
  t: Translator
  summary: PlanSummary
  hidden: boolean
}) {
  const { debts } = summary
  return (
    <PlanCard href="/debts" title={t.in("home", "Debts")}>
      {debts.isEmpty ? (
        <Empty>{t.in("home", "No debts yet")}</Empty>
      ) : (
        <>
          <span className="grid grid-cols-2 gap-4">
            <Total
              title={t.in("home", "You owe")}
              value={totalsText(t, debts.totals.youOwe, hidden)}
              tone="text-negative"
            />
            <Total
              title={t.in("home", "Owed to you")}
              value={totalsText(t, debts.totals.owedToYou, hidden)}
              tone="text-positive"
            />
          </span>
          {debts.nextLoan ? (
            <span
              className={cn(
                "type-caption tabular-nums",
                debts.nextLoan.isNextOverdue
                  ? "text-pending"
                  : "text-text-secondary"
              )}
            >
              {loanLine(t, debts.nextLoan, hidden)}
            </span>
          ) : null}
        </>
      )}
    </PlanCard>
  )
}

function Total({
  title,
  value,
  tone,
}: {
  title: string
  value: string
  tone: string
}) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="type-caption text-muted-foreground">{title}</span>
      <span className={cn("type-body font-semibold break-words tabular-nums", tone)}>
        {value}
      </span>
    </span>
  )
}
