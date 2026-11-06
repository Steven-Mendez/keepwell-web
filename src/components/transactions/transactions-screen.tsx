"use client"

import { PlusIcon, ReceiptIcon, SearchIcon, XIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { FOCUS_SEARCH_EVENT } from "@/components/app/keyboard-shortcuts"
import { EmptyState, Page, PageHeader, Surface } from "@/components/kw/primitives"
import { TransactionRow } from "@/components/kw/transaction-row"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
      <PageHeader
        title={t.in("transactions", "Transactions")}
        actions={
          <Button onClick={() => openEditor(scopedAccount ? { mode: "create", accountId: scopedAccount.id } : undefined)}>
            <PlusIcon data-icon="inline-start" />
            {t.in("transactions", "New transaction")}
          </Button>
        }
      />

      {isEmpty ? (
        <Surface>
          <EmptyState icon={ReceiptIcon} title={t.in("transactions", "No transactions yet")} description={t.in("transactions", "Log your first expense, income or transfer and it shows up here.")}>
            <Button onClick={() => openEditor()}>{t.in("transactions", "Log transaction")}</Button>
          </EmptyState>
        </Surface>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <InputGroup className="h-10 lg:max-w-md">
              <InputGroupAddon>
                <SearchIcon />
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
                  <InputGroupButton size="icon-xs" onClick={() => setText("")} aria-label={t.in("transactions", "Clear search")}>
                    <XIcon />
                  </InputGroupButton>
                ) : (
                  <Kbd>/</Kbd>
                )}
              </InputGroupAddon>
            </InputGroup>
            <NativeSelect
              className="h-10 lg:w-64"
              value={scope.kind === "all" ? "" : scope.id}
              onChange={(event) => setScope(event.target.value ? { kind: "account", id: event.target.value } : { kind: "all" })}
              aria-label={t.in("transactions", "Show movements from")}
            >
              <NativeSelectOption value="">{t.in("transactions", "All accounts")}</NativeSelectOption>
              {options.map(({ account, card }) => (
                <NativeSelectOption key={account.id} value={account.id}>
                  {card && account.kind === "credit" ? `${accountName(account)} · ${cardShortName(t, card)}` : accountName(account)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <ToggleGroup
            value={[filter]}
            onValueChange={(value: string[]) => {
              const next = value[0] as TransactionFilter | undefined
              if (next) setFilter(next)
            }}
            variant="outline"
            className="flex-wrap"
          >
            {TRANSACTION_FILTERS.map((option) => (
              <ToggleGroupItem key={option} value={option} className="rounded-full px-4">
                {filterLabel(t, option)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {scopedAccount && scopedBalances ? (
            <Surface className="flex flex-wrap items-end justify-between gap-3 p-4">
              <div>
                <p className="text-label text-text-secondary">{t.in("transactions", scopedAccount.kind === "credit" ? "Current debt" : "Available balance")}</p>
                <p className="text-amount-lg">{formatMoney(netWorth(scopedBalances, ledger.settings.currencies))}</p>
                {scopedBalances.length > 1 ? <p className="text-caption text-muted-foreground tabular-nums">{joinedMoney(scopedBalances)}</p> : null}
              </div>
              <Button variant="ghost" onClick={() => setScope({ kind: "all" })}>
                {t.in("transactions", "Show all accounts")}
              </Button>
            </Surface>
          ) : null}

          {filter === "planned" ? <p className="text-caption text-muted-foreground">{t.in("transactions", "Drafts · they don't affect balances")}</p> : null}

          {groups.length === 0 ? (
            <Surface>
              <EmptyState icon={SearchIcon} title={text ? t.in("transactions", "Nothing matches. Try another word or filter.") : t.in("transactions", "No movements here yet.")} />
            </Surface>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map(([key, transactions]) => (
                <Surface key={key} className="p-1.5">
                  <h2 className="px-3 pt-2 pb-1 text-caption font-semibold text-muted-foreground">{dayLabel(t, new Date(transactions[0]!.date))}</h2>
                  {transactions.map((transaction) => (
                    <TransactionRow key={transaction.id} transaction={transaction} display={display} onSelect={(tx) => showDetail(tx.id)} isSelected={detailId === transaction.id} />
                  ))}
                </Surface>
              ))}
            </div>
          )}
        </>
      )}
    </Page>
  )
}
