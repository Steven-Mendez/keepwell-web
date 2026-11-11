"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { useMemo, useSyncExternalStore } from "react"

import { loadLedger, type Ledger } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { TransactionDisplay } from "@/lib/presentation/display"
import { ledgerStore, profileStore } from "@/lib/repositories"

/**
 * Everything recorded, live: IndexedDB changes (from this tab, another tab or a restore) re-render
 * every screen. `undefined` while the first read is in flight.
 */
export function useLedger(): Ledger | undefined {
  return useLiveQuery(() => loadLedger(ledgerStore), [])
}

/**
 * `useLedger` plus whether the read failed, for the screens that say so as iOS does ("We couldn't
 * load your goals."). A failed read would otherwise throw into the error boundary.
 */
export function useLedgerLoad(): { ledger?: Ledger; failed: boolean } {
  const result = useLiveQuery(async () => {
    try {
      return { ledger: await loadLedger(ledgerStore), failed: false }
    } catch {
      return { failed: true }
    }
  }, [])
  return result ?? { failed: false }
}

/** How movements read, for the current language and ledger. */
export function useTransactionDisplay(ledger: Ledger | undefined): TransactionDisplay | undefined {
  const t = useT()
  return useMemo(() => (ledger ? new TransactionDisplay(t, ledger) : undefined), [t, ledger])
}

function subscribeProfile(onChange: () => void) {
  window.addEventListener("keepwell:profile", onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener("keepwell:profile", onChange)
    window.removeEventListener("storage", onChange)
  }
}

/** The name the app greets with, device-local like iOS. */
export function usePreferredName(): string | undefined {
  return useSyncExternalStore(subscribeProfile, () => profileStore.preferredName(), () => undefined)
}
