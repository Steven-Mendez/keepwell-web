import { ChartColumnIcon, HandCoinsIcon, HouseIcon, ListIcon, PiggyBankIcon, RepeatIcon, SettingsIcon, WalletCardsIcon, type LucideIcon } from "lucide-react"

import type { KWIconName } from "@/components/kw/kw-icon-data"
import type { Namespace } from "@/lib/i18n"

export interface NavItem {
  /** The iOS tab title, translated from `ns`. */
  title: string
  ns: Namespace
  href: string
  icon: LucideIcon
  /** The iOS tab bar icon (KWIcon). */
  kwIcon: KWIconName
  /** The key that jumps here after "g" (and the digit that jumps directly). */
  key: string
}

/** The iOS tabs (MainTabView), in the same order. */
export const MAIN_NAV: readonly NavItem[] = [
  { title: "Home", ns: "app", href: "/", icon: HouseIcon, kwIcon: "home", key: "h" },
  { title: "Transactions", ns: "transactions", href: "/transactions", icon: ListIcon, kwIcon: "list", key: "t" },
  { title: "Accounts", ns: "accounts", href: "/accounts", icon: WalletCardsIcon, kwIcon: "tabAccounts", key: "a" },
  { title: "Summary", ns: "summary", href: "/summary", icon: ChartColumnIcon, kwIcon: "chartBars", key: "s" },
]

/** Recurring movements and subscriptions: pushed from Home on iOS; on the web a section of the sidebar. */
export const RECURRING_NAV: NavItem = { title: "Recurring", ns: "recurring", href: "/recurring", icon: RepeatIcon, kwIcon: "subscription", key: "r" }

/** Savings goals: pushed from Home on iOS, like Recurring; on the web a section of the sidebar. */
export const GOALS_NAV: NavItem = { title: "Goals", ns: "goals", href: "/goals", icon: PiggyBankIcon, kwIcon: "wallet", key: "g" }

/** Loans and personal debts: pushed from Home on iOS, like Goals; on the web a section of the sidebar. */
export const DEBTS_NAV: NavItem = { title: "Debts", ns: "debts", href: "/debts", icon: HandCoinsIcon, kwIcon: "cash", key: "d" }

/** The sections after the tabs, in the sidebar and in "G then a letter". */
export const SECTION_NAV: readonly NavItem[] = [RECURRING_NAV, GOALS_NAV, DEBTS_NAV]

/** Reached from home on iOS; on a wide screen it sits at the foot of the sidebar. */
export const SETTINGS_NAV: NavItem = { title: "Settings", ns: "settings", href: "/settings", icon: SettingsIcon, kwIcon: "settings", key: "," }

export const ONBOARDING_PATH = "/welcome"

/** Routes drawn as full pages of their own, without the sidebar, top bar or tab bar. */
export const STANDALONE_PATHS: readonly string[] = ["/design-system", "/connect", "/login", "/privacy", "/docs"]

export function isStandalonePath(pathname: string): boolean {
  return STANDALONE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}
