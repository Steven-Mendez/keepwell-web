import {
  orderedLoans,
  budgetStatuses,
  compareMonths,
  confirmPlannedTransaction,
  formatAmount,
  formatMoney,
  monthlySummary,
  nextOccurrence,
  startOfDay,
  upcoming,
  yearMonthContaining,
  type HomeOverview,
  type Ledger,
} from "@/lib/domain"
import type { KWIconName } from "@/components/kw/kw-icon-data"
import { BALANCE_MASK } from "@/hooks/use-hidden-balances"
import type { Translator } from "@/lib/i18n"
import {
  accountName,
  cardShortName,
  categoryNameById,
} from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"
import type { Account } from "@/lib/schema"

export interface Reminder {
  id: string
  icon: KWIconName
  tone: "pending" | "accent" | "negative"
  title: string
  body: string
  action?: { label: string; run: () => void }
}

/**
 * What iOS sends as notifications, shown in place on the web: drafts due today, card payments
 * and loan installments within the reminder window (an installment past its day stays until paid),
 * statements closing today, subscriptions renewing tomorrow and plastics expiring this month. Budgets
 * warn from 80% of the month's limit and again once it's spent, and subscriptions whose latest charge
 * cost more than the one before say so.
 *
 * With balances hidden every amount in a reminder is masked; the reminder itself stays, like the
 * budget and price alerts on iOS, since knowing something is due isn't the sensitive part.
 */
export function homeReminders(
  t: Translator,
  ledger: Ledger,
  overview: HomeOverview,
  now: Date,
  hidden: boolean
): Reminder[] {
  const amount = (
    value: Parameters<typeof formatAmount>[0],
    currency: string
  ) => (hidden ? BALANCE_MASK : formatAmount(value, currency))
  const money = (value: Parameters<typeof formatMoney>[0]) =>
    hidden ? BALANCE_MASK : formatMoney(value)
  const today = startOfDay(now).getTime()
  const endOfToday = today + 86_400_000
  const display = (account: Account) => {
    const holder = ledger.cards.find(
      (card) => card.accountId === account.id && card.kind === "creditHolder"
    )
    return holder ? cardShortName(t, holder) : accountName(account)
  }
  const reminders: Reminder[] = []
  const cardsByID = new Map(ledger.cards.map((card) => [card.id, card]))
  const accountsByID = new Map(
    ledger.accounts.map((account) => [account.id, account])
  )
  for (const transaction of overview.planned) {
    if (new Date(transaction.date).getTime() >= endOfToday) continue
    const card = transaction.cardId
      ? cardsByID.get(transaction.cardId)
      : undefined
    const account = accountsByID.get(transaction.accountId)
    const method = card
      ? cardShortName(t, card)
      : account
        ? accountName(account)
        : ""
    reminders.push({
      id: `planned-${transaction.id}`,
      icon: "clock",
      tone: "pending",
      title: t.in("home", "Draft for today"),
      body: t.in(
        "home",
        "%@ · %@ from %@. Has it been paid?",
        transaction.description,
        amount(transaction.amount, transaction.currency),
        method
      ),
      action: {
        label: t.in("home", "Confirm"),
        run: () => void confirmPlannedTransaction(ledgerStore, transaction.id),
      },
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
          title: t.in(
            "home",
            "%@: payment in %lld days",
            display(account),
            days
          ),
          body: t.in(
            "home",
            "Pay before day %lld so it doesn't generate interest.",
            dueDay
          ),
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
        body: t.in(
          "home",
          "From tomorrow, purchases go to next month's statement."
        ),
      })
    }
  }
  for (const progress of orderedLoans(ledger.loans, now)) {
    const next = progress.next
    if (!next) continue
    const days = Math.round(
      (startOfDay(next.dueDate).getTime() - today) / 86_400_000
    )
    if (days > overview.paymentReminderDaysBefore) continue
    const { loan } = progress
    reminders.push({
      id: `installment-${loan.id}-${next.number}`,
      icon: "cash",
      tone: days < 0 ? "negative" : "pending",
      title:
        days < 0
          ? t.in("web", "%@: installment overdue", loan.name)
          : t.in("home", "%@: installment in %lld days", loan.name, days),
      body: t.in(
        "home",
        "Installment %lld of %lld · %@",
        next.number,
        loan.installmentCount,
        amount(loan.installmentAmount, loan.borrowed.currency)
      ),
    })
  }
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  ).toDateString()
  for (const { rule, date } of upcoming(ledger.recurringRules, now, 1)) {
    if (!rule.isSubscription || date.toDateString() !== tomorrow) continue
    const card = rule.cardId ? cardsByID.get(rule.cardId) : undefined
    const account = accountsByID.get(rule.accountId)
    const method =
      card && card.kind !== "transfer"
        ? cardShortName(t, card)
        : account
          ? accountName(account)
          : ""
    reminders.push({
      id: `renews-${rule.id}`,
      icon: "subscription",
      tone: "accent",
      title: t.in("web", "%@ renews tomorrow", rule.name),
      body: t.in("web", "%@ on %@", amount(rule.amount, rule.currency), method),
    })
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
          ? t.in(
              "home",
              "Update it wherever it's saved before it stops working."
            )
          : t.in(
              "home",
              "Update it in %@ before it stops working.",
              new Intl.ListFormat(t.locale, { type: "conjunction" }).format(
                services
              )
            ),
    })
  }
  reminders.push(...budgetReminders(t, ledger, now, hidden))
  for (const increase of overview.priceIncreases) {
    reminders.push({
      id: `price-${increase.transactionId}`,
      icon: "subscription",
      tone: "pending",
      title: t.in("home", "%@ went up in price", increase.name.trim()),
      body: t.in(
        "home",
        "Now %@, before %@.",
        money(increase.current),
        money(increase.previous)
      ),
    })
  }
  return reminders
}

function budgetReminders(
  t: Translator,
  ledger: Ledger,
  now: Date,
  hidden: boolean
): Reminder[] {
  const currency = ledger.settings.currencies.principal
  const summary = monthlySummary(
    yearMonthContaining(now),
    ledger.transactions,
    currency
  )
  const byId = new Map(
    ledger.categories.map((category) => [category.id, category])
  )
  return budgetStatuses(summary, ledger.categories)
    .filter((status) => status.level !== "onTrack")
    .map((status) => {
      const name = categoryNameById(
        t,
        byId.get(status.categoryId),
        status.categoryId
      )
      const exceeded = status.level === "exceeded"
      return {
        id: `budget-${status.categoryId}`,
        icon: "chartBars",
        tone: exceeded ? "negative" : "pending",
        title: exceeded
          ? t.in("home", "%@ went over its budget", name)
          : t.in("home", "%@ is close to its budget", name),
        body: t.in(
          "home",
          "%@ spent of %@ this month.",
          hidden ? BALANCE_MASK : formatAmount(status.spent, currency),
          hidden ? BALANCE_MASK : formatAmount(status.budget, currency)
        ),
      } satisfies Reminder
    })
}
