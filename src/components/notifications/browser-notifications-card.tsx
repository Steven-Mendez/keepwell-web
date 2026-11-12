"use client"

import { useEffect, useState } from "react"

import { KWButton } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { toast } from "@/components/ui/toast"
import { useAccount } from "@/hooks/use-account"
import { useT } from "@/lib/i18n"
import {
  browserPushStatus,
  disableBrowserPush,
  enableBrowserPush,
  type BrowserPushStatus,
} from "@/lib/push/web-push"

/**
 * Turns native notifications on for this browser. Hidden where the browser can't receive them or
 * the build has no API; a signed-out person is told why they can't, since the server sends them.
 */
export function BrowserNotificationsCard() {
  const t = useT()
  const { state } = useAccount()
  const [status, setStatus] = useState<BrowserPushStatus | undefined>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void browserPushStatus().then(setStatus)
  }, [])

  if (!status || status === "unsupported" || state.status === "unavailable" || state.status === "loading") return null

  const signedIn = state.status === "signed-in"
  const run = async (work: () => Promise<BrowserPushStatus | void>) => {
    setBusy(true)
    try {
      const next = await work()
      setStatus(next ?? "off")
    } catch {
      toast.add({ title: t.in("web", "We couldn't turn on notifications. Try again."), type: "error" })
    } finally {
      setBusy(false)
    }
  }

  const message = !signedIn
    ? t.in("web", "Sign in with your account to get notifications in this browser.")
    : status === "denied"
      ? t.in("web", "Notifications are blocked for this site. Allow them in the browser's site settings.")
      : status === "on"
        ? t.in("web", "Notifications are on in this browser.")
        : t.in("web", "Payments, renewals and budgets reach you even with Keepwell closed.")

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-link">
        <KWIcon name="bolt" size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="type-label text-foreground">{t.in("web", "Get them in this browser")}</p>
        <p className="type-caption text-muted-foreground">{message}</p>
      </div>
      {signedIn && status === "off" ? (
        <KWButton size="mini" disabled={busy} onClick={() => void run(enableBrowserPush)}>
          {t.in("web", "Turn on")}
        </KWButton>
      ) : null}
      {signedIn && status === "on" ? (
        <KWButton size="mini" variant="secondary" disabled={busy} onClick={() => void run(disableBrowserPush)}>
          {t.in("web", "Turn off")}
        </KWButton>
      ) : null}
    </div>
  )
}
