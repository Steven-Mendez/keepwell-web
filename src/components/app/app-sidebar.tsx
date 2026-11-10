"use client"

import { PanelLeftIcon, TagsIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import type { ComponentProps, ReactNode } from "react"

import { AnimatedNumber } from "@/components/kw/animated-number"
import { SelectionPill } from "@/components/kw/motion"
import { KWCircleButton } from "@/components/kw/design"
import { KWIcon, KWLogo } from "@/components/kw/kw-icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { SidebarAccountsSkeleton } from "@/components/kw/skeletons"
import { BALANCE_MASK, useHiddenBalances } from "@/hooks/use-hidden-balances"
import { useLedger, usePreferredName } from "@/hooks/use-ledger"
import {
  accountsOverview,
  type Ledger,
  type Money,
} from "@/lib/domain"
import {
  formatMoney,
  joinedMoney,
} from "@/lib/domain/format"
import type { CardColor } from "@/lib/schema"
import { useT } from "@/lib/i18n"
import { accountName } from "@/lib/presentation/display"
import { cn } from "@/lib/utils"

import { useAppActions } from "./app-actions"
import { MAIN_NAV, SECTION_NAV, SETTINGS_NAV, type NavItem } from "./navigation"

/**
 * The sidebar's one column, so the logo, search, tabs, accounts and profile line up: every section
 * sits `GUTTER` from the sidebar's edges (so row backgrounds and the header's toggle share both
 * edges) and every row insets its content by `ROW_INSET`, which puts the logo, the icons, the
 * captions and the avatar on one leading edge and the trailing hints on one trailing edge. Icons sit
 * in an `IconSlot` so the labels after them start on one line too.
 */
const GUTTER = "px-3"
const ROW_INSET = "px-3"

/** The leading icon's column, as wide as the tab icons; smaller icons and swatches start at its edge. */
function IconSlot({ children }: { children: ReactNode }) {
  return (
    <span className="flex w-[22px] shrink-0 items-center justify-start">
      {children}
    </span>
  )
}

/**
 * The desktop navigation, drawn with the iOS design system: the `nav` surface with its divider (as
 * under KWTabBar), the tab icons and colors of KWTabBar (white when selected, `faint` otherwise),
 * the accounts as plain rows with a card-art swatch (no grouped card: with real data it got heavy);
 * Categories and Settings live in the profile menu. shadcn's sidebar (from its sidebar-01
 * block) only supplies the frame: collapsing, the rail, ⌘B and the sheet on phones.
 */
export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const t = useT()
  const pathname = usePathname()
  const ledger = useLedger()
  const { openAddAccount, setPaletteOpen } = useAppActions()
  const { isMobile, setOpenMobile, toggleSidebar } = useSidebar()
  // On phones the sidebar is a sheet: following a link closes it.
  const close = () => isMobile && setOpenMobile(false)
  const isCurrent = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-r border-divider **:data-[slot=sidebar-inner]:bg-nav"
      {...props}
    >
      <SidebarHeader className={cn("gap-4 pt-5 pb-3", GUTTER)}>
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            onClick={close}
            className={cn(
              "flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
              ROW_INSET
            )}
          >
            <KWLogo height={28} />
          </Link>
          {/* The toggle lives here while the sidebar is open, so pages don't spend a bar on it (Linear, Copilot). */}
          {isMobile ? null : (
            <KWCircleButton
              icon={
                <PanelLeftIcon
                  className="size-[18px]"
                  strokeWidth={2}
                  aria-hidden
                />
              }
              label={t.in("web", "Toggle sidebar")}
              shortcut="⌘B"
              size={32}
              variant="translucent"
              onClick={toggleSidebar}
            />
          )}
        </div>
        {/* Logging lives on N, Home's actions and each page's +; the sidebar only navigates. */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              close()
              setPaletteOpen(true)
            }}
            className={cn(
              "flex h-10 press items-center gap-3 rounded-xl bg-card text-muted-foreground outline-none hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-ring",
              ROW_INSET
            )}
          >
            <IconSlot>
              <KWIcon name="search" size={18} />
            </IconSlot>
            <span className="flex-1 truncate text-left type-body">
              {t.in("transactions", "Search")}
            </span>
            <Kbd className="bg-secondary">⌘K</Kbd>
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className={cn("gap-5 pb-3", GUTTER)}>
        <nav aria-label="Keepwell">
          <ul className="flex flex-col gap-0.5">
            {MAIN_NAV.map((item, index) => (
              <li key={item.href}>
                <TabLink
                  item={item}
                  shortcut={String(index + 1)}
                  isCurrent={isCurrent(item.href)}
                  onNavigate={close}
                />
              </li>
            ))}
            {SECTION_NAV.map((item) => (
              <li key={item.href}>
                <TabLink
                  item={item}
                  shortcut={`G ${item.key.toUpperCase()}`}
                  isCurrent={isCurrent(item.href)}
                  onNavigate={close}
                />
              </li>
            ))}
          </ul>
        </nav>

        <section className="group/accounts flex flex-col gap-1">
          <div className={cn("flex h-8 items-center gap-2", ROW_INSET)}>
            <Link
              href="/accounts"
              onClick={close}
              className="flex-1 type-caption text-muted-foreground transition-colors outline-none hover:text-text-secondary focus-visible:text-foreground"
            >
              {t.in("accounts", "Accounts")}
            </Link>
            <button
              type="button"
              onClick={() => openAddAccount()}
              aria-label={t.in("accounts", "Add account or card")}
              // -mr-[5px]: the 14 px glyph, not its 24 px hit box, ends on the balances' trailing edge.
              className="-mr-[5px] flex size-6 items-center justify-center rounded-md text-text-faint transition-opacity outline-none hover:bg-card hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover/accounts:opacity-100"
            >
              <KWIcon name="plus" size={14} strokeWidth={2.2} />
            </button>
          </div>
          {ledger ? (
            <AccountsList ledger={ledger} onNavigate={close} />
          ) : (
            <SidebarAccountsSkeleton />
          )}
        </section>
      </SidebarContent>

      <SidebarFooter className={cn("border-t border-divider py-3", GUTTER)}>
        <ProfileMenu onNavigate={close} />
      </SidebarFooter>
      <SidebarRail className="hover:after:bg-divider" />
    </Sidebar>
  )
}

