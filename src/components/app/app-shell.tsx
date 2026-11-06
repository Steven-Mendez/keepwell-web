"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

import { MAIN_NAV, SETTINGS_NAV, type NavItem } from "./navigation"

/**
 * Desktop: a left sidebar with the iOS sections, like desktop finance apps. Phone widths (below the
 * sidebar's own `md` breakpoint): the sidebar hides and a bottom tab bar takes over, like iOS
 * MainTabView.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</SidebarInset>
      <MobileTabBar />
    </SidebarProvider>
  )
}

function useIsCurrent() {
  const pathname = usePathname()
  return (item: NavItem) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))
}

function AppSidebar() {
  const isCurrent = useIsCurrent()
  const row = (item: NavItem) => (
    <SidebarMenuItem key={item.href}>
      {item.isAvailable ? (
        <SidebarMenuButton isActive={isCurrent(item)} render={<Link href={item.href} />}>
          <item.icon />
          <span>{item.title}</span>
        </SidebarMenuButton>
      ) : (
        <>
          <SidebarMenuButton disabled aria-disabled>
            <item.icon />
            <span>{item.title}</span>
          </SidebarMenuButton>
          <SidebarMenuBadge>Soon</SidebarMenuBadge>
        </>
      )}
    </SidebarMenuItem>
  )

  return (
    <Sidebar collapsible="none" className="sticky top-0 hidden h-svh border-r border-sidebar-border md:flex">
      <SidebarHeader className="px-4 py-5">
        <Link href="/" className="flex items-center gap-2 text-heading">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG, nothing to optimize */}
          <img src="/icon.svg" alt="" className="size-7 rounded-mini" />
          Keepwell
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{MAIN_NAV.map(row)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>{row(SETTINGS_NAV)}</SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

function MobileTabBar() {
  const isCurrent = useIsCurrent()
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-divider bg-nav/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {MAIN_NAV.map((item) => {
          const content = (
            <>
              <item.icon className="size-6" strokeWidth={2} aria-hidden />
              <span className="text-micro">{item.title}</span>
            </>
          )
          const className = cn(
            "flex min-h-14 flex-col items-center justify-center gap-1",
            isCurrent(item) ? "text-foreground" : "text-text-faint",
          )
          return (
            <li key={item.href}>
              {item.isAvailable ? (
                <Link href={item.href} className={className} aria-current={isCurrent(item) ? "page" : undefined}>
                  {content}
                </Link>
              ) : (
                <span className={cn(className, "opacity-50")} aria-disabled title={`${item.title} — soon`}>
                  {content}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
