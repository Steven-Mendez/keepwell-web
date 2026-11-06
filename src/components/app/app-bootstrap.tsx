"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { isStandalonePath } from "@/components/app/navigation"

import { materializeRecurring, normalizeBankCards } from "@/lib/domain"
import { requestPersistentStorage } from "@/lib/platform/persistent-storage"
import { categoryRepository, ledgerStore } from "@/lib/repositories"

/** Saves what recurring rules owe up to today; safe to run often, it never creates a movement twice. */
function materialize() {
  materializeRecurring(ledgerStore).catch((error: unknown) =>
    console.error("[keepwell] recurring movements failed", error)
  )
}

/**
 * Work that must happen once per launch before data is shown: keep IndexedDB from being evicted,
 * seed the shipped categories (iOS seeds them on its first fetch), bring bank accounts to "one
 * account, one card" (iOS `NormalizeBankCardsUseCase` on launch) and produce the recurring movements
 * that came due. Those are produced again whenever the tab comes back to the front (iOS foreground).
 */
export function AppBootstrap() {
  // Standalone pages (the design system) don't touch the device's ledger.
  const standalone = isStandalonePath(usePathname())
  useEffect(() => {
    if (standalone) return
    void requestPersistentStorage()
    // Logged instead of swallowed: a failed seed leaves Categories empty with no other trace.
    categoryRepository
      .ensureDefaults()
      .then(() => normalizeBankCards(ledgerStore))
      .then(materialize)
      .catch((error: unknown) => console.error("[keepwell] launch setup failed", error))
    const onVisible = () => {
      if (document.visibilityState === "visible") materialize()
    }
    window.addEventListener("focus", materialize)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("focus", materialize)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [standalone])
  return null
}
