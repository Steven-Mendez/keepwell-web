"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { useAppActions } from "@/components/app/app-actions"
import {
  KWActionButton,
  KWButton,
  KWEmptyState,
  KWGroupedCard,
  KWSection,
} from "@/components/kw/design"
import { AnimatedNumber } from "@/components/kw/animated-number"
import { UnconvertedNote } from "@/components/kw/unconverted-note"
import { AnimatedList, SpringFill } from "@/components/kw/motion"
import { KWIcon, KWMiniCard } from "@/components/kw/kw-icon"
import { CategoryBadge, Page, PAGE_COLUMN } from "@/components/kw/primitives"
import { TransactionRow } from "@/components/kw/transaction-row"
import { HomeSkeleton } from "@/components/kw/skeletons"
import { useConfirmDraft } from "@/components/transactions/use-confirm-draft"
import { BALANCE_MASK, useHiddenBalances } from "@/hooks/use-hidden-balances"
import {
  useLedger,
  usePreferredName,
  useTransactionDisplay,
} from "@/hooks/use-ledger"
import {
  homeOverview,
  roundedHalfUp,
  savingsRate,
  settingsRate,
  type Decimal,
  type HomeOverview,
  type Ledger,
} from "@/lib/domain"
import {
  formatAmount,
  formatMoney,
  formatNumber,
  formatRate,
} from "@/lib/domain/format"
import { useT, type Translator } from "@/lib/i18n"
import {
  accountName,
  categoryName,
  dayLabel,
  type TransactionDisplay,
} from "@/lib/presentation/display"

import type { Transaction } from "@/lib/schema"
import { cn } from "@/lib/utils"

import { ForecastSection } from "./home-forecast"
import { DebtsSection } from "./home-debts"
import { GoalsSection } from "./home-goals"
import { homeStatus, homeStatusText, homeUpcomingPayments, spentInMonthText } from "./home-status"
import { UpcomingSection } from "./home-upcoming"

const MASK = BALANCE_MASK

function greeting(t: Translator, name: string | undefined, now: Date): string {
  const hour = now.getHours()
  const part =
    hour >= 5 && hour < 12
      ? "Good morning"
      : hour >= 12 && hour < 19
        ? "Good afternoon"
        : "Good evening"
  return name ? t.in("home", `${part}, %@`, name) : t.in("home", part)
}

/**
 * Home (iOS HomeView), laid out for a wide screen: the hero on the brand gradient with net worth and
 * the translucent quick actions, then the month, recent movements and drafts beside the balances.
 */
