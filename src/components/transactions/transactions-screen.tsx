"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { FOCUS_SEARCH_EVENT } from "@/components/app/keyboard-shortcuts"
import { OptionSelect } from "@/components/kw/pickers"
import {
  KWButton,
  KWChip,
  KWCircleButton,
  KWEmptyState,
  KWLargeTitleHeader,
  KWSectionHeader,
} from "@/components/kw/design"
import { AnimatedNumber } from "@/components/kw/animated-number"
import { AnimatedList, ListItem } from "@/components/kw/motion"
import { KWIcon } from "@/components/kw/kw-icon"
import { Page } from "@/components/kw/primitives"
import { TransactionRow } from "@/components/kw/transaction-row"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { TransactionsSkeleton } from "@/components/kw/skeletons"
import { useLedger, useTransactionDisplay } from "@/hooks/use-ledger"
import {
  Decimal,
  TRANSACTION_FILTERS,
  amountIn,
  balanceOf,
  dayKey,
  filterTransactions,
  formatMoney,
  joinedMoney,
  netWorth,
  scopeOptions,
  type TransactionFilter,
  type TransactionScope,
} from "@/lib/domain"
import { useT, type Translator } from "@/lib/i18n"
import {
  accountName,
  cardShortName,
  dayLabel,
} from "@/lib/presentation/display"
import type { Transaction } from "@/lib/schema"
import { cn } from "@/lib/utils"

function filterLabel(t: Translator, filter: TransactionFilter): string {
  const keys: Record<TransactionFilter, string> = {
    all: "All",
    expense: "Expenses",
    income: "Income",
    transfer: "Transfers",
    planned: "Drafts",
  }
  return t.in("transactions", keys[filter])
}

/**
 * Every movement, newest first and grouped by day (iOS TransactionsView), narrowed by kind chips,
 * one account and a search over description, note, category and method. Selecting one opens its
 * detail panel.
 */
