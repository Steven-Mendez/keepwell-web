"use client"

import { useEffect, useRef, useState, type RefObject } from "react"

import { FOCUS_SEARCH_EVENT } from "@/components/app/keyboard-shortcuts"
import type {
  AmountRange,
  TransactionFilter,
  TransactionOrigin,
  TransactionScope,
} from "@/lib/domain"

import { readFilterParams, writeFilterParams } from "./filter-params"

/** Narrows the open Transactions screen to a tag ("#boda"); `useShowTag` sends it. */
export const SHOW_TAG_EVENT = "keepwell:show-tag"
/** Narrows the open Transactions screen to what one recurring rule recorded; `useShowRuleMovements` sends it. */
export const SHOW_RULE_EVENT = "keepwell:show-rule"

/** The list's filters as URL parameters, leaving any others in place. */
function filtersUrl(
  filter: TransactionFilter,
  scope: TransactionScope,
  amount: AmountRange,
  origin: TransactionOrigin
): string {
  const params = writeFilterParams(
    new URLSearchParams(window.location.search),
    { filter, scope, amount, origin }
  )
  params.delete("search")
  params.delete("q")
  const query = params.toString()
  return `${window.location.pathname}${query ? `?${query}` : ""}`
}

/**
 * The kind filter, the account scope, the amount range, the origin and the search text, read from
 * and written back to the URL, plus the search field's ref for the "/" shortcut and the `?search`
 * deep link.
 */
export function useTransactionFilters() {
  const [filter, setFilter] = useState<TransactionFilter>("all")
  const [scope, setScope] = useState<TransactionScope>({ kind: "all" })
  const [amount, setAmount] = useState<AmountRange>({})
  const [origin, setOrigin] = useState<TransactionOrigin>({ kind: "any" })
  const [text, setText] = useState("")
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Deep links from home ("See all" drafts, the search button), from a rule ("See all" it
    // recorded) and the "/" shortcut.
    const params = new URLSearchParams(window.location.search)
    const linked = readFilterParams(params)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is only readable after hydration
    setFilter(linked.filter)
    setScope(linked.scope)
    setAmount(linked.amount)
    setOrigin(linked.origin)
    if (params.has("search")) search.current?.focus()
    // "#boda" from a movement's tag, opened from another screen.
    const query = params.get("q")
    if (query) setText(query)
    const focus = () => search.current?.focus()
    const showTag = (event: Event) => setText((event as CustomEvent<string>).detail)
    // The rule's whole list, as a fresh link to it would open.
    const showRule = (event: Event) => {
      setFilter("all")
      setScope({ kind: "all" })
      setAmount({})
      setText("")
      setOrigin({ kind: "rule", id: (event as CustomEvent<string>).detail })
    }
    window.addEventListener(FOCUS_SEARCH_EVENT, focus)
    window.addEventListener(SHOW_TAG_EVENT, showTag)
    window.addEventListener(SHOW_RULE_EVENT, showRule)
    return () => {
      window.removeEventListener(FOCUS_SEARCH_EVENT, focus)
      window.removeEventListener(SHOW_TAG_EVENT, showTag)
      window.removeEventListener(SHOW_RULE_EVENT, showRule)
    }
  }, [])

  // The filters live in the URL, so a reload, the back button or a shared link keep them. Written
  // with history.replaceState, which Next's router picks up without re-rendering the route.
  useEffect(() => {
    const url = filtersUrl(filter, scope, amount, origin)
    if (url !== `${window.location.pathname}${window.location.search}`)
      window.history.replaceState(null, "", url)
  }, [filter, scope, amount, origin])

  return {
    filter,
    setFilter,
    scope,
    setScope,
    amount,
    setAmount,
    origin,
    setOrigin,
    text,
    setText,
    search,
  }
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