export function HomeScreen() {
  const t = useT()
  const ledger = useLedger()
  const name = usePreferredName()
  const display = useTransactionDisplay(ledger)
  const { openEditor, showDetail } = useAppActions()
  const [hidden, toggleHidden] = useHiddenBalances()
  const { confirming, confirmDraft } = useConfirmDraft(t)
  // Fixed per visit so the greeting and "this month" don't change under the person.
  const [now] = useState(() => new Date())
  useOpenEditorFromOnboarding(openEditor)
  const overview = useMemo(
    () => (ledger ? homeOverview(ledger, now) : undefined),
    [ledger, now]
  )
  // One list for "Upcoming" and the line under the greeting, so they never contradict each other.
  const payments = useMemo(
    () => (ledger ? homeUpcomingPayments(ledger, now) : undefined),
    [ledger, now]
  )
  const status = useMemo(
    () => (payments ? homeStatusText(t, homeStatus(payments)) : undefined),
    [payments, t]
  )

  if (!ledger || !overview || !display || !payments) return <HomeSkeleton />

  const hasCredit = ledger.accounts.some((account) => account.kind === "credit")
  const recent = ledger.transactions
    .filter((transaction) => transaction.status === "confirmed")
    .slice(0, 8)
  const onSelect = (tx: Transaction) => showDetail(tx.id)

  return (
    <div className="flex flex-col">
      <Hero
        t={t}
        overview={overview}
        name={name}
        now={now}
        status={status}
        hidden={hidden}
        onToggleHidden={toggleHidden}
        month={
          <MonthCard
            t={t}
            ledger={ledger}
            overview={overview}
            hidden={hidden}
            variant="glass"
          />
        }
      >
        <HeroActions t={t} hasCredit={hasCredit} />
      </Hero>

      <Page className="pt-2 md:pt-2">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <RecentSection
              t={t}
              recent={recent}
              display={display}
              now={now}
              onSelect={onSelect}
            />

            {/* Drafts live here now, with what else is pending: one list answers one question. */}
            <UpcomingSection
              t={t}
              ledger={ledger}
              payments={payments}
              display={display}
              now={now}
              hidden={hidden}
              confirming={confirming}
              onConfirm={confirmDraft}
              onSelect={onSelect}
            />
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            {/* From lg the month lives in the hero (glass panel); phones keep iOS's card here. */}
            <div className="lg:hidden">
              <MonthCard
                t={t}
                ledger={ledger}
                overview={overview}
                hidden={hidden}
              />
            </div>

            <QuickLog
              t={t}
              ledger={ledger}
              categoryIds={overview.frequentExpenseCategoryIds}
              hasCredit={hasCredit}
            />

            {overview.forecast ? (
              <ForecastSection
                t={t}
                forecast={overview.forecast}
                hidden={hidden}
              />
            ) : null}

            <GoalsSection t={t} ledger={ledger} now={now} hidden={hidden} />

            <DebtsSection t={t} ledger={ledger} now={now} hidden={hidden} />

            <AccountsSection
              t={t}
              ledger={ledger}
              overview={overview}
              hidden={hidden}
            />
          </aside>
        </div>
      </Page>
    </div>
  )
}

/** "Log first expense" at the end of onboarding lands here with the editor open. */
function useOpenEditorFromOnboarding(
  openEditor: ReturnType<typeof useAppActions>["openEditor"]
) {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("keepwell.openEditor") === "expense") {
        sessionStorage.removeItem("keepwell.openEditor")
        openEditor({ mode: "create", type: "expense" })
      }
    } catch {}
  }, [openEditor])
}

/** The hero's four translucent actions. */
function HeroActions({ t, hasCredit }: { t: Translator; hasCredit: boolean }) {
  const { openEditor } = useAppActions()
  return (
    // Phones only: on desktop "Log transaction" in the sidebar and the N/E/I/T shortcuts cover these.
    <div className="grid w-full max-w-md grid-cols-4 gap-2 lg:hidden">
      <KWActionButton
        icon="plus"
        title={t.in("home", "Expense")}
        variant="translucent"
        shortcut="E"
        onClick={() => openEditor({ mode: "create", type: "expense" })}
      />
      <KWActionButton
        icon="arrowDownLeft"
        title={t.in("home", "action.income")}
        variant="translucent"
        shortcut="I"
        onClick={() => openEditor({ mode: "create", type: "income" })}
      />
      <KWActionButton
        icon="transfer"
        title={t.in("home", "Move")}
        variant="translucent"
        shortcut="T"
        onClick={() => openEditor({ mode: "create", type: "transfer" })}
      />
      <KWActionButton
        icon="creditCard"
        title={t.in("home", "Pay card")}
        variant="translucent"
        disabled={!hasCredit}
        onClick={() => openEditor({ mode: "create", type: "cardPayment" })}
      />
    </div>
  )
}

