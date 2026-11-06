"use client"

import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
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
          <InsetHeader />
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

/** sidebar-01's inset header: the sidebar toggle and where you are. */
function InsetHeader() {
  const t = useT()
  const pathname = usePathname()
  const section = [...MAIN_NAV, SETTINGS_NAV].filter((item) => item.href !== "/").find((item) => pathname.startsWith(item.href)) ?? MAIN_NAV[0]!
  const isCategories = pathname.startsWith("/settings/categories")
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-divider bg-background/80 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink render={<Link href="/" />}>Keepwell</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:block" />
          {isCategories ? (
            <>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink render={<Link href="/settings" />}>{t.in("settings", "Settings")}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{t.in("settings", "Categories")}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : (
            <BreadcrumbItem>
              <BreadcrumbPage>{t.in(section.ns, section.title)}</BreadcrumbPage>
            </BreadcrumbItem>
          )}
        </BreadcrumbList>
      </Breadcrumb>
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
                <item.icon className="size-6" strokeWidth={2} aria-hidden />
                <span className="type-micro">{t.in(item.ns, item.title)}</span>
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
