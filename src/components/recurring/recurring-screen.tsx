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
import { BrandOrCategoryBadge } from "@/components/kw/brand-mark"
import { transactionAmountClass } from "@/components/kw/design-styles"
import { AnimatedList, ListItem } from "@/components/kw/motion"
import { Page } from "@/components/kw/primitives"
import { SkeletonList } from "@/components/kw/skeletons"
import { BALANCE_MASK, useHiddenBalances } from "@/hooks/use-hidden-balances"
import { useConfirmDraft } from "@/components/transactions/use-confirm-draft"
import { useLedgerLoad, useMerchants } from "@/hooks/use-ledger"
import { movementLogo } from "@/lib/presentation/merchants"
import {
  recurringMonthProgress,
  recurringOverview,
  ruleStatus,
  type Ledger,
  type RuleStatus,
} from "@/lib/domain"
import {
  formatAmount,
  formatMoney,
} from "@/lib/domain/format"
import { useT, type Translator } from "@/lib/i18n"
import type { RecurringRule, Transaction } from "@/lib/schema"
import { cn } from "@/lib/utils"

import {
  frequencyText,
  nextDateText,
  rulePaymentText,
  ruleStateClass,
  ruleStatusText,
  sectionTitle,
} from "./recurring-format"

/**
 * Recurring movements and subscriptions: what subscriptions cost per month, then every rule by kind
 * (subscriptions, bills, income, transfers) with how often it repeats and where it stands: paid, a
 * draft waiting, or its next date. A row opens the rule's detail, with every payment linked to it.
 */
