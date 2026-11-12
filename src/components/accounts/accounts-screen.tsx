"use client"

import { AnimatePresence, m } from "motion/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { AnimatedNumber } from "@/components/kw/animated-number"
import {
  KWButton,
  KWChip,
  KWCircleButton,
  KWEmptyState,
  KWLargeTitleHeader,
} from "@/components/kw/design"
import { CardArt, Page } from "@/components/kw/primitives"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { AccountsSkeleton } from "@/components/kw/skeletons"
import {
  useLedger,
  usePreferredName,
  useTransactionDisplay,
} from "@/hooks/use-ledger"
import {
  accountsOverview,
  type AccountsOverview,
  type Ledger,
} from "@/lib/domain"
import {
  formatMoney,
  joinedMoney,
} from "@/lib/domain/format"
import { useT, type Translator } from "@/lib/i18n"
import { accountName, cardKindLabel } from "@/lib/presentation/display"
import { DURATION, EASE_OUT_IOS } from "@/lib/motion"

import { AccountDetail } from "./account-detail"
import { useMediaQuery } from "./form-parts"
import { WalletStack, type WalletEntry } from "./wallet-stack"

type Kind = "debit" | "credit" | "cash"
type Filter = "all" | Kind

/**
 * Accounts as a wallet (iOS AccountsView): every card the person carries in one Wallet-style deck,
 * with chips to show one kind. On a wide screen the whole page fits the window, no scrolling: the
 * deck on the left squeezes its strips to fit, and the chosen card's detail sits beside it in a
 * panel whose tabs keep it short (Mobbin: Revolut web's card panel, Airwallex's card details). On a
 * phone the deck scrolls like iOS and a card opens as a sheet.
 */
export function AccountsScreen() {
  return (
    <Suspense fallback={null}>
      <Accounts />
    </Suspense>
  )
}

/** iOS AccountsViewModel.allCards: back to front, debit, then credit, then cash in front, where the hand reaches it. */
function walletCards(
  t: Translator,
  overview: AccountsOverview,
  holder: string | undefined
): WalletCard[] {
  const debit = overview.deposits.map(({ account, debitCard, balance }) => ({
    id: account.id,
    kind: "debit" as const,
    label: debitCard?.lastFour
      ? t.in(
          "accounts",
          "%@ debit card •••• %@, %@",
          accountName(account),
          debitCard.lastFour,
          formatMoney(balance)
        )
      : t.in(
          "accounts",
          "%@ debit card, %@",
          accountName(account),
          formatMoney(balance)
        ),
    art: (
      <CardArt
        color={debitCard?.color ?? "verde"}
        bank={account.bank ?? account.name}
        network={debitCard?.network}
        lastFour={debitCard?.lastFour}
        kind="debit"
        kindLabel={cardKindLabel(t, "debit")}
        holder={holder}
        badge={formatMoney(balance)}
        // The account's own name when the bank already heads the card, so it isn't lost.
        caption={account.bank ? account.name : undefined}
      />
    ),
  }))
  const credit = overview.creditCards.map(
    ({ account, holder: plastic, balances }) => ({
      id: account.id,
      kind: "credit" as const,
      label: t.in(
        "accounts",
        "%@ credit card, %@",
        accountName(account),
        joinedMoney(balances)
      ),
      art: (
        <CardArt
          color={plastic?.color}
          bank={account.bank ?? account.name}
          network={plastic?.network}
          lastFour={plastic?.lastFour}
          kind="creditHolder"
          kindLabel={cardKindLabel(t, "creditHolder")}
          holder={holder}
          badge={joinedMoney(balances)}
          caption={account.bank ? account.name : undefined}
        />
      ),
    })
  )
  const cash = overview.cash.map(
    ({ account, balance, principalEquivalent }) => ({
      id: account.id,
      kind: "cash" as const,
      label: t.in(
        "accounts",
        "%@ cash, %@",
        account.name,
        formatMoney(balance)
      ),
      art: (
        <CardArt
          color="lima"
          bank={account.name}
          kind="debit"
          kindLabel={t.in("accounts", "Cash")}
          showsChip={false}
          badge={formatMoney(balance)}
          caption={
            principalEquivalent
              ? `≈ ${formatMoney(principalEquivalent)}`
              : undefined
          }
        />
      ),
    })
  )
  return [...debit, ...credit, ...cash]
}

