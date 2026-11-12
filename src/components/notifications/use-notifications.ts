"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { useEffect, useMemo, useState } from "react"

import { useHiddenBalances } from "@/hooks/use-hidden-balances"
import { useLedger } from "@/hooks/use-ledger"
import { useT } from "@/lib/i18n"
import { notificationStateRepository, type NotificationState } from "@/lib/repositories"

import { buildInbox, EMPTY_INBOX, type Inbox } from "./notifications"

const NO_STATES: NotificationState[] = []

/** Recomputed each minute, so what applies follows midnight without a reload. */
function useMinute(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

/**
 * The live inbox for the bell and the Notifications page. Read and deleted states come from
 * IndexedDB, so a change synced from the iPhone or another tab shows up without a reload.
 */
export function useNotifications(): Inbox {
  const t = useT()
  const ledger = useLedger()
  const states = useLiveQuery(() => notificationStateRepository.list(), []) ?? NO_STATES
  const [hidden] = useHiddenBalances()
  const minute = useMinute()
  // Only the day matters for what applies; recomputing every minute would only cost renders.
  const day = minute.toDateString()
  const now = useMemo(() => new Date(), [day]) // eslint-disable-line react-hooks/exhaustive-deps
  return useMemo(() => (ledger ? buildInbox(t, ledger, states, now, hidden) : EMPTY_INBOX), [t, ledger, states, now, hidden])
}
