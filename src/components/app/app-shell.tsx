"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { PanelLeftIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import { KWCircleButton } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { useLedger } from "@/hooks/use-ledger"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { AddAccountDialog } from "../accounts/add-account-dialog"
import { MovementDetail } from "../transactions/movement-detail"
import { MovementEditor } from "../movement-editor/movement-editor"
import { AppActionsProvider, useAppActions } from "./app-actions"
import { AppSidebar } from "./app-sidebar"
import { CommandPalette } from "./command-palette"
import { KeyboardShortcuts } from "./keyboard-shortcuts"
import { MAIN_NAV, ONBOARDING_PATH, SETTINGS_NAV, type NavItem } from "./navigation"

/**
 * Desktop: a left sidebar with the iOS sections, like desktop finance apps (Mobbin: Revolut web).
 * Phone widths: the sidebar hides and a bottom tab bar takes over, like iOS MainTabView. Until
 * onboarding is finished every route leads to it, as iOS shows onboarding before the tabs.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const ledger = useLedger()
  const isOnboarding = pathname === ONBOARDING_PATH
  const onboarded = ledger?.settings.hasCompletedOnboarding

  useEffect(() => {
    if (onboarded === false && !isOnboarding) router.replace(ONBOARDING_PATH)
    if (onboarded === true && isOnboarding) router.replace("/")
  }, [onboarded, isOnboarding, router])

  if (isOnboarding) return <>{children}</>
  if (!onboarded) {
    return (
      <div className="flex min-h-svh items-center justify-center" aria-busy>
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <AppActionsProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
          <TopBar />
          {children}
        </SidebarInset>
        <MobileTabBar />
      </SidebarProvider>
      <MovementEditor />
      <MovementDetail />
      <AddAccountDialog />
      <CommandPalette />
      <KeyboardShortcuts />
    </AppActionsProvider>
  )
}

function useIsCurrent() {
  const pathname = usePathname()
  return (item: NavItem) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))
}

/**
 * The top bar, as iOS draws a screen's chrome: KWCircleButtons on the black background (sidebar and
 * search on `surface`, the white "+" of list headers to log), and the screen's title appearing only
 * once its large title (KWLargeTitleHeader) has scrolled away, the way an iOS large title collapses.
 */
function TopBar() {
  const t = useT()
  const pathname = usePathname()
  const { toggleSidebar, state, isMobile } = useSidebar()
  // On a wide screen the sidebar already holds search and "+"; they come up here only once it's hidden.
  const sidebarHidden = isMobile || state === "collapsed"
  const { openEditor, setPaletteOpen } = useAppActions()
  const [isScrolled, setScrolled] = useState(false)
  const section = pathname.startsWith("/settings/categories")
    ? { ns: "settings" as const, title: "Categories" }
    : ([...MAIN_NAV, SETTINGS_NAV].filter((item) => item.href !== "/").find((item) => pathname.startsWith(item.href)) ?? MAIN_NAV[0]!)

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 56)
    update()
    window.addEventListener("scroll", update, { passive: true })
    return () => window.removeEventListener("scroll", update)
  }, [pathname])

  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b px-(--gutter) transition-colors md:px-8",
        isScrolled ? "border-divider bg-background/85 backdrop-blur-xl" : "border-transparent bg-transparent",
      )}
    >
      <KWCircleButton icon={<PanelLeftIcon className="size-5" strokeWidth={2} aria-hidden />} label={t.in("web", "Toggle sidebar")} shortcut="⌘B" onClick={toggleSidebar} />
      <p className={cn("min-w-0 flex-1 truncate type-heading transition-opacity duration-200", isScrolled ? "opacity-100" : "opacity-0")} aria-hidden={!isScrolled}>
        {t.in(section.ns, section.title)}
      </p>
      {sidebarHidden ? (
        <KWCircleButton icon="search" label={t.in("web", "Search or jump to…")} shortcut="⌘K" onClick={() => setPaletteOpen(true)} />
      ) : null}
      {/* Phones log from the tab bar's "+". */}
      {sidebarHidden && !isMobile ? (
        <KWCircleButton icon="plus" variant="white" label={t.in("home", "Log transaction")} shortcut="N" onClick={() => openEditor()} />
      ) : null}
    </header>
  )
}

function MobileTabBar() {
  const t = useT()
  const isCurrent = useIsCurrent()
  const { openEditor } = useAppActions()
  const items = [...MAIN_NAV.slice(0, 2), undefined, ...MAIN_NAV.slice(2)]
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-divider bg-nav/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {items.map((item) =>
          item ? (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn("flex min-h-14 flex-col items-center justify-center gap-1", isCurrent(item) ? "text-foreground" : "text-text-faint")}
                aria-current={isCurrent(item) ? "page" : undefined}
              >
                <KWIcon name={item.kwIcon} size={24} />
                <span className="type-micro">{t.in(item.ns, item.title)}</span>
              </Link>
            </li>
          ) : (
            <li key="new" className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => openEditor()}
                className="flex size-12 items-center justify-center rounded-full bg-white text-black"
                aria-label={t.in("home", "Log transaction")}
              >
                <KWIcon name="plus" size={24} strokeWidth={2.2} />
              </button>
            </li>
          ),
        )}
      </ul>
    </nav>
  )
}
