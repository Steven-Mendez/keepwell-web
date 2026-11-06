"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { KWActionButton, KWButton, KWEmptyState, KWGroupedCard, KWSection } from "@/components/kw/design"
import { KWIcon, KWMiniCard } from "@/components/kw/kw-icon"
import type { KWIconName } from "@/components/kw/kw-icon-data"
import { CategoryBadge, Page } from "@/components/kw/primitives"
import { TransactionRow } from "@/components/kw/transaction-row"
import { toast } from "@/components/ui/toast"
import { useLedger, usePreferredName, useTransactionDisplay } from "@/hooks/use-ledger"
import {
  compareMonths,
  confirmPlannedTransaction,
  formatAmount,
  formatMoney,
  formatNumber,
  formatRate,
  homeOverview,
  nextOccurrence,
  roundedHalfUp,
  savingsRate,
  settingsRate,
  startOfDay,
  yearMonthContaining,
  type Decimal,
  type HomeOverview,
  type Ledger,
} from "@/lib/domain"
import { useT, type Translator } from "@/lib/i18n"
import { accountName, cardShortName, categoryName, dayLabel, monthName } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"
import type { Account } from "@/lib/schema"
import { cn } from "@/lib/utils"

const MASK = "••••"
const HIDE_KEY = "keepwell.hidesBalances"

function subscribeHidden(onChange: () => void) {
  window.addEventListener("keepwell:hide-balances", onChange)
  return () => window.removeEventListener("keepwell:hide-balances", onChange)
}

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === "1"
  } catch {
    return false
  }
}

/** iOS's eye button: balances masked on screen, remembered on this device. */
export function useHiddenBalances(): [boolean, () => void] {
  const hidden = useSyncExternalStore(subscribeHidden, readHidden, () => false)
  const toggle = () => {
    try {
      localStorage.setItem(HIDE_KEY, hidden ? "0" : "1")
    } catch {}
    window.dispatchEvent(new Event("keepwell:hide-balances"))
  }
  return [hidden, toggle]
}

