"use client"

import { usePathname, useRouter } from "next/navigation"

import { tagLabel } from "@/components/kw/tag-editor"

import { SHOW_RULE_EVENT, SHOW_TAG_EVENT } from "./use-transaction-filters"

/** Narrows Transactions to a tag, as typing "#boda" in its search does: in place when it's open. */
export function useShowTag(): (tag: string) => void {
  const router = useRouter()
  const pathname = usePathname()
  return (tag) => {
    const query = tagLabel(tag)
    if (pathname === "/transactions") window.dispatchEvent(new CustomEvent(SHOW_TAG_EVENT, { detail: query }))
    else router.push(`/transactions?q=${encodeURIComponent(query)}`)
  }
}

/** Every movement a recurring rule recorded ("See all" in its sheet): in place when Transactions is open. */
export function useShowRuleMovements(): (ruleId: string) => void {
  const router = useRouter()
  const pathname = usePathname()
  return (ruleId) => {
    if (pathname === "/transactions") window.dispatchEvent(new CustomEvent(SHOW_RULE_EVENT, { detail: ruleId }))
    else router.push(`/transactions?rule=${encodeURIComponent(ruleId)}`)
  }
}