type WalletCard = WalletEntry & { kind: Kind }

/**
 * The chips and the cards they show. Only the kinds the person has, so no chip empties the
 * wallet; no chips at all with a single kind.
 */
function walletFilter(all: WalletCard[], filter: Filter) {
  const kinds = (["debit", "credit", "cash"] as const).filter((kind) =>
    all.some((card) => card.kind === kind)
  )
  const filters: Filter[] = kinds.length > 1 ? ["all", ...kinds] : []
  const shownFilter = filters.includes(filter) ? filter : "all"
  const cards =
    shownFilter === "all"
      ? all
      : all.filter((card) => card.kind === shownFilter)
  return { filters, shownFilter, cards }
}

/** The chosen account, kept in `?id=` so a link (command palette, add card) can ask for one. */
function useSelectedAccount() {
  const router = useRouter()
  const params = useSearchParams()
  const requested = params.get("id") ?? undefined
  const [selected, setSelected] = useState<string | undefined>(requested)

  // A link (command palette, add card) can ask for an account by `?id=`.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is the source of the selection
    if (requested) setSelected(requested)
  }, [requested])

  const select = (id: string | undefined) => {
    setSelected(id)
    // Read on click rather than with usePathname, which would redraw the screen on every navigation.
    const { pathname } = window.location
    router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false })
  }
  return [selected, select] as const
}

/** Every card of the wallet, back to front, once the ledger has loaded. */
function useWalletCards(ledger: Ledger | undefined) {
  const t = useT()
  const owner = usePreferredName()
  const overview = useMemo(
    () =>
      ledger
        ? accountsOverview(
            ledger.accounts,
            ledger.cards,
            ledger.transactions,
            ledger.settings.currencies,
            ledger.timeZone
          )
        : undefined,
    [ledger]
  )
  const holder = owner ? owner.toLocaleUpperCase(t.locale) : undefined
  const all = useMemo(
    () => (overview ? walletCards(t, overview, holder) : []),
    [t, overview, holder]
  )
  return { overview, all }
}

/** Wide screens always show a detail: the front card of the deck when none is chosen. */
function shownAccount(
  ledger: Ledger,
  selected: string | undefined,
  isWide: boolean,
  cards: WalletCard[]
) {
  const exists =
    selected !== undefined &&
    ledger.accounts.some((account) => account.id === selected)
  if (exists) return selected
  return isWide ? cards.at(-1)?.id : undefined
}

function sheetTitle(ledger: Ledger, current: string | undefined) {
  if (!current) return ""
  return accountName(
    ledger.accounts.find((account) => account.id === current) ?? { name: "" }
  )
}

function Accounts() {
  const t = useT()
  const ledger = useLedger()
  const display = useTransactionDisplay(ledger)
  const { openAddAccount } = useAppActions()
  const isWide = useMediaQuery("(min-width: 1024px)")
  const [selected, select] = useSelectedAccount()
  const [filter, setFilter] = useState<Filter>("all")
  const { overview, all } = useWalletCards(ledger)

  if (!ledger || !overview || !display) return <AccountsSkeleton />

  const { filters, shownFilter, cards } = walletFilter(all, filter)

  const current = shownAccount(ledger, selected, isWide, cards)
  const add = () => openAddAccount()
  const detail = current ? (
    <AccountDetail
      key={current}
      ledger={ledger}
      display={display}
      accountId={current}
      onDeleted={() => select(undefined)}
    />
  ) : null

  return (
    // Wide: exactly the window's height below the top bar; the deck and the panel share it.
    <Page className="lg:h-[calc(100svh-var(--topbar-h))] lg:min-h-0 lg:gap-5 lg:py-6">
      <KWLargeTitleHeader
        title={t.in("accounts", "Accounts")}
        subtitle={
          <NetWorth
            text={t.in("accounts", "Net worth %@", AMOUNT_SLOT)}
            amount={formatMoney(overview.netWorth)}
          />
        }
        trailing={
          <KWCircleButton
            icon="plus"
            variant="white"
            label={t.in("accounts", "Add account or card")}
            onClick={add}
          />
        }
      />
      {ledger.accounts.length === 0 ? (
        <EmptyWallet t={t} onAdd={add} />
      ) : (
        <div className="flex flex-col gap-6 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[400px_minmax(0,1fr)]">
          <div className="flex min-h-0 min-w-0 flex-col gap-5">
            <KindChips
              t={t}
              filters={filters}
              shown={shownFilter}
              onChange={setFilter}
            />
            <WalletStack
              cards={cards}
              selectedId={isWide ? current : undefined}
              onSelect={select}
              fit={isWide}
            />
          </div>
          {isWide ? (
            <DetailPanel t={t} panelKey={current ?? "none"}>
              {detail}
            </DetailPanel>
          ) : null}
        </div>
      )}
      {!isWide ? (
        <DetailSheet
          t={t}
          title={sheetTitle(ledger, current)}
          open={current !== undefined}
          onClose={() => select(undefined)}
        >
          {detail}
        </DetailSheet>
      ) : null}
    </Page>
  )
}

