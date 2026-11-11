"use client"

import { useMemo, useState } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { AnimatedNumber } from "@/components/kw/animated-number"
import {
  KWButton,
  KWCircleButton,
  KWEmptyState,
  KWGroupedCard,
  KWLargeTitleHeader,
  KWSection,
  KWTransactionIcon,
} from "@/components/kw/design"
import { transactionAmountClass } from "@/components/kw/design-styles"
import { AnimatedList, ListItem } from "@/components/kw/motion"
import { CategoryBadge, Page } from "@/components/kw/primitives"
import { SkeletonList } from "@/components/kw/skeletons"
import { BALANCE_MASK, useHiddenBalances } from "@/hooks/use-hidden-balances"
import { useLedger } from "@/hooks/use-ledger"
import {
  isFinished,
  nextOccurrenceOf,
  recurringOverview,
  type Ledger,
} from "@/lib/domain"
import {
  formatAmount,
  formatMoney,
} from "@/lib/domain/format"
import { useT, type Translator } from "@/lib/i18n"
import type { RecurringRule } from "@/lib/schema"
import { cn } from "@/lib/utils"

import {
  frequencyText,
  nextDateText,
  rulePaymentText,
  sectionTitle,
} from "./recurring-format"

/**
 * Recurring movements and subscriptions: what subscriptions cost per month, then every rule by kind
 * (subscriptions, bills, income, transfers) with how often it repeats and when it comes next. A row
 * opens the rule's editor, which also shows its next dates and the movements it created.
 */
export function RecurringScreen() {
  const t = useT()
  const ledger = useLedger()
  const { openRuleEditor } = useAppActions()
  const [hidden, toggleHidden] = useHiddenBalances()
  const [now] = useState(() => new Date())
  const overview = useMemo(
    () =>
      ledger
        ? recurringOverview(ledger.recurringRules, ledger.settings.currencies)
        : undefined,
    [ledger]
  )
  const add = () => openRuleEditor({ mode: "create" })

  return (
    <Page>
      <KWLargeTitleHeader
        title={t.in("web", "Recurring")}
        trailing={
          <>
            <KWCircleButton
              icon={hidden ? "eye" : "eyeOff"}
              label={t.in("web", hidden ? "Show amounts" : "Hide amounts")}
              onClick={toggleHidden}
            />
            <KWButton icon="plus" onClick={add}>
              {t.in("web", "Add recurring")}
            </KWButton>
          </>
        }
      />
      {!ledger || !overview ? (
        <>
          <SkeletonList rows={1} />
          <SkeletonList rows={4} />
        </>
      ) : overview.sections.length === 0 ? (
        <KWGroupedCard>
          <KWEmptyState
            icon="subscription"
            title={t.in("web", "No recurring movements yet")}
            message={t.in(
              "web",
              "Add rent, your salary or a subscription once. On each date it appears as a draft for you to confirm."
            )}
            action={
              <KWButton icon="plus" size="large" onClick={add}>
                {t.in("web", "Add recurring")}
              </KWButton>
            }
          />
        </KWGroupedCard>
      ) : (
        <>
          <section className="flex flex-col gap-1 rounded-[var(--radius-surface)] bg-card p-4">
            <span className="type-label text-text-secondary">
              {t.in("web", "Subscriptions per month")}
            </span>
            <AnimatedNumber
              value={
                hidden
                  ? BALANCE_MASK
                  : formatMoney(overview.subscriptionsPerMonth)
              }
              className="type-amount-lg text-foreground"
            />
            <span className="type-caption text-muted-foreground tabular-nums">
              {t.in(
                "web",
                "≈ %@ per year",
                hidden
                  ? BALANCE_MASK
                  : formatMoney(overview.subscriptionsPerYear, {
                      fractionDigits: 0,
                    })
              )}
            </span>
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            {overview.sections.map((section) => (
              <KWSection
                key={section.kind}
                title={sectionTitle(t, section.kind)}
              >
                <KWGroupedCard>
                  <AnimatedList>
                    {section.rules.map((rule) => (
                      <RuleRow
                        key={rule.id}
                        t={t}
                        rule={rule}
                        ledger={ledger}
                        now={now}
                        hidden={hidden}
                        onSelect={() =>
                          openRuleEditor({ mode: "edit", ruleId: rule.id })
                        }
                      />
                    ))}
                  </AnimatedList>
                </KWGroupedCard>
              </KWSection>
            ))}
          </div>
        </>
      )}
    </Page>
  )
}

/** The rule's category (or the transfer icon), name, how often and with what, the amount and its next date. */
function RuleRow({
  t,
  rule,
  ledger,
  now,
  hidden,
  onSelect,
}: {
  t: Translator
  rule: RecurringRule
  ledger: Ledger
  now: Date
  hidden: boolean
  onSelect: () => void
}) {
  const category = ledger.categories.find(
    (candidate) => candidate.id === rule.categoryId
  )
  const next = nextOccurrenceOf(rule)
  const status = rule.isPaused
    ? t.in("web", "Paused")
    : isFinished(rule) || !next
      ? t.in("web", "Ended")
      : nextDateText(t, next, now)
  const inactive = rule.isPaused || isFinished(rule)
  const style = rule.kind
  return (
    <ListItem>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left press-row outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50",
          inactive && "opacity-55"
        )}
      >
        {rule.kind === "transfer" ? (
          <KWTransactionIcon style="transfer" />
        ) : (
          <CategoryBadge category={category} />
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate type-body font-semibold text-foreground">
            {rule.name}
          </span>
          <span className="truncate type-caption text-muted-foreground">
            {[
              frequencyText(t, rule.frequency, rule.interval),
              rulePaymentText(t, rule, ledger),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span
            className={cn(
              "type-body font-semibold tabular-nums",
              transactionAmountClass(style)
            )}
          >
            {hidden ? BALANCE_MASK : formatAmount(rule.amount, rule.currency)}
          </span>
          <span
            className={cn(
              "type-caption",
              rule.isPaused ? "text-pending" : "text-muted-foreground"
            )}
          >
            {status}
          </span>
        </span>
      </button>
    </ListItem>
  )
}
