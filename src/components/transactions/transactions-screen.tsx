"use client"

import { useMemo, useRef } from "react"

import { useAppActions } from "@/components/app/app-actions"
import {
  KWButton,
  KWCircleButton,
  KWEmptyState,
  KWLargeTitleHeader,
} from "@/components/kw/design"
import { AnimatedNumber } from "@/components/kw/animated-number"
import { Page } from "@/components/kw/primitives"
import { TransactionsSkeleton } from "@/components/kw/skeletons"
import { useLedger, useTransactionDisplay } from "@/hooks/use-ledger"
import {
  balanceOf,
  filterTransactions,
  netWorth,
  scopeOptions,
  searchedTag,
  type Ledger,
  type TransactionScope,
} from "@/lib/domain"
import {
  formatMoney,
  joinedMoney,
} from "@/lib/domain/format"
import { tagLabel } from "@/components/kw/tag-editor"
import { useT, type Translator } from "@/lib/i18n"
import type { Account } from "@/lib/schema"

import { MovementList } from "./movement-list"
import { groupByDay, movementTotals, newestFirst } from "./movement-totals"
import { TransactionFilters } from "./transaction-filters"
import {
  useRowKeyboardNavigation,
  useTransactionFilters,
} from "./use-transaction-filters"

/** The account the list is narrowed to, if any. */
function scopedAccountOf(ledger: Ledger, scope: TransactionScope) {
  return scope.kind === "account"
    ? ledger.accounts.find((account) => account.id === scope.id)
    : undefined
}

/** The scoped account's balance above its movements, with the way back to all accounts. */
function ScopedAccountCard({
  t,
  ledger,
  account,
  onShowAll,
}: {
  t: Translator
  ledger: Ledger
  account: Account
  onShowAll: () => void
}) {
  const balances = balanceOf(account, ledger.transactions)
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <p className="type-label font-normal text-muted-foreground">
          {account.kind === "credit"
            ? t.in("transactions", "Current debt")
            : t.in("transactions", "Available balance")}
        </p>
        <p className="type-amount-lg">
          <AnimatedNumber
            value={formatMoney(netWorth(balances, ledger.settings.currencies))}
          />
        </p>
        {balances.length > 1 ? (
          <p className="type-caption text-muted-foreground tabular-nums">
            {joinedMoney(balances)}
          </p>
        ) : null}
      </div>
      <KWButton variant="secondary" onClick={onShowAll}>
        {t.in("transactions", "Show all accounts")}
      </KWButton>
    </div>
  )
}

function NoTransactions({ t, onLog }: { t: Translator; onLog: () => void }) {
  return (
    <div className="rounded-2xl bg-card">
      <KWEmptyState
        icon="list"
        title={t.in("transactions", "No transactions yet")}
        message={t.in(
          "transactions",
          "Log your first expense, income or transfer and it shows up here."
        )}
        action={
          <KWButton icon="plus" shortcut="N" onClick={onLog}>
            {t.in("transactions", "Log transaction")}
          </KWButton>
        }
      />
    </div>
  )
}

function NoMatches({ t, searching }: { t: Translator; searching: boolean }) {
  return (
    <div className="rounded-2xl bg-card">
      <KWEmptyState
        icon="search"
        title={
          searching
            ? t.in(
                "transactions",
                "Nothing matches. Try another word or filter."
              )
            : t.in("transactions", "No movements here yet.")
        }
      />
    </div>
  )
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
  const { filter, setFilter, scope, setScope, text, setText, search } =
    useTransactionFilters()

  const filtered = useMemo(() => {
    if (!ledger || !display) return []
    return filterTransactions(
      newestFirst(ledger.transactions),
      { kind: filter, scope, text },
      (transaction) => display.searchableText(transaction)
    )
  }, [ledger, display, filter, scope, text])

  const principal = ledger?.settings.currencies.principal ?? "USD"
  const totals = useMemo(
    () => movementTotals(filtered, principal),
    [filtered, principal]
  )

  const list = useRef<HTMLDivElement>(null)
  useRowKeyboardNavigation(list)

  const groups = useMemo(() => groupByDay(filtered), [filtered])

  if (!ledger || !display) return <TransactionsSkeleton />

  const scopedAccount = scopedAccountOf(ledger, scope)
  const tag = searchedTag(text)

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

      {ledger.transactions.length === 0 ? (
        <NoTransactions t={t} onLog={() => openEditor()} />
      ) : (
        <>
          <TransactionFilters
            t={t}
            search={search}
            text={text}
            onTextChange={setText}
            options={scopeOptions(ledger.accounts, ledger.cards)}
            scope={scope}
            onScopeChange={setScope}
            filter={filter}
            onFilterChange={setFilter}
          />

          {scopedAccount ? (
            <ScopedAccountCard
              t={t}
              ledger={ledger}
              account={scopedAccount}
              onShowAll={() => setScope({ kind: "all" })}
            />
          ) : null}

          {filter === "planned" ? (
            <p className="type-caption text-muted-foreground">
              {t.in("transactions", "Drafts · they don't affect balances")}
            </p>
          ) : null}

          {tag ? (
            // A tag search totals that tag over all time, like iOS's tag totals: a trip or a
            // wedding rarely fits in one month.
            <p className="type-label text-muted-foreground">
              {t.in("transactions", "%@ · All time", tagLabel(tag))}
            </p>
          ) : null}

          {groups.length === 0 ? (
            <NoMatches t={t} searching={text !== ""} />
          ) : (
            <MovementList
              t={t}
              list={list}
              viewKey={`${filter}|${scope.kind === "account" ? scope.id : "all"}|${text}`}
              groups={groups}
              totals={totals}
              principal={principal}
              count={filtered.length}
              display={display}
              detailId={detailId}
              onSelect={(id) => showDetail(id)}
            />
          )}
        </>
      )}
    </Page>
  )
}
