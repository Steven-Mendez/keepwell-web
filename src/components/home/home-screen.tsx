"use client"

import {
  ArrowDownLeftIcon,
  ArrowLeftRightIcon,
  BellIcon,
  CalendarClockIcon,
  ChartColumnIcon,
  CreditCardIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { CategoryBadge, EmptyState, IconBadge, Page, SectionTitle, Surface } from "@/components/kw/primitives"
import { TransactionRow } from "@/components/kw/transaction-row"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
  savingsRate,
  settingsRate,
  startOfDay,
  yearMonthContaining,
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

/** Home (iOS HomeView): net worth, quick actions, the month, recent movements, drafts and balances. */
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

  const money = (amount: Parameters<typeof formatAmount>[0], fractionDigits = 2) => (hidden ? MASK : formatAmount(amount, overview.settings.principal, { fractionDigits }))
  const hasCredit = ledger.accounts.some((account) => account.kind === "credit")
  const month = monthName(t, overview.month.month)
  const rate = savingsRate(overview.month)
  const reminders = homeReminders(t, ledger, overview, now)

  return (
    <Page>
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption text-muted-foreground">{now.toLocaleDateString(t.locale, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="truncate text-title">{greeting(t, name, now)}</h1>
        </div>
        <div className="flex items-center gap-1">
          <HeaderLink href="/transactions?search=1" label={t.in("home", "Search transactions")} icon={SearchIcon} />
          <HeaderLink href="/summary" label={t.in("home", "Summary")} icon={ChartColumnIcon} className="md:hidden" />
          <HeaderLink href="/settings" label={t.in("home", "Settings")} icon={SettingsIcon} className="md:hidden" />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Surface className="relative overflow-hidden p-5 md:p-6">
            <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand-600/25 blur-3xl" aria-hidden />
            <div className="relative flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-label text-text-secondary">{t.in("home", "Net worth · %@", overview.settings.principal)}</span>
                <Tooltip>
                  <TooltipTrigger
                    render={<Button variant="ghost" size="icon-sm" onClick={toggleHidden} aria-label={t.in("home", hidden ? "Shows balances" : "Hides balances")} />}
                  >
                    {hidden ? <EyeOffIcon /> : <EyeIcon />}
                  </TooltipTrigger>
                  <TooltipContent>{t.in("home", hidden ? "Shows balances" : "Hides balances")}</TooltipContent>
                </Tooltip>
              </div>
              <p className="text-display break-all">{hidden ? t.in("home", "Hidden") : formatMoney(overview.netWorth)}</p>
              {overview.netWorthInSecond && !hidden ? (
                <p className="text-body text-muted-foreground tabular-nums">
                  {t.in("home", "≈ %@ · rate %@", formatMoney(overview.netWorthInSecond, { fractionDigits: 0 }), formatRate(settingsRate(overview.settings)))}
                </p>
              ) : null}
              <p className="text-caption text-muted-foreground">
                {t.in("home", "%lld accounts", overview.accountCount)} · {t.in("home", "%lld cards", overview.cardCount)}
              </p>
            </div>
            <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <QuickAction icon={PlusIcon} label={t.in("home", "Expense")} onClick={() => openEditor({ mode: "create", type: "expense" })} primary />
              <QuickAction icon={ArrowDownLeftIcon} label={t.in("home", "action.income")} onClick={() => openEditor({ mode: "create", type: "income" })} />
              <QuickAction icon={ArrowLeftRightIcon} label={t.in("home", "Move")} onClick={() => openEditor({ mode: "create", type: "transfer" })} />
              <QuickAction icon={CreditCardIcon} label={t.in("home", "Pay card")} onClick={() => openEditor({ mode: "create", type: "cardPayment" })} disabled={!hasCredit} />
            </div>
          </Surface>

          {reminders.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {reminders.map((reminder) => (
                <Surface key={reminder.id} className="flex gap-3 p-4">
                  <IconBadge icon={reminder.icon} tone={reminder.tone} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-label">{reminder.title}</p>
                    <p className="text-caption text-muted-foreground">{reminder.body}</p>
                    {reminder.action ? (
                      <Button size="sm" variant="secondary" className="mt-1 self-start" onClick={reminder.action.run}>
                        {reminder.action.label}
                      </Button>
                    ) : null}
                  </div>
                </Surface>
              ))}
            </div>
          ) : null}

          <Surface>
            <SectionTitle title={t.in("home", "Recent")} href="/transactions" action={t.in("home", "See all")} />
            {overview.recent.length === 0 ? (
              <EmptyState icon={ReceiptIcon} title={t.in("home", "No transactions yet")} description={t.in("home", "Log your first expense, income or transfer and you will see your month here.")}>
                <Button onClick={() => openEditor()}>{t.in("home", "Log transaction")}</Button>
              </EmptyState>
            ) : (
              <div className="flex flex-col px-1 pb-2">
                {ledger.transactions
                  .filter((transaction) => transaction.status === "confirmed")
                  .slice(0, 8)
                  .map((transaction) => (
                    <TransactionRow key={transaction.id} transaction={transaction} display={display} onSelect={(tx) => showDetail(tx.id)} dateLabel={dayLabel(t, new Date(transaction.date), now)} />
                  ))}
              </div>
            )}
          </Surface>

          {overview.planned.length > 0 ? (
            <Surface>
              <SectionTitle title={t.in("home", "Drafts · %lld", overview.plannedSummary.count)} href="/transactions?filter=planned" action={t.in("home", "See all")} />
              <p className="px-4 pb-2 text-caption text-muted-foreground">{plannedCaption(t, overview, hidden)}</p>
              <div className="flex flex-col px-1 pb-2">
                {overview.planned.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    display={display}
                    onSelect={(tx) => showDetail(tx.id)}
                    dateLabel={dayLabel(t, new Date(transaction.date), now)}
                    trailing={
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          confirmPlannedTransaction(ledgerStore, transaction.id).catch(() => toast.add({ title: t.in("home", "We couldn't confirm it. Try again."), type: "error" }))
                        }}
                      >
                        {t.in("home", "Confirm")}
                      </Button>
                    }
                  />
                ))}
              </div>
            </Surface>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Surface className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-label text-text-secondary">{t.in("home", "Spent in %@", month)}</p>
                <p className="text-amount-lg">{money(overview.month.expense, 0)}</p>
                <p className="text-caption text-muted-foreground">
                  {overview.plannedSummary.count > 0 ? t.in("home", "spent · %lld drafts", overview.plannedSummary.count) : t.in("home", "spent")}
                </p>
              </div>
              {rate && rate.gt(0) ? <Badge className="bg-positive-tint text-positive">{t.in("home", "%@%% saved", formatNumber(rate.times(100), 0))}</Badge> : null}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniStat label={t.in("home", "Income")} value={money(overview.month.income, 0)} tone="positive" />
              <MiniStat label={t.in("home", "Expenses")} value={money(overview.month.expense, 0)} />
            </div>
            <MonthCategories ledger={ledger} overview={overview} hidden={hidden} />
          </Surface>

          <Surface>
            <SectionTitle title={t.in("accounts", "Accounts")} href="/accounts" action={t.in("home", "See all")} />
            <ul className="flex flex-col px-1 pb-2">
              {overview.balances.map(({ account, balance }) => (
                <li key={account.id}>
                  <Link href={`/accounts?id=${account.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-accent/60">
                    <span className="min-w-0 truncate text-label">{accountName(account)}</span>
                    <span className="text-label tabular-nums">{hidden ? MASK : formatMoney(balance)}</span>
                  </Link>
                </li>
              ))}
              {overview.cardDebt ? (
                <li>
                  <Link href="/accounts" className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-accent/60">
                    <span className="text-label text-text-secondary">{t.in("home", "Cards (debt)")}</span>
                    <span className="text-label text-negative tabular-nums">{hidden ? MASK : formatMoney(overview.cardDebt)}</span>
                  </Link>
                </li>
              ) : null}
            </ul>
          </Surface>

          <Surface className="p-4">
            <p className="mb-3 text-heading">{t.in("home", "Log quickly")}</p>
            <div className="grid grid-cols-3 gap-2">
              {overview.frequentExpenseCategoryIds.map((id) => {
                const category = ledger.categories.find((candidate) => candidate.id === id)
                if (!category) return null
                return (
                  <button
                    key={id}
                    type="button"
                    className="flex flex-col items-center gap-2 rounded-xl bg-secondary/60 px-2 py-3 transition-colors hover:bg-secondary"
                    onClick={() => openEditor({ mode: "create", type: "expense" })}
                  >
                    <CategoryBadge category={category} size="sm" />
                    <span className="w-full truncate text-center text-caption">{categoryName(t, category)}</span>
                  </button>
                )
              })}
            </div>
          </Surface>
        </aside>
      </div>
    </Page>
  )
}

function HeaderLink({ href, label, icon: Icon, className }: { href: string; label: string; icon: typeof SearchIcon; className?: string }) {
  return (
    <Button variant="ghost" size="icon" className={className} render={<Link href={href} aria-label={label} />}>
      <Icon />
    </Button>
  )
}

function QuickAction({ icon: Icon, label, onClick, primary, disabled }: { icon: typeof PlusIcon; label: string; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Button variant={primary ? "default" : "secondary"} className="h-11 justify-center gap-2" onClick={onClick} disabled={disabled}>
      <Icon data-icon="inline-start" />
      {label}
    </Button>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "positive" }) {
  return (
    <div className="rounded-xl bg-secondary/60 px-3 py-2">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className={cn("text-amount-sm", tone === "positive" && "text-positive")}>{value}</p>
    </div>
  )
}

function MonthCategories({ ledger, overview, hidden }: { ledger: Ledger; overview: HomeOverview; hidden: boolean }) {
  const t = useT()
  const top = overview.month.categories.slice(0, 4)
  if (top.length === 0) return null
  return (
    <ul className="mt-4 flex flex-col gap-2.5">
      {top.map((entry) => {
        const category = ledger.categories.find((candidate) => candidate.id === entry.categoryId)
        return (
          <li key={entry.categoryId} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-caption">
              <span className="truncate">{category ? categoryName(t, category) : entry.categoryId}</span>
              <span className="text-muted-foreground tabular-nums">{hidden ? MASK : formatAmount(entry.amount, overview.settings.principal, { fractionDigits: 0 })}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(2, Number(entry.share.times(100).toFixed(1)))}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
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
  icon: typeof BellIcon
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
      icon: CalendarClockIcon,
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
          icon: CreditCardIcon,
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
        icon: BellIcon,
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
      icon: CreditCardIcon,
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