export function TransactionsScreen() {
  const t = useT()
  const ledger = useLedger()
  const display = useTransactionDisplay(ledger)
  const { openEditor, showDetail, detailId } = useAppActions()
  const [filter, setFilter] = useState<TransactionFilter>("all")
  const [scope, setScope] = useState<TransactionScope>({ kind: "all" })
  const [text, setText] = useState("")
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Deep links from home ("See all" drafts, the search button) and the "/" shortcut.
    const params = new URLSearchParams(window.location.search)
    const requested = params.get("filter")
    if (
      requested &&
      (TRANSACTION_FILTERS as readonly string[]).includes(requested)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is only readable after hydration
      setFilter(requested as TransactionFilter)
    }
    const account = params.get("account")
    if (account) setScope({ kind: "account", id: account })
    if (params.has("search")) search.current?.focus()
    const focus = () => search.current?.focus()
    window.addEventListener(FOCUS_SEARCH_EVENT, focus)
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focus)
  }, [])

  // The filters live in the URL, so a reload, the back button or a shared link keep them. Written
  // with history.replaceState, which Next's router picks up without re-rendering the route.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (filter === "all") params.delete("filter")
    else params.set("filter", filter)
    if (scope.kind === "account") params.set("account", scope.id)
    else params.delete("account")
    params.delete("search")
    const query = params.toString()
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`
    if (url !== `${window.location.pathname}${window.location.search}`)
      window.history.replaceState(null, "", url)
  }, [filter, scope])

  const filtered = useMemo(() => {
    if (!ledger || !display) return []
    const sorted = [...ledger.transactions].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0
    )
    return filterTransactions(
      sorted,
      { kind: filter, scope, text },
      (transaction) => display.searchableText(transaction)
    )
  }, [ledger, display, filter, scope, text])

  const principal = ledger?.settings.currencies.principal ?? "USD"
  const totals = useMemo(
    () => movementTotals(filtered, principal),
    [filtered, principal]
  )

  // j / k (or ↓ / ↑ once a row has focus) walk the list and Enter opens the movement: Linear-style
  // keyboard triage on desktop.
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          "input, textarea, select, [contenteditable], [role=dialog]"
        )
      )
        return
      const rows = [
        ...(list.current?.querySelectorAll<HTMLElement>(
          "[data-movement-row]"
        ) ?? []),
      ]
      if (rows.length === 0) return
      const inList = target ? rows.indexOf(target) : -1
      const forward =
        event.key === "j" || (inList >= 0 && event.key === "ArrowDown")
      const backward =
        event.key === "k" || (inList >= 0 && event.key === "ArrowUp")
      if (!forward && !backward) return
      event.preventDefault()
      const next =
        inList < 0
          ? forward
            ? 0
            : rows.length - 1
          : Math.min(rows.length - 1, Math.max(0, inList + (forward ? 1 : -1)))
      rows[next]?.focus()
      rows[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const groups = useMemo(() => {
    const byDay = new Map<string, Transaction[]>()
    for (const transaction of filtered) {
      const key = dayKey(new Date(transaction.date))
      byDay.set(key, [...(byDay.get(key) ?? []), transaction])
    }
    return [...byDay.entries()]
  }, [filtered])

  if (!ledger || !display) return <TransactionsSkeleton />

  const options = scopeOptions(ledger.accounts, ledger.cards)
  const scopedAccount =
    scope.kind === "account"
      ? ledger.accounts.find((account) => account.id === scope.id)
      : undefined
  const scopedBalances = scopedAccount
    ? balanceOf(scopedAccount, ledger.transactions)
    : undefined
  const isEmpty = ledger.transactions.length === 0

  return (
    <Page>
      <KWLargeTitleHeader
        title={t.in("transactions", "Transactions")}
        trailing={
          <KWCircleButton
            icon="plus"
            variant="white"
            label={t.in("transactions", "New transaction")}
            shortcut="N"
            onClick={() =>
              openEditor(
                scopedAccount
                  ? { mode: "create", accountId: scopedAccount.id }
                  : undefined
              )
            }
          />
        }
      />

      {isEmpty ? (
        <div className="rounded-2xl bg-card">
          <KWEmptyState
            icon="list"
            title={t.in("transactions", "No transactions yet")}
            message={t.in(
              "transactions",
              "Log your first expense, income or transfer and it shows up here."
            )}
            action={
              <KWButton icon="plus" shortcut="N" onClick={() => openEditor()}>
                {t.in("transactions", "Log transaction")}
              </KWButton>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <InputGroup className="rounded-full border-transparent bg-card lg:max-w-md">
              <InputGroupAddon className="pl-3.5 text-muted-foreground">
                <KWIcon name="search" size={18} />
              </InputGroupAddon>
              <InputGroupInput
                ref={search}
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setText("")
                    event.currentTarget.blur()
                  }
                }}
                placeholder={t.in(
                  "transactions",
                  "Search merchant, note or category"
                )}
                aria-label={t.in("transactions", "Search")}
              />
              <InputGroupAddon align="inline-end">
                {text ? (
                  <button
                    type="button"
                    className="mr-1 flex size-8 items-center justify-center rounded-full bg-secondary text-text-secondary hover:text-foreground"
                    onClick={() => setText("")}
                    aria-label={t.in("transactions", "Clear search")}
                  >
                    <KWIcon name="close" size={14} />
                  </button>
                ) : (
                  <Kbd className="mr-1.5">/</Kbd>
                )}
              </InputGroupAddon>
            </InputGroup>
            <OptionSelect
              className="rounded-full border-transparent bg-card lg:w-72"
              value={scope.kind === "all" ? "" : scope.id}
              onChange={(value) =>
                setScope(
                  value ? { kind: "account", id: value } : { kind: "all" }
                )
              }
              aria-label={t.in("transactions", "Show movements from")}
              options={[
                { value: "", label: t.in("transactions", "All accounts") },
                ...options.map(({ account, card }) => ({
                  value: account.id,
                  label:
                    card && account.kind === "credit"
                      ? `${accountName(account)} · ${cardShortName(t, card)}`
                      : accountName(account),
                })),
              ]}
            />
          </div>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={t.in("transactions", "Transactions")}
          >
            {TRANSACTION_FILTERS.map((option) => (
              <KWChip
                key={option}
                pillId="transactions-filter"
                selected={filter === option}
                onClick={() => setFilter(option)}
              >
                {filterLabel(t, option)}
              </KWChip>
            ))}
          </div>

          {scopedAccount && scopedBalances ? (
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-card p-[18px]">
              <div className="flex flex-col gap-0.5">
                <p className="type-label font-normal text-muted-foreground">
                  {t.in(
                    "transactions",
                    scopedAccount.kind === "credit"
                      ? "Current debt"
                      : "Available balance"
                  )}
                </p>
                <p className="type-amount-lg">
                  <AnimatedNumber
                    value={formatMoney(
                      netWorth(scopedBalances, ledger.settings.currencies)
                    )}
                  />
                </p>
                {scopedBalances.length > 1 ? (
                  <p className="type-caption text-muted-foreground tabular-nums">
                    {joinedMoney(scopedBalances)}
                  </p>
                ) : null}
              </div>
              <KWButton
                variant="secondary"
                onClick={() => setScope({ kind: "all" })}
              >
                {t.in("transactions", "Show all accounts")}
              </KWButton>
            </div>
          ) : null}

          {filter === "planned" ? (
            <p className="type-caption text-muted-foreground">
              {t.in("transactions", "Drafts · they don't affect balances")}
            </p>
          ) : null}

          {groups.length === 0 ? (
            <div className="rounded-2xl bg-card">
              <KWEmptyState
                icon="search"
                title={
                  text
                    ? t.in(
                        "transactions",
                        "Nothing matches. Try another word or filter."
                      )
                    : t.in("transactions", "No movements here yet.")
                }
              />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Mobbin (Copilot, Mercury): what the filtered list adds up to, above the list. */}
              <TotalsStrip
                t={t}
                totals={totals}
                principal={principal}
                count={filtered.length}
              />
              {/* A new filter, account or search swaps the whole list in one quick fade; within one view,
                  movements logged or deleted grow in and collapse out row by row. */}
              <div
                ref={list}
                key={`${filter}|${scope.kind === "account" ? scope.id : "all"}|${text}`}
                className="flex animate-fade-in flex-col"
              >
                {/* No gap: each day carries its own bottom space, so a day collapsing takes its gap with it. */}
                <div
                  className="mb-4 hidden items-center gap-3 px-5 type-caption text-text-faint lg:flex"
                  aria-hidden
                >
                  <span className="w-10 shrink-0" />
                  <span className="flex-1">
                    {t.in("web", "column.description")}
                  </span>
                  <span className="w-44 shrink-0">
                    {t.in("web", "column.category")}
                  </span>
                  <span className="hidden w-44 shrink-0 xl:block">
                    {t.in("web", "column.account")}
                  </span>
                  <span className="w-36 shrink-0 text-right">
                    {t.in("web", "column.amount")}
                  </span>
                </div>
                <AnimatedList>
                  {groups.map(([key, transactions]) => {
                    const net = dayNet(transactions, principal)
                    return (
                      <ListItem key={key}>
                        <section className="flex flex-col gap-2 pb-4">
                          {/* Day headers stay pinned under the top bar while their movements scroll (Monarch). */}
                          <div className="sticky top-16 z-[5] -mx-1 flex items-baseline justify-between gap-2 bg-background/85 px-2 py-1.5 backdrop-blur-xl">
                            <KWSectionHeader
                              title={dayLabel(
                                t,
                                new Date(transactions[0]!.date)
                              )}
                              className="px-0"
                            />
                            {net && !net.isZero() ? (
                              <span
                                className={cn(
                                  "type-caption font-semibold tabular-nums",
                                  net.gt(0)
                                    ? "text-positive"
                                    : "text-text-secondary"
                                )}
                              >
                                {formatMoney(
                                  { amount: net, currency: principal },
                                  { sign: "always" }
                                )}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card">
                            <AnimatedList>
                              {transactions.map((transaction) => (
                                <TransactionRow
                                  key={transaction.id}
                                  columns
                                  transaction={transaction}
                                  display={display}
                                  onSelect={(tx) => showDetail(tx.id)}
                                  isSelected={detailId === transaction.id}
                                />
                              ))}
                            </AnimatedList>
                          </div>
                        </section>
                      </ListItem>
                    )
                  })}
                </AnimatedList>
              </div>
            </div>
          )}
        </>
      )}
    </Page>
  )
}

interface MovementTotals {
  moneyIn: Decimal
  moneyOut: Decimal
}

/** Confirmed income and spending in the principal currency; transfers and drafts don't count, as in iOS summaries. */
function movementTotals(
  transactions: readonly Transaction[],
  principal: string
): MovementTotals {
  let moneyIn = new Decimal(0)
  let moneyOut = new Decimal(0)
  for (const transaction of transactions) {
    if (transaction.status !== "confirmed" || transaction.kind === "transfer")
      continue
    const amount = amountIn(transaction, principal)
    if (transaction.kind === "income") moneyIn = moneyIn.plus(amount)
    else moneyOut = moneyOut.plus(amount)
  }
  return { moneyIn, moneyOut }
}

function dayNet(
  transactions: readonly Transaction[],
  principal: string
): Decimal | undefined {
  const { moneyIn, moneyOut } = movementTotals(transactions, principal)
  return moneyIn.minus(moneyOut)
}

function TotalsStrip({
  t,
  totals,
  principal,
  count,
}: {
  t: Translator
  totals: MovementTotals
  principal: string
  count: number
}) {
  const net = totals.moneyIn.minus(totals.moneyOut)
  const cells: { label: string; value: string; tone?: string }[] = [
    { label: t.in("web", "Movements"), value: String(count) },
    {
      label: t.in("web", "Money in"),
      value: formatMoney({ amount: totals.moneyIn, currency: principal }),
      tone: "text-positive",
    },
    {
      label: t.in("web", "Money out"),
      value: formatMoney({ amount: totals.moneyOut, currency: principal }),
      tone: "text-negative",
    },
    {
      label: t.in("web", "Net"),
      value: formatMoney(
        { amount: net, currency: principal },
        { sign: "always" }
      ),
    },
  ]
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-divider sm:grid-cols-4">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="flex flex-col gap-0.5 bg-card px-4 py-3"
        >
          <dt className="type-caption text-muted-foreground">{cell.label}</dt>
          <dd>
            <AnimatedNumber
              value={cell.value}
              className={cn("type-amount-sm", cell.tone)}
            />
          </dd>
        </div>
      ))}
    </dl>
  )
}
