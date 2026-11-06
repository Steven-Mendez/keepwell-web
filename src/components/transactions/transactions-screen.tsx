"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { FOCUS_SEARCH_EVENT } from "@/components/app/keyboard-shortcuts"
import { OptionSelect } from "@/components/kw/pickers"
import { KWButton, KWChip, KWCircleButton, KWEmptyState, KWLargeTitleHeader, KWSectionHeader } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { Page } from "@/components/kw/primitives"
import { TransactionRow } from "@/components/kw/transaction-row"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { useLedger, useTransactionDisplay } from "@/hooks/use-ledger"
import {
  TRANSACTION_FILTERS,
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
import { accountName, cardShortName, dayLabel } from "@/lib/presentation/display"
import type { Transaction } from "@/lib/schema"

function filterLabel(t: Translator, filter: TransactionFilter): string {
  const keys: Record<TransactionFilter, string> = { all: "All", expense: "Expenses", income: "Income", transfer: "Transfers", planned: "Drafts" }
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
    if (requested && (TRANSACTION_FILTERS as readonly string[]).includes(requested)) {
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

  const filtered = useMemo(() => {
    if (!ledger || !display) return []
    const sorted = [...ledger.transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    return filterTransactions(sorted, { kind: filter, scope, text }, (transaction) => display.searchableText(transaction))
  }, [ledger, display, filter, scope, text])

  const groups = useMemo(() => {
    const byDay = new Map<string, Transaction[]>()
    for (const transaction of filtered) {
      const key = dayKey(new Date(transaction.date))
      byDay.set(key, [...(byDay.get(key) ?? []), transaction])
    }
    return [...byDay.entries()]
  }, [filtered])

  if (!ledger || !display) return <Page aria-busy />

  const options = scopeOptions(ledger.accounts, ledger.cards)
  const scopedAccount = scope.kind === "account" ? ledger.accounts.find((account) => account.id === scope.id) : undefined
  const scopedBalances = scopedAccount ? balanceOf(scopedAccount, ledger.transactions) : undefined
  const isEmpty = ledger.transactions.length === 0

  return (
    <Page>
      <KWLargeTitleHeader
        title={t.in("transactions", "Transactions")}
        trailing={<KWCircleButton icon="plus" variant="white" label={t.in("transactions", "New transaction")} shortcut="N" onClick={() => openEditor(scopedAccount ? { mode: "create", accountId: scopedAccount.id } : undefined)} />}
      />

      {isEmpty ? (
        <div className="rounded-2xl bg-card">
          <KWEmptyState
            icon="list"
            title={t.in("transactions", "No transactions yet")}
            message={t.in("transactions", "Log your first expense, income or transfer and it shows up here.")}
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
                placeholder={t.in("transactions", "Search merchant, note or category")}
                aria-label={t.in("transactions", "Search")}
              />
              <InputGroupAddon align="inline-end">
                {text ? (
                  <button type="button" className="mr-1 flex size-8 items-center justify-center rounded-full bg-secondary text-text-secondary hover:text-foreground" onClick={() => setText("")} aria-label={t.in("transactions", "Clear search")}>
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
              onChange={(value) => setScope(value ? { kind: "account", id: value } : { kind: "all" })}
              aria-label={t.in("transactions", "Show movements from")}
              options={[
                { value: "", label: t.in("transactions", "All accounts") },
                ...options.map(({ account, card }) => ({ value: account.id, label: card && account.kind === "credit" ? `${accountName(account)} · ${cardShortName(t, card)}` : accountName(account) })),
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t.in("transactions", "Transactions")}>
            {TRANSACTION_FILTERS.map((option) => (
              <KWChip key={option} selected={filter === option} onClick={() => setFilter(option)}>
                {filterLabel(t, option)}
              </KWChip>
            ))}
          </div>

          {scopedAccount && scopedBalances ? (
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-card p-[18px]">
              <div className="flex flex-col gap-0.5">
                <p className="type-label font-normal text-muted-foreground">{t.in("transactions", scopedAccount.kind === "credit" ? "Current debt" : "Available balance")}</p>
                <p className="type-amount-lg">{formatMoney(netWorth(scopedBalances, ledger.settings.currencies))}</p>
                {scopedBalances.length > 1 ? <p className="type-caption text-muted-foreground tabular-nums">{joinedMoney(scopedBalances)}</p> : null}
              </div>
              <KWButton variant="secondary" onClick={() => setScope({ kind: "all" })}>
                {t.in("transactions", "Show all accounts")}
              </KWButton>
            </div>
          ) : null}

          {filter === "planned" ? <p className="type-caption text-muted-foreground">{t.in("transactions", "Drafts · they don't affect balances")}</p> : null}

          {groups.length === 0 ? (
            <div className="rounded-2xl bg-card">
              <KWEmptyState icon="search" title={text ? t.in("transactions", "Nothing matches. Try another word or filter.") : t.in("transactions", "No movements here yet.")} />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map(([key, transactions]) => (
                <section key={key} className="flex flex-col gap-2">
                  <KWSectionHeader title={dayLabel(t, new Date(transactions[0]!.date))} />
                  <div className="rounded-2xl bg-card p-1.5">
                    {transactions.map((transaction) => (
                      <TransactionRow key={transaction.id} transaction={transaction} display={display} onSelect={(tx) => showDetail(tx.id)} isSelected={detailId === transaction.id} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </Page>
  )
}
