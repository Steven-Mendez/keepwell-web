"use client"

import { useEffect, useRef, useState, type RefObject } from "react"

import { FOCUS_SEARCH_EVENT } from "@/components/app/keyboard-shortcuts"
import {
  TRANSACTION_FILTERS,
  type TransactionFilter,
  type TransactionScope,
} from "@/lib/domain"

/** The list's filters as URL parameters, leaving any others in place. */
function filtersUrl(
  filter: TransactionFilter,
  scope: TransactionScope
): string {
  const params = new URLSearchParams(window.location.search)
  if (filter === "all") params.delete("filter")
  else params.set("filter", filter)
  if (scope.kind === "account") params.set("account", scope.id)
  else params.delete("account")
  params.delete("search")
  const query = params.toString()
  return `${window.location.pathname}${query ? `?${query}` : ""}`
}

/**
 * The kind filter, the account scope and the search text, read from and written back to the URL,
 * plus the search field's ref for the "/" shortcut and the `?search` deep link.
 */
export function useTransactionFilters() {
  const [filter, setFilter] = useState<TransactionFilter>("all")
  const [scope, setScope] = useState<TransactionScope>({ kind: "all" })
  const [text, setText] = useState("")
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Deep links from home ("See all" drafts, the search button) and the "/" shortcut.
    const params = new URLSearchParams(window.location.search)
    const requested = params.get("filter")
    if (
      requested &&
      (TRANSACTION_FILTERS as readonly string[]).includes(requested)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is only readable after hydration
      setFilter(requested as TransactionFilter)
    }
    const account = params.get("account")
    if (account) setScope({ kind: "account", id: account })
    if (params.has("search")) search.current?.focus()
    const focus = () => search.current?.focus()
    window.addEventListener(FOCUS_SEARCH_EVENT, focus)
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focus)
  }, [])

  // The filters live in the URL, so a reload, the back button or a shared link keep them. Written
  // with history.replaceState, which Next's router picks up without re-rendering the route.
  useEffect(() => {
    const url = filtersUrl(filter, scope)
    if (url !== `${window.location.pathname}${window.location.search}`)
      window.history.replaceState(null, "", url)
  }, [filter, scope])

  return { filter, setFilter, scope, setScope, text, setText, search }
}

/** The row to focus next: the first or last when focus is outside the list, else one step, clamped. */
function nextRowIndex(
  current: number,
  forward: boolean,
  count: number
): number {
  if (current < 0) return forward ? 0 : count - 1
  return Math.min(count - 1, Math.max(0, current + (forward ? 1 : -1)))
}

/**
 * j / k (or ↓ / ↑ once a row has focus) walk the list and Enter opens the movement: Linear-style
 * keyboard triage on desktop.
 */
export function useRowKeyboardNavigation(list: RefObject<HTMLElement | null>) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          "input, textarea, select, [contenteditable], [role=dialog]"
        )
      )
        return
      const rows = [
        ...(list.current?.querySelectorAll<HTMLElement>(
          "[data-movement-row]"
        ) ?? []),
      ]
      if (rows.length === 0) return
      const inList = target ? rows.indexOf(target) : -1
      const forward =
        event.key === "j" || (inList >= 0 && event.key === "ArrowDown")
      const backward =
        event.key === "k" || (inList >= 0 && event.key === "ArrowUp")
      if (!forward && !backward) return
      event.preventDefault()
      const next = nextRowIndex(inList, forward, rows.length)
      rows[next]?.focus()
      rows[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [list])
}
