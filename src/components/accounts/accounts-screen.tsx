"use client"

import { AnimatePresence, motion } from "motion/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState } from "react"

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
  formatMoney,
  joinedMoney,
  type AccountsOverview,
} from "@/lib/domain"
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
): (WalletEntry & { kind: Kind })[] {
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
  const [filter, setFilter] = useState<Filter>("all")

  // A link (command palette, add card) can ask for an account by `?id=`.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is the source of the selection
    if (requested) setSelected(requested)
  }, [requested])

  const overview = useMemo(
    () =>
      ledger
        ? accountsOverview(
            ledger.accounts,
            ledger.cards,
            ledger.transactions,
            ledger.settings.currencies
          )
        : undefined,
    [ledger]
  )
  const holder = owner ? owner.toLocaleUpperCase(t.locale) : undefined
  const all = useMemo(
    () => (overview ? walletCards(t, overview, holder) : []),
    [t, overview, holder]
  )

  const select = (id: string | undefined) => {
    setSelected(id)
    router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false })
  }

  if (!ledger || !overview || !display) return <AccountsSkeleton />

  // Only the kinds the person has, so no chip empties the wallet; no chips at all with a single kind.
  const kinds = (["debit", "credit", "cash"] as const).filter((kind) =>
    all.some((card) => card.kind === kind)
  )
  const filters: Filter[] = kinds.length > 1 ? ["all", ...kinds] : []
  const shownFilter = filters.includes(filter) ? filter : "all"
  const cards =
    shownFilter === "all"
      ? all
      : all.filter((card) => card.kind === shownFilter)

  // Wide screens always show a detail: the front card of the deck when none is chosen.
  const exists =
    selected !== undefined &&
    ledger.accounts.some((account) => account.id === selected)
  const current = exists ? selected : isWide ? cards.at(-1)?.id : undefined
  const isEmpty = ledger.accounts.length === 0
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
  const chipTitle = {
    all: t.in("accounts", "All"),
    debit: t.in("accounts", "Debit"),
    credit: t.in("accounts", "Credit"),
    cash: t.in("accounts", "Cash"),
  }

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
      {isEmpty ? (
        <div className="rounded-2xl bg-card">
          <KWEmptyState
            icon="wallet"
            title={t.in("accounts", "Add account or card")}
            message={t.in(
              "addcard",
              "Your bank account, shown as its card: balance, bank and last 4"
            )}
            action={
              <KWButton icon="plus" onClick={add}>
                {t.in("accounts", "Add account or card")}
              </KWButton>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[400px_minmax(0,1fr)]">
          <div className="flex min-h-0 min-w-0 flex-col gap-5">
            {filters.length > 0 ? (
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label={t.in("accounts", "Accounts")}
              >
                {filters.map((option) => (
                  <KWChip
                    key={option}
                    pillId="accounts-filter"
                    selected={shownFilter === option}
                    onClick={() => setFilter(option)}
                  >
                    {chipTitle[option]}
                  </KWChip>
                ))}
              </div>
            ) : null}
            <WalletStack
              cards={cards}
              selectedId={isWide ? current : undefined}
              onSelect={select}
              fit={isWide}
            />
          </div>
          {isWide ? (
            <aside className="relative min-h-0 overflow-hidden rounded-3xl bg-nav ring-1 ring-divider">
              {/* The panel swaps cards with a short cross-fade, as a sheet's content does on iOS. */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current ?? "none"}
                  className="h-full [scrollbar-width:thin] overflow-y-auto p-5"
                  initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{
                    opacity: 0,
                    transition: { duration: DURATION.press },
                  }}
                  transition={{ duration: DURATION.base, ease: EASE_OUT_IOS }}
                >
                  {detail ?? (
                    <p className="py-10 text-center type-body text-muted-foreground">
                      {t.in("web", "Select an account to see its details.")}
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            </aside>
          ) : null}
        </div>
      )}
      {!isWide ? (
        <Sheet
          open={current !== undefined}
          onOpenChange={(open) => !open && select(undefined)}
        >
          <SheetContent
            side="right"
            showCloseButton={false}
            className="w-full gap-5 overflow-y-auto border-l border-divider bg-nav p-5 data-[side=right]:sm:max-w-md"
          >
            <SheetHeader className="flex-row items-center gap-3 p-0">
              <KWCircleButton
                icon="chevronLeft"
                label={t.in("web", "Back")}
                onClick={() => select(undefined)}
              />
              <SheetTitle className="min-w-0 truncate type-heading">
                {current
                  ? accountName(
                      ledger.accounts.find(
                        (account) => account.id === current
                      ) ?? { name: "" }
                    )
                  : ""}
              </SheetTitle>
            </SheetHeader>
            {detail}
          </SheetContent>
        </Sheet>
      ) : null}
    </Page>
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
