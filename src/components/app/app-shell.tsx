"use client"

import { PlusIcon, SearchIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import { useLedger } from "@/hooks/use-ledger"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { AddAccountDialog } from "../accounts/add-account-dialog"
import { MovementDetail } from "../transactions/movement-detail"
import { MovementEditor } from "../movement-editor/movement-editor"
import { AppActionsProvider, useAppActions } from "./app-actions"
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
        <SidebarInset className="min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</SidebarInset>
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

function AppSidebar() {
  const t = useT()
  const isCurrent = useIsCurrent()
  const { openEditor, setPaletteOpen } = useAppActions()
  const row = (item: NavItem, index?: number) => (
    <SidebarMenuItem key={item.href}>
      <SidebarMenuButton isActive={isCurrent(item)} render={<Link href={item.href} />} size="lg" className="gap-3 text-label">
        <item.icon />
        <span className="flex-1">{t.in(item.ns, item.title)}</span>
        <Kbd className="opacity-0 transition-opacity group-hover/menu-item:opacity-100">{index === undefined ? item.key : index + 1}</Kbd>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )

  return (
    <Sidebar collapsible="none" className="sticky top-0 hidden h-svh w-60 border-r border-sidebar-border md:flex">
      <SidebarHeader className="gap-4 px-3 pt-5">
        <Link href="/" className="flex items-center gap-2 px-2 text-heading">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG, nothing to optimize */}
          <img src="/icon.svg" alt="" className="size-7 rounded-mini" />
          Keepwell
        </Link>
        <Button className="w-full justify-start gap-2" onClick={() => openEditor()}>
          <PlusIcon data-icon="inline-start" />
          <span className="flex-1 text-left">{t.in("home", "Log transaction")}</span>
          <Kbd className="bg-black/10 text-primary-foreground/70">N</Kbd>
        </Button>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-9 items-center gap-2 rounded-lg bg-secondary/70 px-3 text-label text-muted-foreground transition-colors hover:bg-secondary"
        >
          <SearchIcon className="size-4" aria-hidden />
          <span className="flex-1 text-left">{t.in("web", "Search or jump to…")}</span>
          <Kbd>⌘K</Kbd>
        </button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{MAIN_NAV.map(row)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="pb-4">
        <SidebarMenu>{row(SETTINGS_NAV)}</SidebarMenu>
      </SidebarFooter>
    </Sidebar>
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
                <item.icon className="size-6" strokeWidth={2} aria-hidden />
                <span className="text-micro">{t.in(item.ns, item.title)}</span>
              </Link>
            </li>
          ) : (
            <li key="new" className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => openEditor()}
                className="flex size-12 items-center justify-center rounded-full bg-brand-500 text-white shadow-glow"
                aria-label={t.in("home", "Log transaction")}
              >
                <PlusIcon className="size-6" strokeWidth={2.5} aria-hidden />
              </button>
            </li>
          ),
        )}
      </ul>
    </nav>
  )
}
