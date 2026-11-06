import { ChartColumnIcon, HouseIcon, ListIcon, SettingsIcon, WalletCardsIcon, type LucideIcon } from "lucide-react"

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  /** Its screen hasn't been built yet: shown, but not navigable. */
  isAvailable: boolean
}

/** The iOS tabs (MainTabView), in the same order. */
export const MAIN_NAV: readonly NavItem[] = [
  { title: "Home", href: "/", icon: HouseIcon, isAvailable: true },
  { title: "Transactions", href: "/transactions", icon: ListIcon, isAvailable: false },
  { title: "Accounts", href: "/accounts", icon: WalletCardsIcon, isAvailable: false },
  { title: "Summary", href: "/summary", icon: ChartColumnIcon, isAvailable: false },
]

/** Reached from home on iOS; on a wide screen it sits at the foot of the sidebar. */
export const SETTINGS_NAV: NavItem = { title: "Settings", href: "/settings", icon: SettingsIcon, isAvailable: false }
