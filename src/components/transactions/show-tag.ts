"use client"

import { usePathname, useRouter } from "next/navigation"

import { tagLabel } from "@/components/kw/tag-editor"

import { SHOW_TAG_EVENT } from "./use-transaction-filters"

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