/** KWTabBar's item laid out for a column: icon and title, white when selected, `faint` otherwise. */
function TabLink({
  item,
  shortcut,
  isCurrent,
  onNavigate,
}: {
  item: NavItem
  shortcut: string
  isCurrent: boolean
  onNavigate: () => void
}) {
  const t = useT()
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isCurrent ? "page" : undefined}
      className={cn(
        "group/tab relative isolate flex h-10 items-center gap-3 rounded-xl press-row outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ROW_INSET,
        isCurrent
          ? "text-foreground"
          : "text-text-faint hover:bg-card/60 hover:text-text-secondary"
      )}
    >
      {/* The current-section highlight slides between tabs instead of jumping. */}
      {isCurrent ? (
        <SelectionPill layoutId="sidebar-tab" className="rounded-xl bg-card" />
      ) : null}
      <IconSlot>
        <KWIcon name={item.kwIcon} size={22} />
      </IconSlot>
      <span className="flex-1 type-label">{t.in(item.ns, item.title)}</span>
      <span
        className="type-micro text-text-faint opacity-0 transition-opacity group-hover/tab:opacity-100"
        aria-hidden
      >
        {shortcut}
      </span>
    </Link>
  )
}

/** A quiet row: small icon and label, no card, the same hover as the tabs. */
function PlainLink({
  href,
  isCurrent,
  onNavigate,
  icon,
  trailing,
  children,
}: {
  href: string
  isCurrent: boolean
  onNavigate: () => void
  icon: ReactNode
  trailing?: ReactNode
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isCurrent ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-3 rounded-lg press-row outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ROW_INSET,
        isCurrent
          ? "bg-card text-foreground"
          : "text-text-secondary hover:bg-card/60 hover:text-foreground"
      )}
    >
      <span className="text-text-faint">
        <IconSlot>{icon}</IconSlot>
      </span>
      <span className="min-w-0 flex-1 truncate type-body">{children}</span>
      {trailing}
    </Link>
  )
}

/** The card's art as a swatch the size of an icon, so a row reads as a list item rather than a card. */
function AccountSwatch({
  color,
  cash,
}: {
  color?: CardColor | undefined
  cash?: boolean
}) {
  if (cash)
    return (
      <span className="h-2.5 w-3.5 rounded-[3px] bg-positive" aria-hidden />
    )
  const art = color ?? "azul"
  return (
    <span
      className="h-2.5 w-3.5 rounded-[3px]"
      style={{
        backgroundImage: `linear-gradient(135deg, var(--card-art-${art}-from), var(--card-art-${art}-to))`,
      }}
      aria-hidden
    />
  )
}

/**
 * The person's accounts as the Accounts tab orders them, as plain rows (Copilot, YNAB): a swatch, the
 * name and one faint balance. Net worth sits at the bottom as the list's total.
 */
