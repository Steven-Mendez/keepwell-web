"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { useT } from "@/lib/i18n"

import { useAppActions } from "./app-actions"
import { MAIN_NAV, SETTINGS_NAV } from "./navigation"

export const FOCUS_SEARCH_EVENT = "keepwell:focus-search"

/** Typing in a field, or a dialog already open, leaves the keys alone. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

function dialogIsOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
}

/**
 * Desktop keyboard navigation: ⌘K palette, N new movement (E/I/T by type), 1–4 and "g" then a
 * letter for the sections, "," settings, "/" search, "?" this list.
 */
export function KeyboardShortcuts() {
  const t = useT()
  const router = useRouter()
  const { openEditor, setPaletteOpen, shortcutsOpen, setShortcutsOpen } = useAppActions()
  const pendingG = useRef<number | undefined>(undefined)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target) || dialogIsOpen()) return
      const key = event.key.toLowerCase()
      if (pendingG.current !== undefined) {
        window.clearTimeout(pendingG.current)
        pendingG.current = undefined
        const target = [...MAIN_NAV, SETTINGS_NAV].find((item) => item.key === key)
        if (target) {
          event.preventDefault()
          router.push(target.href)
        }
        return
      }
      const go = (href: string) => {
        event.preventDefault()
        router.push(href)
      }
      switch (key) {
        case "g":
          pendingG.current = window.setTimeout(() => (pendingG.current = undefined), 1200)
          return
        case "n":
          event.preventDefault()
          openEditor()
          return
        case "e":
          event.preventDefault()
          openEditor({ mode: "create", type: "expense" })
          return
        case "i":
          event.preventDefault()
          openEditor({ mode: "create", type: "income" })
          return
        case "t":
          event.preventDefault()
          openEditor({ mode: "create", type: "transfer" })
          return
        case "1":
        case "2":
        case "3":
        case "4":
          go(MAIN_NAV[Number(key) - 1]!.href)
          return
        case ",":
          go(SETTINGS_NAV.href)
          return
        case "/":
          event.preventDefault()
          if (window.location.pathname !== "/transactions") router.push("/transactions?search=1")
          else window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT))
          return
        case "?":
          event.preventDefault()
          setShortcutsOpen(true)
          return
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [openEditor, router, setPaletteOpen, setShortcutsOpen])

  const rows: [string[], string][] = [
    [["⌘", "K"], t.in("web", "Command palette")],
    [["N"], t.in("home", "Log transaction")],
    [["E"], t.in("web", "New expense")],
    [["I"], t.in("web", "New income")],
    [["T"], t.in("web", "New transfer")],
    [["/"], t.in("web", "Focus search")],
    ...MAIN_NAV.map((item, index): [string[], string] => [[String(index + 1)], t.in(item.ns, item.title)]),
    ...[...MAIN_NAV, SETTINGS_NAV].map((item): [string[], string] => [["G", item.key.toUpperCase()], t.in(item.ns, item.title)]),
    [["?"], t.in("web", "Show shortcuts")],
    [["Esc"], t.in("web", "Close panel")],
  ]

  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.in("web", "Keyboard shortcuts")}</DialogTitle>
        </DialogHeader>
        <ul className="grid gap-1">
          {rows.map(([keys, label]) => (
            <li key={keys.join("+") + label} className="flex items-center justify-between gap-4 rounded-md px-1 py-1.5">
              <span className="text-body">{label}</span>
              <KbdGroup>
                {keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </KbdGroup>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
