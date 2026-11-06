import { ChartColumnIcon, HouseIcon, ListIcon, RepeatIcon, SettingsIcon, WalletCardsIcon, type LucideIcon } from "lucide-react"

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
export const RECURRING_NAV: NavItem = { title: "Recurring", ns: "web", href: "/recurring", icon: RepeatIcon, kwIcon: "subscription", key: "r" }

/** Reached from home on iOS; on a wide screen it sits at the foot of the sidebar. */
export const SETTINGS_NAV: NavItem = { title: "Settings", ns: "settings", href: "/settings", icon: SettingsIcon, kwIcon: "settings", key: "," }

export const ONBOARDING_PATH = "/welcome"
