import { ChartColumnIcon, HouseIcon, ListIcon, SettingsIcon, WalletCardsIcon, type LucideIcon } from "lucide-react"

import type { Namespace } from "@/lib/i18n"

export interface NavItem {
  /** The iOS tab title, translated from `ns`. */
  title: string
  ns: Namespace
  href: string
  icon: LucideIcon
  /** The key that jumps here after "g" (and the digit that jumps directly). */
  key: string
}

/** The iOS tabs (MainTabView), in the same order. */
export const MAIN_NAV: readonly NavItem[] = [
  { title: "Home", ns: "app", href: "/", icon: HouseIcon, key: "h" },
  { title: "Transactions", ns: "transactions", href: "/transactions", icon: ListIcon, key: "t" },
  { title: "Accounts", ns: "accounts", href: "/accounts", icon: WalletCardsIcon, key: "a" },
  { title: "Summary", ns: "summary", href: "/summary", icon: ChartColumnIcon, key: "s" },
]

/** Reached from home on iOS; on a wide screen it sits at the foot of the sidebar. */
export const SETTINGS_NAV: NavItem = { title: "Settings", ns: "settings", href: "/settings", icon: SettingsIcon, key: "," }

export const ONBOARDING_PATH = "/welcome"
