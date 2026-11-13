"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { useMemo, useSyncExternalStore } from "react"

import { loadLedger, type Ledger } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { TransactionDisplay } from "@/lib/presentation/display"
import type { LedgerStore } from "@/lib/domain/store"
import { ledgerStore, movementDeletions, profileStore } from "@/lib/repositories"

const NONE_PENDING: ReadonlySet<string> = new Set()

function subscribeDeletions(onChange: () => void) {
  return movementDeletions().subscribe(onChange)
}

/** Movements deleted with "Undo" still on screen: gone from every screen, though not yet from storage. */
function usePendingDeletions(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeDeletions, () => movementDeletions().pending(), () => NONE_PENDING)
}

/** The ledger as the screens show it, without the movements waiting to be deleted. */
function visibleStore(pending: ReadonlySet<string>): LedgerStore {
  if (pending.size === 0) return ledgerStore
  return {
    ...ledgerStore,
    fetchTransactions: async () => (await ledgerStore.fetchTransactions()).filter((transaction) => !pending.has(transaction.id)),
  }
}

/**
 * Everything recorded, live: IndexedDB changes (from this tab, another tab or a restore) re-render
 * every screen. `undefined` while the first read is in flight.
 */
export function useLedger(): Ledger | undefined {
  const pending = usePendingDeletions()
  return useLiveQuery(() => loadLedger(visibleStore(pending)), [pending])
}

/**
 * `useLedger` plus whether the read failed, for the screens that say so as iOS does ("We couldn't
 * load your goals."). A failed read would otherwise throw into the error boundary.
 */
export function useLedgerLoad(): { ledger?: Ledger; failed: boolean } {
  const pending = usePendingDeletions()
  const result = useLiveQuery(async () => {
    try {
      return { ledger: await loadLedger(visibleStore(pending)), failed: false }
    } catch {
      return { failed: true }
    }
  }, [pending])
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