export function RecurringScreen() {
  const t = useT()
  const { ledger, failed } = useLedgerLoad()
  const { openRuleEditor, showRuleDetail } = useAppActions()
  const [hidden, toggleHidden] = useHiddenBalances()
  const [now] = useState(() => new Date())
  const { confirming, confirmDraft } = useConfirmDraft(t)
  const overview = useMemo(
    () =>
      ledger
        ? recurringOverview(ledger.recurringRules, ledger.settings.currencies, ledger.timeZone)
        : undefined,
    [ledger]
  )
  // Once for the screen: where each rule stands (paid, a draft waiting, its next date).
  const statuses = useMemo(
    () =>
      ledger
        ? new Map(
            ledger.recurringRules.map((rule) => [
              rule.id,
              ruleStatus(rule, ledger.transactions, now, ledger.timeZone),
            ])
          )
        : undefined,
    [ledger, now]
  )
  const progress = useMemo(
    () =>
      ledger
        ? recurringMonthProgress(
            ledger.recurringRules,
            ledger.transactions,
            now,
            ledger.timeZone
          )
        : undefined,
    [ledger, now]
  )
  const add = () => openRuleEditor({ mode: "create" })
  const addSubscription = () =>
    openRuleEditor({ mode: "create", subscription: true })

  return (
    <Page>
      <KWLargeTitleHeader
        title={t.in("recurring", "Recurring")}
        trailing={
          <>
            <KWCircleButton
              icon={hidden ? "eye" : "eyeOff"}
              label={t.in("recurring", hidden ? "Show amounts" : "Hide amounts")}
              onClick={toggleHidden}
            />
            <KWButton
              variant="surface"
              icon="subscription"
              onClick={addSubscription}
            >
              {t.in("recurring", "New subscription")}
            </KWButton>
            <KWButton icon="plus" onClick={add}>
              {t.in("recurring", "Add recurring")}
            </KWButton>
          </>
        }
      />
      {failed ? (
        <p className="type-body text-muted-foreground">{t.in("recurring", "We couldn't load your recurring movements.")}</p>
      ) : !ledger || !overview ? (
        <>
          <SkeletonList rows={1} />
          <SkeletonList rows={4} />
        </>
      ) : overview.sections.length === 0 ? (
        <KWGroupedCard>
          <KWEmptyState
            icon="subscription"
            title={t.in("recurring", "Nothing recurring yet")}
            message={t.in(
              "recurring",
              "Add rent, a salary or a subscription once. Each time it's due, a draft waits on that day for you to confirm."
            )}
            action={
              <KWButton icon="plus" size="large" onClick={add}>
                {t.in("recurring", "Add recurring")}
              </KWButton>
            }
          />
        </KWGroupedCard>
      ) : (
        <>
          <section className="flex flex-col gap-1 rounded-[var(--radius-surface)] bg-card p-4">
            <span className="type-label text-text-secondary">
              {t.in("recurring", "Subscriptions per month")}
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
                "recurring",
                "≈ %@ per year",
                hidden
                  ? BALANCE_MASK
                  : formatMoney(overview.subscriptionsPerYear)
              )}
            </span>
            {overview.excludedSubscriptions.map(({ currency, count }) => (
              <span
                key={currency}
                className="type-caption text-muted-foreground tabular-nums"
              >
                {t.in(
                  "recurring",
                  "Not including %lld subscriptions in %@",
                  count,
                  currency
                )}
              </span>
            ))}
            {progress && progress.total > 0 ? (
              <span className="mt-2 border-t border-divider pt-3 type-body text-foreground tabular-nums">
                {t.in(
                  "recurring",
                  "%lld of %lld paid this month",
                  progress.paid,
                  progress.total
                )}
                {progress.remaining.length > 0 ? (
                  <span className="text-muted-foreground">
                    {" · "}
                    {t.in(
                      "recurring",
                      "%@ left to pay",
                      hidden
                        ? BALANCE_MASK
                        : progress.remaining
                            .map((money) => formatMoney(money))
                            .join(" + ")
                    )}
                  </span>
                ) : null}
              </span>
            ) : null}
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            {overview.sections.map((section) => (
              <KWSection
                key={section.kind}
                title={sectionTitle(t, section.kind)}
              >
                <KWGroupedCard>
                  <AnimatedList>
                    {section.rules.map((rule) => {
                      const status = statuses?.get(rule.id)
                      return status ? (
                        <RuleRow
                          key={rule.id}
                          t={t}
                          rule={rule}
                          ledger={ledger}
                          status={status}
                          now={now}
                          hidden={hidden}
                          confirming={confirming}
                          onConfirm={confirmDraft}
                          onSelect={() => showRuleDetail(rule.id)}
                        />
                      ) : null
                    })}
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

/**
 * The rule's category (or the transfer icon), name, how often and with what, the amount and where it
 * stands: "Paid · Nov 1" (with its next date beside the frequency), its next date and the days left,
 * or, while a draft it made waits from today or before, that draft's state and "Confirm".
 */
function RuleRow({
  t,
  rule,
  ledger,
  status,
  now,
  hidden,
  confirming,
  onConfirm,
  onSelect,
}: {
  t: Translator
  rule: RecurringRule
  ledger: Ledger
  status: RuleStatus
  now: Date
  hidden: boolean
  confirming: ReadonlySet<string>
  onConfirm: (planned: Transaction) => void
  onSelect: () => void
}) {
  const category = ledger.categories.find(
    (candidate) => candidate.id === rule.categoryId
  )
  const merchants = useMerchants()
  const pending = status.draft
  const inactive = status.state === "paused" || status.state === "ended"
  const style = rule.kind
  return (
    <ListItem>
      <div
        className={cn(
          "flex min-h-16 items-center hover:bg-secondary/50 focus-within:bg-secondary/50",
          inactive && "opacity-55"
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left press-row outline-none"
        >
          {rule.kind === "transfer" ? (
            <KWTransactionIcon style="transfer" />
          ) : (
            <BrandOrCategoryBadge text={rule.name} category={category} logo={movementLogo({ description: rule.name, merchantId: rule.merchantId }, merchants ?? [])} />
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate type-body font-semibold text-foreground">
              {rule.name}
            </span>
            <span className="truncate type-caption text-muted-foreground">
              {[
                frequencyText(t, rule.frequency, rule.interval),
                rule.source === "mcp" && rule.isPaused
                  ? t.in("recurring", "Proposed by Claude · resume to confirm")
                  : "",
                // Paid: the row says so on the right, so the next date moves here.
                status.state === "paid" && status.nextDate
                  ? t.in(
                      "recurring",
                      "Next %@",
                      nextDateText(t, status.nextDate, now)
                    )
                  : "",
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
                // Paid reads green and overdue in the warning color; both say so in words too.
                ruleStateClass(status.state)
              )}
            >
              {ruleStatusText(t, status, now)}
            </span>
          </span>
        </button>
        {pending && (
          <KWButton
            size="mini"
            className="mr-4 shrink-0"
            disabled={confirming.has(pending.id)}
            aria-label={t.in("recurring", "Confirm %@", pending.description)}
            onClick={() => onConfirm(pending)}
          >
            {t.in("recurring", "Confirm")}
          </KWButton>
        )}
      </div>
    </ListItem>
  )
}
