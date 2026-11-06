"use client"

import { BanknoteIcon, ChevronsUpDownIcon, CreditCardIcon, KeyboardIcon, LandmarkIcon, PlusIcon, SearchIcon, SettingsIcon, TagsIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createElement, type ComponentProps } from "react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useLedger, usePreferredName } from "@/hooks/use-ledger"
import { balanceOf, formatMoney, netWorth, type Ledger } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { accountName } from "@/lib/presentation/display"
import type { Account } from "@/lib/schema"

import { useAppActions } from "./app-actions"
import { MAIN_NAV, SETTINGS_NAV, type NavItem } from "./navigation"

const ACCOUNT_ICONS = { deposit: LandmarkIcon, credit: CreditCardIcon, cash: BanknoteIcon } as const

/**
 * Built from shadcn's sidebar-01 block: a switcher in the header (here the person and their net
 * worth, with the app menu), a search field (opens ⌘K), navigation grouped by section with labels,
 * and a rail to collapse it. The groups are Keepwell's: the iOS tabs, the person's own accounts
 * and Organization.
 */
export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const t = useT()
  const pathname = usePathname()
  const ledger = useLedger()
  const { openEditor, openAddAccount, setPaletteOpen } = useAppActions()
  const { isMobile, setOpenMobile } = useSidebar()
  // On phones the sidebar is a sheet: following a link should close it.
  const close = () => isMobile && setOpenMobile(false)

  const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))
  const accounts = ledger ? [...ledger.accounts].sort((a, b) => ["deposit", "cash", "credit"].indexOf(a.kind) - ["deposit", "cash", "credit"].indexOf(b.kind)) : []

  const navRow = (item: NavItem, shortcut: string) => (
    <SidebarMenuItem key={item.href}>
      <SidebarMenuButton isActive={isCurrent(item.href)} tooltip={t.in(item.ns, item.title)} render={<Link href={item.href} onClick={close} />}>
        <item.icon />
        <span>{t.in(item.ns, item.title)}</span>
      </SidebarMenuButton>
      <SidebarMenuBadge className="opacity-0 transition-opacity group-hover/menu-item:opacity-100">
        <Kbd>{shortcut}</Kbd>
      </SidebarMenuBadge>
    </SidebarMenuItem>
  )

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="gap-3 pt-3">
        <ProfileSwitcher />
        <button
          type="button"
          onClick={() => {
            close()
            setPaletteOpen(true)
          }}
          className="flex h-8 items-center gap-2 rounded-md bg-sidebar-accent/60 px-2 text-sm text-muted-foreground ring-sidebar-ring transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:outline-none"
        >
          <SearchIcon className="size-4 opacity-60" aria-hidden />
          <span className="flex-1 text-left">{t.in("web", "Search or jump to…")}</span>
          <Kbd>⌘K</Kbd>
        </button>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                close()
                openEditor()
              }}
              className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground active:bg-sidebar-primary/90 active:text-sidebar-primary-foreground"
            >
              <PlusIcon />
              <span className="flex-1">{t.in("home", "Log transaction")}</span>
              <Kbd className="bg-black/10 text-sidebar-primary-foreground/70">N</Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Keepwell</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{MAIN_NAV.map((item, index) => navRow(item, String(index + 1)))}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{t.in("accounts", "Accounts")}</SidebarGroupLabel>
          <SidebarGroupAction title={t.in("accounts", "Add account or card")} onClick={() => openAddAccount()}>
            <PlusIcon />
            <span className="sr-only">{t.in("accounts", "Add account or card")}</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {ledger ? accounts.map((account) => <AccountRow key={account.id} account={account} ledger={ledger} onNavigate={close} />) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{t.in("settings", "Organization")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname === "/settings/categories"} render={<Link href="/settings/categories" onClick={close} />}>
                  <TagsIcon />
                  <span>{t.in("settings", "Categories")}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {navRow({ ...SETTINGS_NAV }, ",")}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 pb-4">
        <p className="type-caption-sm text-muted-foreground">
          <Kbd>?</Kbd> {t.in("web", "Keyboard shortcuts")} · <Kbd>⌘B</Kbd>
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function AccountRow({ account, ledger, onNavigate }: { account: Account; ledger: Ledger; onNavigate: () => void }) {
  const balances = balanceOf(account, ledger.transactions)
  const total = account.kind === "credit" ? netWorth(balances, ledger.settings.currencies) : balances[0]
  const href = `/accounts?id=${account.id}`
  return (
    <SidebarMenuItem>
      <SidebarMenuButton render={<Link href={href} onClick={onNavigate} />}>
        {createElement(ACCOUNT_ICONS[account.kind])}
        <span className="truncate">{accountName(account)}</span>
      </SidebarMenuButton>
      {total ? <SidebarMenuBadge className={account.kind === "credit" ? "text-negative" : undefined}>{formatMoney(total, { fractionDigits: 0 })}</SidebarMenuBadge> : null}
    </SidebarMenuItem>
  )
}

/** sidebar-01's version switcher, as Keepwell's: who it is, the main currency and the app menu. */
function ProfileSwitcher() {
  const t = useT()
  const router = useRouter()
  const name = usePreferredName()
  const ledger = useLedger()
  const { setShortcutsOpen, openAddAccount } = useAppActions()
  const principal = ledger?.settings.currencies.principal
  const second = ledger?.settings.currencies.second
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground" />}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG, nothing to optimize */}
            <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
            <div className="flex min-w-0 flex-col gap-0.5 leading-none">
              <span className="truncate font-semibold">{name ?? "Keepwell"}</span>
              <span className="truncate text-xs text-muted-foreground">{[principal, second].filter(Boolean).join(" · ")}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Keepwell</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => openAddAccount()}>
                <PlusIcon />
                {t.in("accounts", "Add account or card")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings/categories")}>
                <TagsIcon />
                {t.in("settings", "Categories")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <SettingsIcon />
              {t.in("settings", "Settings")}
              <DropdownMenuShortcut>,</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
              <KeyboardIcon />
              {t.in("web", "Keyboard shortcuts")}
              <DropdownMenuShortcut>?</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
