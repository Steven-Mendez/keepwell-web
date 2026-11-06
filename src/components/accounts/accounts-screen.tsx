"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { KWButton, KWCircleButton, KWEmptyState, KWLargeTitleHeader, KWSectionHeader } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { CardArt, Page } from "@/components/kw/primitives"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useLedger, usePreferredName, useTransactionDisplay } from "@/hooks/use-ledger"
import { accountsOverview, formatMoney, joinedMoney } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { accountName, cardKindLabel } from "@/lib/presentation/display"
import { cn } from "@/lib/utils"

import { AccountDetail } from "./account-detail"
import { useMediaQuery } from "./form-parts"

/**
 * Accounts (iOS AccountsView): credit cards, bank accounts and cash, each shown as its card. On a
 * wide screen the selected account opens beside the list (Revolut web's card panel); on a phone it
 * slides in as a sheet.
 */
export function AccountsScreen() {
  return (
    <Suspense fallback={null}>
      <Accounts />
    </Suspense>
  )
}

function Accounts() {
  const t = useT()
  const ledger = useLedger()
  const display = useTransactionDisplay(ledger)
  const owner = usePreferredName()
  const { openAddAccount } = useAppActions()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const isWide = useMediaQuery("(min-width: 1024px)")
  const requested = params.get("id") ?? undefined
  const [selected, setSelected] = useState<string | undefined>(requested)

  // A link (command palette, add card) can ask for an account by `?id=`.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is the source of the selection
    if (requested) setSelected(requested)
  }, [requested])

  const overview = useMemo(() => (ledger ? accountsOverview(ledger.accounts, ledger.cards, ledger.transactions, ledger.settings.currencies) : undefined), [ledger])

  const select = (id: string | undefined) => {
    setSelected(id)
    router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false })
  }

  // Wide screens always show a detail: the first account when none is chosen.
  const firstId = overview?.creditCards[0]?.account.id ?? overview?.deposits[0]?.account.id ?? overview?.cash[0]?.account.id
  const exists = selected !== undefined && ledger?.accounts.some((account) => account.id === selected)
  const current = exists ? selected : isWide ? firstId : undefined

  if (!ledger || !overview || !display) {
    return (
      <Page>
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="aspect-[1.586] rounded-2xl" />
          ))}
        </div>
      </Page>
    )
  }

  const holder = owner ? owner.toLocaleUpperCase(t.locale) : undefined
  const isEmpty = ledger.accounts.length === 0
  const add = () => openAddAccount()
  const detail = current ? <AccountDetail key={current} ledger={ledger} display={display} accountId={current} onDeleted={() => select(undefined)} /> : null

  return (
    <Page>
      <KWLargeTitleHeader
        title={t.in("accounts", "Accounts")}
        subtitle={<span className="tabular-nums">{t.in("accounts", "Net worth %@", formatMoney(overview.netWorth))}</span>}
        trailing={<KWCircleButton icon="plus" variant="white" label={t.in("accounts", "Add account or card")} onClick={add} />}
      />
      {isEmpty ? (
        <div className="rounded-2xl bg-card">
          <KWEmptyState
            icon="wallet"
            title={t.in("accounts", "Add account or card")}
            message={t.in("addcard", "Your bank account, shown as its card: balance, bank and last 4")}
            action={
              <KWButton icon="plus" onClick={add}>
                {t.in("accounts", "Add account or card")}
              </KWButton>
            }
          />
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)]">
          <div className="flex min-w-0 flex-col gap-8">
            <Group title={t.in("addcard", "Credit card")} hidden={overview.creditCards.length === 0}>
              {overview.creditCards.map(({ account, holder: plastic, balances }) => (
                <AccountTile
                  key={account.id}
                  isSelected={current === account.id}
                  onSelect={() => select(account.id)}
                  label={t.in("accounts", "%@ credit card, %@", accountName(account), joinedMoney(balances))}
                  art={<CardArt size="sm" color={plastic?.color} bank={account.bank ?? account.name} network={plastic?.network} lastFour={plastic?.lastFour} kind="creditHolder" kindLabel={cardKindLabel(t, "creditHolder")} holder={holder} />}
                  title={accountName(account)}
                  value={joinedMoney(balances)}
                  negative={balances.some((balance) => balance.amount.lt(0))}
                />
              ))}
            </Group>
            <Group title={t.in("accounts", "Bank account")} hidden={overview.deposits.length === 0}>
              {overview.deposits.map(({ account, debitCard, balance }) => (
                <AccountTile
                  key={account.id}
                  isSelected={current === account.id}
                  onSelect={() => select(account.id)}
                  label={
                    debitCard?.lastFour
                      ? t.in("accounts", "%@ debit card •••• %@, %@", accountName(account), debitCard.lastFour, formatMoney(balance))
                      : t.in("accounts", "%@ debit card, %@", accountName(account), formatMoney(balance))
                  }
                  art={<CardArt size="sm" color={debitCard?.color ?? "verde"} bank={account.bank ?? account.name} network={debitCard?.network} lastFour={debitCard?.lastFour} kind="debit" kindLabel={cardKindLabel(t, "debit")} holder={holder} />}
                  title={accountName(account)}
                  value={formatMoney(balance)}
                  negative={balance.amount.lt(0)}
                />
              ))}
            </Group>
            <Group title={t.in("accounts", "Cash")} hidden={overview.cash.length === 0}>
              {overview.cash.map(({ account, balance, principalEquivalent }) => (
                <AccountTile
                  key={account.id}
                  isSelected={current === account.id}
                  onSelect={() => select(account.id)}
                  label={t.in("accounts", "%@ cash, %@", account.name, formatMoney(balance))}
                  art={<CashArt name={account.name} />}
                  title={account.name}
                  value={formatMoney(balance)}
                  {...(principalEquivalent ? { secondary: `≈ ${formatMoney(principalEquivalent)}` } : {})}
                  negative={balance.amount.lt(0)}
                />
              ))}
            </Group>
          </div>
          {isWide ? (
            <aside className="sticky top-20 max-h-[calc(100svh-6rem)] overflow-y-auto rounded-2xl bg-nav p-5 ring-1 ring-divider">
              {detail ?? <p className="py-10 text-center type-body text-muted-foreground">{t.in("web", "Select an account to see its details.")}</p>}
            </aside>
          ) : null}
        </div>
      )}
      {!isWide ? (
        <Sheet open={current !== undefined} onOpenChange={(open) => !open && select(undefined)}>
          <SheetContent side="right" showCloseButton={false} className="w-full gap-5 overflow-y-auto border-l border-divider bg-nav p-5 data-[side=right]:sm:max-w-md">
            <SheetHeader className="flex-row items-center gap-3 p-0">
              <KWCircleButton icon="chevronLeft" label={t.in("web", "Back")} onClick={() => select(undefined)} />
              <SheetTitle className="min-w-0 truncate type-heading">{current ? accountName(ledger.accounts.find((account) => account.id === current) ?? { name: "" }) : ""}</SheetTitle>
            </SheetHeader>
            {detail}
          </SheetContent>
        </Sheet>
      ) : null}
    </Page>
  )
}