/** iOS "Recent": the last confirmed movements, or the empty state that invites the first one. */
function RecentSection({
  t,
  recent,
  display,
  now,
  onSelect,
}: {
  t: Translator
  recent: readonly Transaction[]
  display: TransactionDisplay
  now: Date
  onSelect: (transaction: Transaction) => void
}) {
  const { openEditor } = useAppActions()
  return (
    <KWSection
      title={t.in("home", "Recent")}
      action={
        recent.length > 0 ? (
          <SeeAll href="/transactions" label={t.in("home", "See all")} />
        ) : undefined
      }
    >
      <div className={GROUPED_LIST}>
        {recent.length === 0 ? (
          <KWEmptyState
            icon="list"
            title={t.in("home", "No transactions yet")}
            message={t.in(
              "home",
              "Log your first expense, income or transfer and you will see your month here."
            )}
            action={
              <KWButton icon="plus" shortcut="N" onClick={() => openEditor()}>
                {t.in("home", "Log transaction")}
              </KWButton>
            }
          />
        ) : (
          <AnimatedList>
            {recent.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                display={display}
                onSelect={onSelect}
                dateLabel={dayLabel(t, new Date(transaction.date), now)}
              />
            ))}
          </AnimatedList>
        )}
      </div>
    </KWSection>
  )
}

/** iOS accounts section: each balance with its card colour, then the credit cards' debt. */
function AccountsSection({
  t,
  ledger,
  overview,
  hidden,
}: {
  t: Translator
  ledger: Ledger
  overview: HomeOverview
  hidden: boolean
}) {
  return (
    <KWSection
      title={t.in("accounts", "Accounts")}
      action={<SeeAll href="/accounts" label={t.in("home", "See all")} />}
    >
      <KWGroupedCard>
        {overview.balances.map(({ account, balance }) => {
          const card = ledger.cards.find(
            (candidate) =>
              candidate.accountId === account.id && candidate.kind === "debit"
          )
          return (
            <Link
              key={account.id}
              href={`/accounts?id=${account.id}`}
              className="flex min-h-12 items-center gap-3 px-4 py-2.5 press-row outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50"
            >
              <KWMiniCard
                kind={account.kind === "cash" ? "cash" : "palette"}
                color={card?.color}
                size="tiny"
              />
              <span className="min-w-0 flex-1 truncate type-label text-foreground">
                {accountName(account)}
              </span>
              <AnimatedNumber
                value={hidden ? MASK : formatMoney(balance)}
                className="type-label text-foreground"
              />
            </Link>
          )
        })}
        {overview.cardDebt ? (
          <Link
            href="/accounts"
            className="flex min-h-12 items-center gap-3 px-4 py-2.5 press-row outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50"
          >
            <span className="flex w-8 justify-center text-text-faint">
              <KWIcon name="creditCard" size={18} />
            </span>
            <span className="min-w-0 flex-1 truncate type-label text-text-secondary">
              {t.in("home", "Cards (debt)")}
            </span>
            <AnimatedNumber
              value={hidden ? MASK : formatMoney(overview.cardDebt)}
              className="type-label text-foreground"
            />
          </Link>
        ) : null}
      </KWGroupedCard>
    </KWSection>
  )
}

/**
 * iOS "Log quickly", widened for desktop. Phones keep the hero's four actions, so here they only get
 * the frequent categories; from lg (where the hero has no actions) the card leads with the four
 * movement types (KWActionButton, shortcuts in the tooltip) and the categories follow as chips that
 * open an expense with that category already chosen.
 */
