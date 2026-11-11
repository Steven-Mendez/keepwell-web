"use client"

import { useMemo, useState } from "react"

import { useHiddenBalances } from "@/hooks/use-hidden-balances"
import { useLedger } from "@/hooks/use-ledger"
import { useT } from "@/lib/i18n"

import { buildNotifications, type Notifications } from "./notifications"

const NONE: Notifications = { reminders: [], proposed: [], count: 0 }

/**
 * The live notifications for the bell and the Notifications page. `now` is fixed per mount, like
 * Home's, so what's due doesn't shift under the person; a new visit recomputes it.
 */
export function useNotifications(): Notifications {
  const t = useT()
  const ledger = useLedger()
  const [hidden] = useHiddenBalances()
  const [now] = useState(() => new Date())
  return useMemo(
    () => (ledger ? buildNotifications(t, ledger, now, hidden) : NONE),
    [t, ledger, now, hidden]
  )
}