function AccountsList({
  ledger,
  onNavigate,
}: {
  ledger: Ledger
  onNavigate: () => void
}) {
  const t = useT()
  const overview = accountsOverview(
    ledger.accounts,
    ledger.cards,
    ledger.transactions,
    ledger.settings.currencies
  )
  // The eye on Home hides balances here too, as iOS hides them on every screen.
  const [hidden] = useHiddenBalances()
  // A card owing in both currencies shows only what it owes; a zero in the other one is noise.
  const cardBalance = (balances: readonly Money[]) => {
    const owed = balances.filter((balance) => !balance.amount.isZero())
    return joinedMoney(owed.length > 0 ? owed : balances.slice(0, 1), 0)
  }
  const rows = [
    ...overview.deposits.map((entry) => ({
      account: entry.account,
      swatch: <AccountSwatch color={entry.debitCard?.color} />,
      balance: formatMoney(entry.balance, { fractionDigits: 0 }),
    })),
    ...overview.cash.map((entry) => ({
      account: entry.account,
      swatch: <AccountSwatch cash />,
      balance: formatMoney(entry.balance, { fractionDigits: 0 }),
    })),
    ...overview.creditCards.map((entry) => ({
      account: entry.account,
      swatch: <AccountSwatch color={entry.holder?.color} />,
      balance: cardBalance(entry.balances),
    })),
  ]
  return (
    <ul className="flex flex-col gap-0.5">
      {rows.map(({ account, swatch, balance }) => (
        <li key={account.id}>
          <PlainLink
            href={`/accounts?id=${account.id}`}
            isCurrent={false}
            onNavigate={onNavigate}
            icon={swatch}
            trailing={
              <span className="shrink-0 type-caption text-text-faint tabular-nums">
                {hidden ? BALANCE_MASK : balance}
              </span>
            }
          >
            {accountName(account)}
          </PlainLink>
        </li>
      ))}
      <li
        className={cn(
          "mt-1 flex h-8 items-center gap-3 border-t border-divider pt-1",
          ROW_INSET
        )}
      >
        <span className="flex-1 type-caption text-muted-foreground">
          {t.in("home", "Net worth")}
        </span>
        <AnimatedNumber
          value={
            hidden
              ? BALANCE_MASK
              : formatMoney(overview.netWorth, { fractionDigits: 0 })
          }
          className="type-caption font-semibold text-foreground tabular-nums"
        />
      </li>
    </ul>
  )
}

/**
 * Who this is (the name iOS greets with) and their currencies. The menu holds what's visited rarely
 * (Categories, Settings) so the sidebar itself only navigates, grouped as Linear's workspace menu:
 * add, organize, then this device's preferences.
 */
function ProfileMenu({ onNavigate }: { onNavigate: () => void }) {
  const t = useT()
  const router = useRouter()
  const name = usePreferredName()
  const ledger = useLedger()
  const { setShortcutsOpen, openAddAccount } = useAppActions()
  const [hidden, toggleHidden] = useHiddenBalances()
  const currencies = ledger
    ? [ledger.settings.currencies.principal, ledger.settings.currencies.second]
        .filter(Boolean)
        .join(" · ")
    : ""
  const go = (href: string) => {
    onNavigate()
    router.push(href)
  }
  const item = "gap-2.5 px-2 py-1.5 [&_svg]:text-text-faint"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-3 rounded-xl py-2 text-left transition-colors outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-card",
          ROW_INSET
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary type-label text-foreground uppercase">
          {name ? [...name][0] : <KWIcon name="person" size={18} />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate type-label text-foreground">
            {name ?? "keepwell"}
          </span>
          <span className="truncate type-caption text-muted-foreground">
            {currencies}
          </span>
        </span>
        <KWIcon name="more" size={20} className="text-text-faint" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={6}
        className="min-w-56 rounded-xl p-1.5"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem className={item} onClick={() => openAddAccount()}>
            <KWIcon name="addCard" size={16} />
            {t.in("accounts", "Add account or card")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-1.5" />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className={item}
            onClick={() => go("/settings/categories")}
          >
            <TagsIcon className="size-4" strokeWidth={2} aria-hidden />
            {t.in("settings", "Categories")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={item}
            onClick={() => go(SETTINGS_NAV.href)}
          >
            <KWIcon name={SETTINGS_NAV.kwIcon} size={16} />
            {t.in(SETTINGS_NAV.ns, SETTINGS_NAV.title)}
            <DropdownMenuShortcut>,</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-1.5" />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className={item}
            closeOnClick={false}
            onClick={toggleHidden}
          >
            <KWIcon name={hidden ? "eye" : "eyeOff"} size={16} />
            {t.in("web", hidden ? "Show balances" : "Hide balances")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={item}
            onClick={() => setShortcutsOpen(true)}
          >
            <KWIcon name="list" size={16} />
            {t.in("web", "Keyboard shortcuts")}
            <DropdownMenuShortcut>?</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
