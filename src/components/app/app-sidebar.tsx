"use client"

import { TagsIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import type { ComponentProps, ReactNode } from "react"

import { KWAppIconTile, KWIcon, KWMiniCard } from "@/components/kw/kw-icon"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail, useSidebar } from "@/components/ui/sidebar"
import { useLedger, usePreferredName } from "@/hooks/use-ledger"
import { accountsOverview, formatMoney, joinedMoney, type Ledger } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { accountName } from "@/lib/presentation/display"
import { cn } from "@/lib/utils"

import { useAppActions } from "./app-actions"
import { MAIN_NAV, SETTINGS_NAV, type NavItem } from "./navigation"

/**
 * The desktop navigation, drawn with the iOS design system: the `nav` surface with its divider (as
 * under KWTabBar), the tab icons and colors of KWTabBar (white when selected, `faint` otherwise),
 * KWSectionHeader titles, KWGroupedCard rows with KWMiniCard thumbnails for the accounts, and the
 * white prominent action of KWActionButton for logging. shadcn's sidebar (from its sidebar-01
 * block) only supplies the frame: collapsing, the rail, ⌘B and the sheet on phones.
 */
export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const t = useT()
  const pathname = usePathname()
  const ledger = useLedger()
  const { openEditor, openAddAccount, setPaletteOpen } = useAppActions()
  const { isMobile, setOpenMobile } = useSidebar()
  // On phones the sidebar is a sheet: following a link closes it.
  const close = () => isMobile && setOpenMobile(false)
  const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`))

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-divider **:data-[slot=sidebar-inner]:bg-nav" {...props}>
      <SidebarHeader className="gap-4 px-4 pt-5 pb-3">
        <Link href="/" onClick={close} className="flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <KWAppIconTile size={32} />
          <span className="text-[1.375rem] leading-none font-extrabold tracking-[-0.06em] text-foreground">keepwell</span>
        </Link>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              close()
              openEditor()
            }}
            className="flex h-10 items-center gap-2 rounded-full bg-white pr-2 pl-3 text-black transition-opacity outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-nav"
          >
            <KWIcon name="plus" size={18} strokeWidth={2.2} />
            <span className="flex-1 text-left type-label">{t.in("home", "Log transaction")}</span>
            <kbd className="rounded-md bg-black/8 px-1.5 type-micro text-black/55">N</kbd>
          </button>
          <button
            type="button"
            onClick={() => {
              close()
              setPaletteOpen(true)
            }}
            className="flex h-10 items-center gap-2 rounded-xl bg-card px-3 text-muted-foreground transition-colors outline-none hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <KWIcon name="search" size={18} />
            <span className="flex-1 truncate text-left type-body">{t.in("transactions", "Search")}</span>
            <Kbd className="bg-secondary">⌘K</Kbd>
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-6 px-3 pb-4">
        <nav aria-label="Keepwell">
          <ul className="flex flex-col gap-0.5">
            {MAIN_NAV.map((item, index) => (
              <li key={item.href}>
                <TabLink item={item} shortcut={String(index + 1)} isCurrent={isCurrent(item.href)} onNavigate={close} />
              </li>
            ))}
          </ul>
        </nav>

        <section className="flex flex-col gap-2">
          <SectionHeader title={t.in("accounts", "Accounts")}>
            <button type="button" onClick={() => openAddAccount()} className="type-label text-link transition-colors hover:text-link-hover">
              + {t.in("addcard", "Add")}
            </button>
          </SectionHeader>
          {ledger ? <AccountsCard ledger={ledger} onNavigate={close} /> : null}
        </section>

        <section className="flex flex-col gap-2">
          <SectionHeader title={t.in("settings", "Organization")} />
          <GroupedCard>
            <RowLink href="/settings/categories" isCurrent={isCurrent("/settings/categories")} onNavigate={close} leading={<TagsIcon className="size-[18px]" strokeWidth={2} aria-hidden />}>
              {t.in("settings", "Categories")}
            </RowLink>
            <RowLink href={SETTINGS_NAV.href} isCurrent={pathname === SETTINGS_NAV.href} onNavigate={close} leading={<KWIcon name={SETTINGS_NAV.kwIcon} size={18} />}>
              {t.in(SETTINGS_NAV.ns, SETTINGS_NAV.title)}
            </RowLink>
          </GroupedCard>
        </section>
      </SidebarContent>

      <SidebarFooter className="border-t border-divider p-3">
        <ProfileMenu />
      </SidebarFooter>
      <SidebarRail className="hover:after:bg-divider" />
    </Sidebar>
  )
}

/** KWTabBar's item laid out for a column: icon and title, white when selected, `faint` otherwise. */
function TabLink({ item, shortcut, isCurrent, onNavigate }: { item: NavItem; shortcut: string; isCurrent: boolean; onNavigate: () => void }) {
  const t = useT()
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isCurrent ? "page" : undefined}
      className={cn(
        "group/tab flex h-10 items-center gap-3 rounded-xl px-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isCurrent ? "bg-card text-foreground" : "text-text-faint hover:bg-card/60 hover:text-text-secondary",
      )}
    >
      <KWIcon name={item.kwIcon} size={22} />
      <span className="flex-1 type-label">{t.in(item.ns, item.title)}</span>
      <span className="type-micro text-text-faint opacity-0 transition-opacity group-hover/tab:opacity-100" aria-hidden>
        {shortcut}
      </span>
    </Link>
  )
}

/** KWSectionHeader, small style: the muted 14 pt label above a card, with an optional accessory. */
function SectionHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-1">
      <h2 className="type-label text-muted-foreground">{title}</h2>
      {children}
    </div>
  )
}

/** KWGroupedCard: rows on the `surface` card with a divider between each pair. */
function GroupedCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card", className)}>{children}</div>
}

function RowLink({ href, isCurrent, onNavigate, leading, trailing, children }: { href: string; isCurrent: boolean; onNavigate: () => void; leading: ReactNode; trailing?: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isCurrent ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 px-3 py-2 transition-colors outline-none hover:bg-secondary/60 focus-visible:bg-secondary/60",
        isCurrent ? "text-foreground" : "text-text-secondary",
      )}
    >
      <span className={cn("flex shrink-0 items-center", isCurrent ? "text-foreground" : "text-text-faint")}>{leading}</span>
      <span className="min-w-0 flex-1 truncate type-label">{children}</span>
      {trailing ?? <KWIcon name="chevronRight" size={16} className="text-text-faint" />}
    </Link>
  )
}

/** The person's accounts as the Accounts tab orders them, each on its card thumbnail. */
function AccountsCard({ ledger, onNavigate }: { ledger: Ledger; onNavigate: () => void }) {
  const t = useT()
  const overview = accountsOverview(ledger.accounts, ledger.cards, ledger.transactions, ledger.settings.currencies)
  const rows = [
    ...overview.deposits.map((entry) => ({ account: entry.account, thumb: <KWMiniCard color={entry.debitCard?.color} size="tiny" />, balance: formatMoney(entry.balance, { fractionDigits: 0 }), isDebt: false })),
    ...overview.cash.map((entry) => ({ account: entry.account, thumb: <KWMiniCard kind="cash" size="tiny" />, balance: formatMoney(entry.balance, { fractionDigits: 0 }), isDebt: false })),
    ...overview.creditCards.map((entry) => ({ account: entry.account, thumb: <KWMiniCard color={entry.holder?.color} size="tiny" />, balance: joinedMoney(entry.balances, 0), isDebt: entry.balances.some((balance) => balance.amount.lt(0)) })),
  ]
  return (
    <GroupedCard>
      <Link href="/accounts" onClick={onNavigate} className="flex flex-col gap-0.5 px-3 pt-3 pb-2.5 transition-colors outline-none hover:bg-secondary/60 focus-visible:bg-secondary/60">
        <span className="type-caption text-muted-foreground">{t.in("home", "Net worth")}</span>
        <span className="type-amount-sm text-foreground">{formatMoney(overview.netWorth)}</span>
      </Link>
      {rows.map(({ account, thumb, balance, isDebt }) => (
        <RowLink
          key={account.id}
          href={`/accounts?id=${account.id}`}
          isCurrent={false}
          onNavigate={onNavigate}
          leading={thumb}
          trailing={<span className={cn("shrink-0 type-caption tabular-nums", isDebt ? "text-negative" : "text-muted-foreground")}>{balance}</span>}
        >
          {accountName(account)}
        </RowLink>
      ))}
    </GroupedCard>
  )
}

/** Who this is (the name iOS greets with) and their currencies, with the app's menu. */
function ProfileMenu() {
  const t = useT()
  const router = useRouter()
  const name = usePreferredName()
  const ledger = useLedger()
  const { setShortcutsOpen, openAddAccount } = useAppActions()
  const currencies = ledger ? [ledger.settings.currencies.principal, ledger.settings.currencies.second].filter(Boolean).join(" · ") : ""
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-card">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary type-label text-foreground uppercase">
          {name ? [...name][0] : <KWIcon name="person" size={18} />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate type-label text-foreground">{name ?? "keepwell"}</span>
          <span className="truncate type-caption text-muted-foreground">{currencies}</span>
        </span>
        <KWIcon name="more" size={20} className="text-text-faint" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{currencies}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => openAddAccount()}>
            <KWIcon name="addCard" size={16} />
            {t.in("accounts", "Add account or card")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <KWIcon name="settings" size={16} />
            {t.in("settings", "Settings")}
            <DropdownMenuShortcut>,</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
          <KWIcon name="list" size={16} />
          {t.in("web", "Keyboard shortcuts")}
          <DropdownMenuShortcut>?</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