function QuickLog({
  t,
  ledger,
  categoryIds,
  hasCredit,
}: {
  t: Translator
  ledger: Ledger
  categoryIds: readonly string[]
  hasCredit: boolean
}) {
  const { openEditor } = useAppActions()
  const categories = categoryIds.flatMap(
    (id) => ledger.categories.find((candidate) => candidate.id === id) ?? []
  )
  return (
    <KWSection
      title={t.in("home", "Log quickly")}
      className={cn(
        "lg:order-first",
        categories.length === 0 && "hidden lg:flex"
      )}
    >
      <div className="flex flex-col gap-3 rounded-2xl bg-card p-4">
        <div className="hidden grid-cols-4 gap-1 lg:grid">
          <KWActionButton
            icon="plus"
            title={t.in("home", "Expense")}
            shortcut="E"
            onClick={() => openEditor({ mode: "create", type: "expense" })}
          />
          <KWActionButton
            icon="arrowDownLeft"
            title={t.in("home", "action.income")}
            shortcut="I"
            onClick={() => openEditor({ mode: "create", type: "income" })}
          />
          <KWActionButton
            icon="transfer"
            title={t.in("home", "Move")}
            shortcut="T"
            onClick={() => openEditor({ mode: "create", type: "transfer" })}
          />
          <KWActionButton
            icon="creditCard"
            title={t.in("home", "Pay card")}
            disabled={!hasCredit}
            onClick={() => openEditor({ mode: "create", type: "cardPayment" })}
          />
        </div>
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2 lg:border-t lg:border-divider lg:pt-3">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                title={`${t.in("home", "Expense")} · ${categoryName(t, category)}`}
                className="inline-flex h-8 min-w-0 press items-center gap-2 rounded-full bg-secondary pr-3 pl-1 outline-none hover:bg-secondary/70 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() =>
                  openEditor({
                    mode: "create",
                    type: "expense",
                    categoryId: category.id,
                  })
                }
              >
                <CategoryBadge category={category} size="xs" />
                <span className="truncate type-caption font-medium text-foreground">
                  {categoryName(t, category)}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </KWSection>
  )
}

/** A KWGroupedCard holding rows: one surface, 1 px dividers, rows edge to edge. */
const GROUPED_LIST =
  "flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card"

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="type-label text-link transition-colors outline-none hover:text-link-hover focus-visible:underline"
    >
      {label}
    </Link>
  )
}

/** "$11,157" + ".46": iOS sets the cents smaller so the whole amount reads first. */
function SplitAmount({ text }: { text: string }) {
  // type-display for the whole part, the title size for the cents; one number, so it rolls as one.
  return (
    <AnimatedNumber
      value={text}
      className="type-display leading-none [&::part(fraction)]:text-(length:--type-title-size)"
    />
  )
}

