"use client"

import { useCallback, useEffect, useState } from "react"

import { fetchMe, hasApi, type Me } from "@/lib/api/account"

export type AccountState =
  | { status: "unavailable" }
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; me: Me }
  | { status: "error"; message: string }

/** The account as the API sees it. `unavailable` when this build has no API configured. */
export function useAccount(): { state: AccountState; refresh: () => void } {
  const [state, setState] = useState<AccountState>(() => (hasApi ? { status: "loading" } : { status: "unavailable" }))
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!hasApi) return
    let cancelled = false
    fetchMe().then(
      (me) => !cancelled && setState(me ? { status: "signed-in", me } : { status: "signed-out" }),
      (error: unknown) => !cancelled && setState({ status: "error", message: error instanceof Error ? error.message : String(error) })
    )
    return () => {
      cancelled = true
    }
  }, [version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  return { state, refresh }
}