function EmptyWallet({ t, onAdd }: { t: Translator; onAdd: () => void }) {
  return (
    <div className="rounded-2xl bg-card">
      <KWEmptyState
        icon="wallet"
        title={t.in("accounts", "Add account or card")}
        message={t.in(
          "addcard",
          "Your bank account, shown as its card: balance, bank and last 4"
        )}
        action={
          <KWButton icon="plus" onClick={onAdd}>
            {t.in("accounts", "Add account or card")}
          </KWButton>
        }
      />
    </div>
  )
}

function KindChips({
  t,
  filters,
  shown,
  onChange,
}: {
  t: Translator
  filters: Filter[]
  shown: Filter
  onChange: (filter: Filter) => void
}) {
  if (filters.length === 0) return null
  const chipTitle = {
    all: t.in("accounts", "All"),
    debit: t.in("accounts", "Debit"),
    credit: t.in("accounts", "Credit"),
    cash: t.in("accounts", "Cash"),
  }
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label={t.in("accounts", "Accounts")}
    >
      {filters.map((option) => (
        <KWChip
          key={option}
          pillId="accounts-filter"
          selected={shown === option}
          onClick={() => onChange(option)}
        >
          {chipTitle[option]}
        </KWChip>
      ))}
    </div>
  )
}

/** The wide screen's panel beside the deck, with the chosen card's detail. */
function DetailPanel({
  t,
  panelKey,
  children,
}: {
  t: Translator
  panelKey: string
  children: ReactNode
}) {
  return (
    <aside className="relative min-h-0 overflow-hidden rounded-3xl bg-nav ring-1 ring-divider">
      {/* The panel swaps cards with a short cross-fade, as a sheet's content does on iOS. It
          animates the keyed swap only; the panel itself just goes when the window narrows. */}
      {/* react-doctor-disable-next-line react-doctor/motion-animate-presence-must-outlive-child */}
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={panelKey}
          className="h-full [scrollbar-width:thin] overflow-y-auto p-(--gutter)"
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{
            opacity: 0,
            transition: { duration: DURATION.press },
          }}
          transition={{ duration: DURATION.base, ease: EASE_OUT_IOS }}
        >
          {children ?? (
            <p className="py-10 text-center type-body text-muted-foreground">
              {t.in("web", "Select an account to see its details.")}
            </p>
          )}
        </m.div>
      </AnimatePresence>
    </aside>
  )
}

/** On a phone a card opens as a sheet from the right, with a back button. */
function DetailSheet({
  t,
  title,
  open,
  onClose,
  children,
}: {
  t: Translator
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-5 overflow-y-auto border-l border-divider bg-nav p-5 data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="flex-row items-center gap-3 p-0">
          <KWCircleButton
            icon="chevronLeft"
            label={t.in("web", "Back")}
            onClick={onClose}
          />
          <SheetTitle className="min-w-0 truncate type-heading">
            {title}
          </SheetTitle>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}

const AMOUNT_SLOT = "\u0000"

/** "Net worth $750.00" with only the amount emphasized and rolling, wherever the language puts it (iOS netWorthText). */
function NetWorth({ text, amount }: { text: string; amount: string }) {
  const [before = "", after = ""] = text.split(AMOUNT_SLOT)
  return (
    <span className="whitespace-pre">
      {before}
      <AnimatedNumber
        value={amount}
        className="font-semibold text-foreground"
      />
      {after}
    </span>
  )
}