function Group({ title, hidden, children }: { title: string; hidden: boolean; children: ReactNode }) {
  if (hidden) return null
  return (
    <section className="flex flex-col gap-3">
      <KWSectionHeader title={title} style="large" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  )
}

function AccountTile({ art, title, value, secondary, negative, label, isSelected, onSelect }: { art: ReactNode; title: string; value: string; secondary?: string; negative: boolean; label: string; isSelected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-current={isSelected ? "true" : undefined}
      className={cn(
        "group flex flex-col gap-3 rounded-[22px] p-2 text-left transition-colors outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring",
        isSelected && "bg-card ring-1 ring-white/20",
      )}
    >
      <div className="transition-transform group-hover:-translate-y-0.5">{art}</div>
      <div className="flex items-baseline justify-between gap-2 px-1">
        <span className="truncate type-label">{title}</span>
        <span className="flex flex-col items-end">
          <span className={cn("type-label tabular-nums", negative && "text-negative")}>{value}</span>
          {secondary ? <span className="type-caption-sm text-muted-foreground tabular-nums">{secondary}</span> : null}
        </span>
      </div>
    </button>
  )
}

/** Cash has no plastic: a `surface` tile with the iOS cash glyph in the positive hue. */
function CashArt({ name }: { name: string }) {
  return (
    <div className="relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-[18px] bg-card p-3 ring-1 ring-divider">
      <span className="flex size-10 items-center justify-center rounded-full bg-positive-tint text-positive">
        <KWIcon name="cash" size={20} />
      </span>
      <span className="truncate type-label text-foreground">{name}</span>
    </div>
  )
}