/** iOS HomeHero: the greeting, net worth on the brand gradient, the counts chip and the actions. */
function Hero({
  t,
  overview,
  name,
  now,
  status,
  hidden,
  onToggleHidden,
  month,
  children,
}: {
  t: Translator
  overview: HomeOverview
  name: string | undefined
  now: Date
  /** What needs attention today, under the greeting ("2 payments to confirm · 1 due tomorrow"). */
  status: string | undefined
  hidden: boolean
  onToggleHidden: () => void
  month: React.ReactNode
  children: React.ReactNode
}) {
  return (
    // A brand moment: `dark` draws it with the dark palette in both appearances. In dark mode the
    // blue melts into the black page; on the light page it ends as a blue panel instead.
    <section className="dark mt-[calc(var(--topbar-h)*-1)] rounded-b-(--radius-surface) bg-linear-to-b from-brand-600 to-brand-700 pt-(--topbar-h) text-foreground dark:rounded-none dark:bg-[linear-gradient(to_bottom,var(--brand-600)_0%,var(--brand-900)_55%,var(--background)_100%)]">
      {/*
        Phones keep iOS's centered hero. From lg it becomes a two-row desktop header that shares the
        page's columns (1fr | 22rem), so nothing on the gradient is empty space (Mobbin: Copilot,
        Monarch put the month next to the balance):
          greeting            | quick actions
          net worth           | this month (glass panel)
        From xl the month panel runs the full width beside the balance and lays out horizontally.
      */}
      <div className={cn(PAGE_COLUMN, "grid justify-items-center gap-5 pt-6 pb-10 text-center lg:grid-cols-[minmax(0,1fr)_22rem] lg:justify-items-stretch lg:gap-x-6 lg:gap-y-4 lg:pt-4 lg:pb-6 lg:text-left")}>
        <div className="flex flex-col gap-0.5 lg:col-start-1 lg:row-start-1 lg:self-center">
          <p className="type-caption text-brand-foreground">
            {now.toLocaleDateString(t.locale, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1 className="type-title-sm text-foreground">
            {greeting(t, name, now)}
          </h1>
          {status ? (
            <p className="type-label font-normal text-brand-foreground">
              {status}
            </p>
          ) : null}
        </div>
        <div className="flex w-full flex-col items-center gap-5 lg:col-span-2 lg:row-start-2 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center lg:gap-x-6 xl:grid-cols-[auto_minmax(0,1fr)] xl:gap-x-12">
          <div className="flex flex-col items-center gap-2 lg:items-start">
            <button
              type="button"
              onClick={onToggleHidden}
              className="inline-flex h-8 press items-center gap-1.5 rounded-full px-2 type-body font-medium text-brand-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:-ml-2"
              title={t.in("home", hidden ? "Shows balances" : "Hides balances")}
            >
              {t.in("home", "Net worth · %@", overview.settings.principal)}
              <KWIcon name={hidden ? "eyeOff" : "eye"} size={16} />
            </button>
            <p className="text-foreground">
              {hidden ? (
                <span
                  key="hidden"
                  className="inline-block animate-fade-in type-display leading-none"
                >
                  {MASK}
                </span>
              ) : (
                <span key="shown" className="inline-block animate-fade-in">
                  <SplitAmount text={formatMoney(overview.netWorth)} />
                </span>
              )}
            </p>
            {overview.netWorthExcluded.length > 0 ? (
              <p className="type-caption text-foreground/70">
                {t.in("home", "Doesn't include balances in %@", overview.netWorthExcluded.join(", "))}
              </p>
            ) : null}
            {/* The conversion and the counts chip share a line on desktop: one row less, same facts. */}
            <div className="flex flex-col items-center gap-2 lg:mt-1 lg:flex-row lg:flex-wrap lg:gap-3">
              {overview.netWorthInSecond ? (
                <p className="type-label font-normal text-brand-foreground tabular-nums">
                  {hidden
                    ? MASK
                    : t.in(
                        "home",
                        "≈ %@ · rate %@",
                        formatMoney(overview.netWorthInSecond, {
                          fractionDigits: 0,
                        }),
                        formatRate(settingsRate(overview.settings))
                      )}
                </p>
              ) : null}
              <Link
                href="/accounts"
                className="mt-1 inline-flex h-8 press items-center rounded-full bg-white/18 px-4 type-label text-foreground outline-none hover:bg-white/24 focus-visible:ring-2 focus-visible:ring-ring lg:mt-0"
              >
                {t.in("home", "%lld accounts", overview.accountCount)} ·{" "}
                {t.in("home", "%lld cards", overview.cardCount)}
              </Link>
            </div>
          </div>
          <div className="hidden w-full lg:block">{month}</div>
        </div>
        {children}
      </div>
    </section>
  )
}

/** iOS monthCard: what was spent this month, the savings badge and income against expenses. */
function MonthCard({
  t,
  ledger,
  overview,
  hidden,
  variant = "surface",
}: {
  t: Translator
  ledger: Ledger
  overview: HomeOverview
  hidden: boolean
  variant?: "surface" | "glass"
}) {
  const glass = variant === "glass"
  const month = overview.month
  const rate = savingsRate(month)
  const largest = month.income.gt(month.expense) ? month.income : month.expense
  const money = (amount: Decimal) =>
    hidden ? MASK : formatAmount(amount, overview.settings.principal)
  const bar = (amount: Decimal) =>
    largest.gt(0)
      ? Number(roundedHalfUp(amount.div(largest).times(100), 1).toFixed(1))
      : 0
  const top = month.categories.slice(0, 3)
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl p-[18px]",
        glass
          ? "gap-3 bg-white/8 ring-1 ring-white/10 backdrop-blur-md xl:grid xl:grid-cols-[auto_minmax(0,1fr)_minmax(0,13rem)] xl:items-center xl:gap-0 xl:px-6 xl:py-5"
          : "gap-4 bg-card"
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-2",
          glass && "xl:flex-col xl:justify-center xl:pr-6"
        )}
      >
        <div className="flex flex-col gap-0.5">
          <p className="type-label font-normal text-muted-foreground">
            {spentInMonthText(t, month.month)}
          </p>
          <AnimatedNumber
            value={money(month.expense)}
            className="type-title-sm leading-tight"
          />
        </div>
        {rate && rate.gt(0) ? (
          <span className="rounded-full bg-positive-tint px-2.5 py-1.5 type-caption font-bold text-positive">
            {t.in("home", "%@%% saved", formatNumber(rate.times(100), 0))}
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "flex flex-col gap-2",
          glass && "xl:gap-3 xl:border-l xl:border-white/10 xl:px-6"
        )}
      >
        {(
          [
            [t.in("home", "Income"), month.income, "bg-positive"],
            [t.in("home", "Expenses"), month.expense, "bg-negative"],
          ] as const
        ).map(([label, amount, fill]) => (
          // Horizontal panel (xl): label and amount on one line, the bar full width under them.
          <div
            key={label}
            className={cn(
              "flex items-center gap-2.5 type-caption font-normal text-text-secondary",
              glass && "xl:flex-wrap xl:gap-x-2 xl:gap-y-1.5"
            )}
          >
            <span
              className={cn("w-16 shrink-0", glass && "xl:w-auto xl:flex-1")}
            >
              {label}
            </span>
            <span
              className={cn(
                "h-2 flex-1 overflow-hidden rounded-full",
                glass
                  ? "bg-white/10 xl:order-last xl:w-full xl:flex-none"
                  : "bg-secondary"
              )}
            >
              <SpringFill fraction={bar(amount) / 100} className={fill} />
            </span>
            <AnimatedNumber
              value={money(amount)}
              className="min-w-20 justify-end"
            />
          </div>
        ))}
        <UnconvertedNote t={t} ns="home" excluded={month.excluded} />
      </div>
      {top.length > 0 ? (
        glass ? (
          // Desktop: the top three side by side, one line each, so the panel stays as tall as the balance.
          <ul className="grid grid-cols-3 gap-2 border-t border-white/10 pt-3 xl:grid-cols-1 xl:gap-1.5 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
            {top.map((entry) => {
              const category = ledger.categories.find(
                (candidate) => candidate.id === entry.categoryId
              )
              return (
                <li
                  key={entry.categoryId}
                  className="flex min-w-0 items-center gap-2"
                >
                  <CategoryBadge category={category} size="sm" />
                  <span className="flex min-w-0 flex-col xl:flex-1 xl:flex-row xl:items-center xl:justify-between xl:gap-2">
                    <span className="truncate type-caption-sm text-text-secondary xl:type-caption">
                      {category ? categoryName(t, category) : entry.categoryId}
                    </span>
                    <span className="truncate type-caption text-foreground tabular-nums">
                      {money(entry.amount)}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <ul className="flex flex-col gap-2 border-t border-divider pt-3">
            {top.map((entry) => {
              const category = ledger.categories.find(
                (candidate) => candidate.id === entry.categoryId
              )
              return (
                <li
                  key={entry.categoryId}
                  className="flex items-center gap-2.5"
                >
                  <CategoryBadge category={category} size="sm" />
                  <span className="min-w-0 flex-1 truncate type-caption text-text-secondary">
                    {category ? categoryName(t, category) : entry.categoryId}
                  </span>
                  <span className="type-caption text-muted-foreground tabular-nums">
                    {money(entry.amount)}
                  </span>
                </li>
              )
            })}
          </ul>
        )
      ) : null}
    </div>
  )
}