function greeting(t: Translator, name: string | undefined, now: Date): string {
  const hour = now.getHours()
  const part = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 19 ? "Good afternoon" : "Good evening"
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
  // Fixed per visit so the greeting and "this month" don't change under the person.
  const [now] = useState(() => new Date())
  useEffect(() => {
    // "Log first expense" at the end of onboarding lands here with the editor open.
    try {
      if (sessionStorage.getItem("keepwell.openEditor") === "expense") {
        sessionStorage.removeItem("keepwell.openEditor")
        openEditor({ mode: "create", type: "expense" })
      }
    } catch {}
  }, [openEditor])
  const overview = useMemo(() => (ledger ? homeOverview(ledger, now) : undefined), [ledger, now])

  if (!ledger || !overview || !display) return <Page aria-busy />

  const hasCredit = ledger.accounts.some((account) => account.kind === "credit")
  const reminders = homeReminders(t, ledger, overview, now)
  const recent = ledger.transactions.filter((transaction) => transaction.status === "confirmed").slice(0, 8)

  return (
    <div className="flex flex-col">
      <Hero t={t} overview={overview} name={name} now={now} hidden={hidden} onToggleHidden={toggleHidden}>
        <div className="grid w-full max-w-md grid-cols-4 gap-2">
          <KWActionButton icon="plus" title={t.in("home", "Expense")} variant="translucent" shortcut="E" onClick={() => openEditor({ mode: "create", type: "expense" })} />
          <KWActionButton icon="arrowDownLeft" title={t.in("home", "action.income")} variant="translucent" shortcut="I" onClick={() => openEditor({ mode: "create", type: "income" })} />
          <KWActionButton icon="transfer" title={t.in("home", "Move")} variant="translucent" shortcut="T" onClick={() => openEditor({ mode: "create", type: "transfer" })} />
          <KWActionButton icon="creditCard" title={t.in("home", "Pay card")} variant="translucent" disabled={!hasCredit} onClick={() => openEditor({ mode: "create", type: "cardPayment" })} />
        </div>
      </Hero>

      <Page className="pt-2">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-w-0 flex-col gap-6">
            {reminders.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {reminders.map((reminder) => (
                  <div key={reminder.id} className="flex gap-3 rounded-2xl bg-card p-4">
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", REMINDER_TONES[reminder.tone])}>
                      <KWIcon name={reminder.icon} size={20} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="type-label text-foreground">{reminder.title}</p>
                      <p className="type-caption text-muted-foreground">{reminder.body}</p>
                      {reminder.action ? (
                        <KWButton size="mini" variant="primary" className="mt-2 self-start" onClick={reminder.action.run}>
                          {reminder.action.label}
                        </KWButton>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <KWSection title={t.in("home", "Recent")} action={recent.length > 0 ? <SeeAll href="/transactions" label={t.in("home", "See all")} /> : undefined}>
              <div className="rounded-2xl bg-card p-1.5">
                {recent.length === 0 ? (
                  <KWEmptyState
                    icon="list"
                    title={t.in("home", "No transactions yet")}
                    message={t.in("home", "Log your first expense, income or transfer and you will see your month here.")}
                    action={
                      <KWButton icon="plus" shortcut="N" onClick={() => openEditor()}>
                        {t.in("home", "Log transaction")}
                      </KWButton>
                    }
                  />
                ) : (
                  recent.map((transaction) => (
                    <TransactionRow key={transaction.id} transaction={transaction} display={display} onSelect={(tx) => showDetail(tx.id)} dateLabel={dayLabel(t, new Date(transaction.date), now)} />
                  ))
                )}
              </div>
            </KWSection>

            {overview.planned.length > 0 ? (
              <KWSection title={t.in("home", "Drafts · %lld", overview.plannedSummary.count)} action={<SeeAll href="/transactions?filter=planned" label={t.in("home", "See all")} />}>
                <div className="flex flex-col gap-1 rounded-2xl bg-card p-1.5">
                  <p className="px-3 pt-2 type-caption text-muted-foreground">{plannedCaption(t, overview, hidden)}</p>
                  {overview.planned.map((transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      display={display}
                      onSelect={(tx) => showDetail(tx.id)}
                      dateLabel={dayLabel(t, new Date(transaction.date), now)}
                      trailing={
                        <KWButton
                          size="mini"
                          onClick={() => {
                            confirmPlannedTransaction(ledgerStore, transaction.id).catch(() => toast.add({ title: t.in("home", "We couldn't confirm it. Try again."), type: "error" }))
                          }}
                        >
                          {t.in("home", "Confirm")}
                        </KWButton>
                      }
                    />
                  ))}
                </div>
              </KWSection>
            ) : null}
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            <MonthCard t={t} ledger={ledger} overview={overview} hidden={hidden} />

            <KWSection title={t.in("accounts", "Accounts")} action={<SeeAll href="/accounts" label={t.in("home", "See all")} />}>
              <KWGroupedCard>
                {overview.balances.map(({ account, balance }) => {
                  const card = ledger.cards.find((candidate) => candidate.accountId === account.id && candidate.kind === "debit")
                  return (
                    <Link key={account.id} href={`/accounts?id=${account.id}`} className="flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50">
                      <KWMiniCard kind={account.kind === "cash" ? "cash" : "palette"} color={card?.color} size="tiny" />
                      <span className="min-w-0 flex-1 truncate type-label text-foreground">{accountName(account)}</span>
                      <span className="type-label text-foreground tabular-nums">{hidden ? MASK : formatMoney(balance)}</span>
                    </Link>
                  )
                })}
                {overview.cardDebt ? (
                  <Link href="/accounts" className="flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50">
                    <span className="flex w-8 justify-center text-text-faint">
                      <KWIcon name="creditCard" size={18} />
                    </span>
                    <span className="min-w-0 flex-1 truncate type-label text-text-secondary">{t.in("home", "Cards (debt)")}</span>
                    <span className="type-label text-foreground tabular-nums">{hidden ? MASK : formatMoney(overview.cardDebt)}</span>
                  </Link>
                ) : null}
              </KWGroupedCard>
            </KWSection>

            {overview.frequentExpenseCategoryIds.length > 0 ? (
              <KWSection title={t.in("home", "Log quickly")}>
                <div className="grid grid-cols-3 gap-2">
                  {overview.frequentExpenseCategoryIds.map((id) => {
                    const category = ledger.categories.find((candidate) => candidate.id === id)
                    if (!category) return null
                    return (
                      <button
                        key={id}
                        type="button"
                        className="flex flex-col items-center gap-2 rounded-2xl bg-card px-2 py-3 transition-colors outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => openEditor({ mode: "create", type: "expense" })}
                      >
                        <CategoryBadge category={category} size="sm" />
                        <span className="w-full truncate text-center type-caption text-text-secondary">{categoryName(t, category)}</span>
                      </button>
                    )
                  })}
                </div>
              </KWSection>
            ) : null}

          </aside>
        </div>
      </Page>
    </div>
  )
}

const REMINDER_TONES = {
  pending: "bg-pending-tint text-pending",
  accent: "bg-accent-tint text-link",
  negative: "bg-negative-tint text-negative",
} as const

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="type-label text-link transition-colors outline-none hover:text-link-hover focus-visible:underline">
      {label}
    </Link>
  )
}

/** "$11,157" + ".46": iOS sets the cents smaller so the whole amount reads first. */
function SplitAmount({ text }: { text: string }) {
  const match = /^(.*?)(\.\d+)$/.exec(text)
  return (
    <span className="text-[3.25rem] leading-none font-extrabold tracking-[-1.5px] tabular-nums">
      {match ? match[1] : text}
      {match ? <span className="text-[1.875rem]">{match[2]}</span> : null}
    </span>
  )
}

/** iOS HomeHero: the greeting, net worth on the brand gradient, the counts chip and the actions. */
function Hero({ t, overview, name, now, hidden, onToggleHidden, children }: { t: Translator; overview: HomeOverview; name: string | undefined; now: Date; hidden: boolean; onToggleHidden: () => void; children: React.ReactNode }) {
  return (
    <section className="-mt-16 bg-[linear-gradient(to_bottom,var(--brand-600)_0%,var(--brand-900)_55%,var(--background)_100%)] pt-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-(--gutter) pt-6 pb-10 text-center md:px-8">
        <div className="flex flex-col gap-0.5">
          <p className="type-caption text-brand-foreground">{now.toLocaleDateString(t.locale, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="type-title-sm text-foreground">{greeting(t, name, now)}</h1>
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onToggleHidden}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-2 type-body font-medium text-brand-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            title={t.in("home", hidden ? "Shows balances" : "Hides balances")}
          >
            {t.in("home", "Net worth · %@", overview.settings.principal)}
            <KWIcon name={hidden ? "eyeOff" : "eye"} size={16} />
          </button>
          <p className="text-foreground">{hidden ? <span className="text-[3.25rem] leading-none font-extrabold">{MASK}</span> : <SplitAmount text={formatMoney(overview.netWorth)} />}</p>
          {overview.netWorthInSecond ? (
            <p className="type-label font-normal text-brand-foreground tabular-nums">
              {hidden ? MASK : t.in("home", "≈ %@ · rate %@", formatMoney(overview.netWorthInSecond, { fractionDigits: 0 }), formatRate(settingsRate(overview.settings)))}
            </p>
          ) : null}
          <Link href="/accounts" className="mt-1 inline-flex h-8 items-center rounded-full bg-white/18 px-4 type-label text-foreground transition-colors outline-none hover:bg-white/24 focus-visible:ring-2 focus-visible:ring-ring">
            {t.in("home", "%lld accounts", overview.accountCount)} · {t.in("home", "%lld cards", overview.cardCount)}
          </Link>
        </div>
        {children}
      </div>
    </section>
  )
}

/** iOS monthCard: what was spent this month, the savings badge and income against expenses. */
function MonthCard({ t, ledger, overview, hidden }: { t: Translator; ledger: Ledger; overview: HomeOverview; hidden: boolean }) {
  const month = overview.month
  const rate = savingsRate(month)
  const largest = month.income.gt(month.expense) ? month.income : month.expense
  const money = (amount: Decimal) => (hidden ? MASK : formatAmount(amount, overview.settings.principal))
  const bar = (amount: Decimal) => (largest.gt(0) ? Number(roundedHalfUp(amount.div(largest).times(100), 1).toFixed(1)) : 0)
  const top = month.categories.slice(0, 3)
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card p-[18px]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="type-label font-normal text-muted-foreground">{t.in("home", "Spent in %@", monthName(t, month.month))}</p>
          <p className="text-[1.625rem] leading-tight font-extrabold tracking-[-0.5px] tabular-nums">{money(month.expense)}</p>
        </div>
        {rate && rate.gt(0) ? (
          <span className="rounded-full bg-positive-tint px-2.5 py-1.5 type-caption font-bold text-positive">{t.in("home", "%@%% saved", formatNumber(rate.times(100), 0))}</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        {(
          [
            [t.in("home", "Income"), month.income, "bg-positive"],
            [t.in("home", "Expenses"), month.expense, "bg-negative"],
          ] as const
        ).map(([label, amount, fill]) => (
          <div key={label} className="flex items-center gap-2.5 type-caption font-normal text-text-secondary">
            <span className="w-16 shrink-0">{label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <span className={cn("block h-full rounded-full", fill)} style={{ width: `${bar(amount)}%` }} />
            </span>
            <span className="min-w-20 text-right tabular-nums">{money(amount)}</span>
          </div>
        ))}
      </div>
      {top.length > 0 ? (
        <ul className="flex flex-col gap-2 border-t border-divider pt-3">
          {top.map((entry) => {
            const category = ledger.categories.find((candidate) => candidate.id === entry.categoryId)
            return (
              <li key={entry.categoryId} className="flex items-center gap-2.5">
                <CategoryBadge category={category} size="sm" />
                <span className="min-w-0 flex-1 truncate type-caption text-text-secondary">{category ? categoryName(t, category) : entry.categoryId}</span>
                <span className="type-caption text-muted-foreground tabular-nums">{money(entry.amount)}</span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function plannedCaption(t: Translator, overview: HomeOverview, hidden: boolean): string {
  if (hidden) return t.in("home", "They don't count toward balances until you confirm them · %@", MASK)
  const summary = overview.plannedSummary
  const principal = formatAmount(summary.principalTotal, overview.settings.principal)
  const total = overview.settings.second ? `${formatAmount(summary.secondTotal, overview.settings.second, { fractionDigits: 0 })} (≈ ${principal})` : principal
  return t.in("home", "They don't count toward balances until you confirm them · %@", total)
}

interface Reminder {
  id: string
  icon: KWIconName
  tone: "pending" | "accent" | "negative"
  title: string
  body: string
  action?: { label: string; run: () => void }
}

/**
 * What iOS sends as notifications, shown in place on the web: drafts due today, card payments
 * within the reminder window, statements closing today and plastics expiring this month.
 */
function homeReminders(t: Translator, ledger: Ledger, overview: HomeOverview, now: Date): Reminder[] {
  const today = startOfDay(now).getTime()
  const endOfToday = today + 86_400_000
  const display = (account: Account) => {
    const holder = ledger.cards.find((card) => card.accountId === account.id && card.kind === "creditHolder")
    return holder ? cardShortName(t, holder) : accountName(account)
  }
  const reminders: Reminder[] = []
  for (const transaction of overview.planned) {
    if (new Date(transaction.date).getTime() >= endOfToday) continue
    const card = ledger.cards.find((candidate) => candidate.id === transaction.cardId)
    const account = ledger.accounts.find((candidate) => candidate.id === transaction.accountId)
    const method = card ? cardShortName(t, card) : account ? accountName(account) : ""
    reminders.push({
      id: `planned-${transaction.id}`,
      icon: "clock",
      tone: "pending",
      title: t.in("home", "Draft for today"),
      body: t.in("home", "%@ · %@ from %@. Has it been paid?", transaction.description, formatAmount(transaction.amount, transaction.currency), method),
      action: { label: t.in("home", "Confirm"), run: () => void confirmPlannedTransaction(ledgerStore, transaction.id) },
    })
  }
  for (const account of ledger.accounts) {
    if (account.kind !== "credit") continue
    const dueDay = account.creditTerms?.dueDay
    if (dueDay) {
      const due = nextOccurrence(dueDay, now)
      const days = Math.round((due.getTime() - today) / 86_400_000)
      if (days <= overview.paymentReminderDaysBefore) {
        reminders.push({
          id: `payment-${account.id}`,
          icon: "creditCard",
          tone: "negative",
          title: t.in("home", "%@: payment in %lld days", display(account), days),
          body: t.in("home", "Pay before day %lld so it doesn't generate interest.", dueDay),
        })
      }
    }
    const cutoffDay = account.creditTerms?.cutoffDay
    if (cutoffDay && nextOccurrence(cutoffDay, now).getTime() === today) {
      reminders.push({
        id: `cutoff-${account.id}`,
        icon: "clock",
        tone: "accent",
        title: t.in("home", "%@: statement closes today", display(account)),
        body: t.in("home", "From tomorrow, purchases go to next month's statement."),
      })
    }
  }
  const thisMonth = yearMonthContaining(now)
  for (const card of ledger.cards) {
    if (!card.expiry || compareMonths(card.expiry, thisMonth) !== 0) continue
    const services = overview.cardSubscriptions.get(card.id) ?? []
    reminders.push({
      id: `expiry-${card.id}`,
      icon: "creditCard",
      tone: "pending",
      title: t.in("home", "%@ expires this month", cardShortName(t, card)),
      body:
        services.length === 0
          ? t.in("home", "Update it wherever it's saved before it stops working.")
          : t.in("home", "Update it in %@ before it stops working.", new Intl.ListFormat(t.locale, { type: "conjunction" }).format(services)),
    })
  }
  return reminders
}
