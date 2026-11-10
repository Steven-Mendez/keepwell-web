"use client"

import { MonitorSmartphoneIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { KWButton } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { ConfirmDialog } from "@/components/settings/confirm-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { syncScheduler } from "@/hooks/use-sync"
import { useT, type Translator } from "@/lib/i18n"
import { keepBrowserData, takeAccountData, type SyncStatus } from "@/lib/sync/engine"
import type { DataCounts } from "@/lib/sync/first-sync"
import { httpTransport } from "@/lib/sync/transport"
import { cn } from "@/lib/utils"

const OPEN_EVENT = "keepwell:sync-choice"
const DISMISSED = "keepwell.syncChoiceDismissed"

/** Opens the dialog again after "Decide later" (Settings' sync row). */
export function openSyncChoice() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

/** "12 movements · 3 accounts", then the other kinds of data that side holds. */
export function describeCounts(t: Translator, counts: DataCounts): string {
  const parts = [t.in("web", "sync.count.movements", counts.transaction), t.in("home", "%lld accounts", counts.account)]
  const more: [number, string][] = [
    [counts.recurringRule, "sync.count.recurring"],
    [counts.savingsGoal, "sync.count.goals"],
    [counts.loan + counts.personalDebt, "sync.count.debts"],
    [counts.categorizationRule, "sync.count.rules"],
  ]
  for (const [count, key] of more) if (count > 0) parts.push(t.in("web", key, count))
  return parts.join(" · ")
}

/**
 * The first sync of this browser with an account that already has data, while this browser has its
 * own: sync is paused until the person keeps one side. Opens by itself once per session (and again
 * from Settings after "Decide later").
 */
export function SyncChoiceDialog({ status, userId }: { status: SyncStatus | undefined; userId?: string | undefined }) {
  const t = useT()
  const choice = status?.state === "needs_choice" ? status.choice : undefined
  // Opens by itself until "Decide later" in this session; Settings opens it again on request.
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISSED) === "1"
    } catch {
      return false
    }
  })
  const [requested, setRequested] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState<"account" | "browser">()
  const open = choice !== undefined && (requested || !dismissed)

  useEffect(() => {
    const show = () => setRequested(true)
    window.addEventListener(OPEN_EVENT, show)
    return () => window.removeEventListener(OPEN_EVENT, show)
  }, [])

  if (!choice) return null

  const decideLater = () => {
    try {
      sessionStorage.setItem(DISMISSED, "1")
    } catch {}
    setDismissed(true)
    setRequested(false)
  }

  const resolve = async (side: "account" | "browser") => {
    setBusy(side)
    try {
      // False: the choice was for another account; it's dropped and the next round decides again.
      if (side === "account") await takeAccountData(httpTransport, userId)
      else await keepBrowserData(httpTransport, userId)
      const after = await syncScheduler().runNow()
      if (after.state === "error" || after.state === "offline") {
        toast.add({ title: t.in("web", "Couldn't sync. Keepwell will try again."), type: "error" })
      }
      setRequested(false)
    } catch {
      toast.add({ title: t.in("web", "Couldn't reach Keepwell. Try again."), type: "error" })
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? setRequested(true) : busy ? undefined : decideLater())}>
        <DialogContent showCloseButton={false} className="max-h-[90svh] gap-5 overflow-y-auto rounded-2xl bg-background p-6 ring-1 ring-border/60 sm:max-w-lg">
          <DialogHeader className="gap-2">
            <DialogTitle className="type-heading">{t.in("web", "This browser and your account have different data")}</DialogTitle>
            <DialogDescription className="type-body leading-relaxed text-muted-foreground">
              {t.in("web", "Choose which to keep. The other is replaced, and this can't be undone.")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <ChoiceCard
              icon={<KWIcon name="cloud" size={20} />}
              title={t.in("web", "Use your account's data")}
              description={t.in("web", "Replaces what's in this browser with the data in your Keepwell account.")}
              counts={describeCounts(t, choice.cloud)}
              busy={busy === "account"}
              disabled={busy !== undefined}
              onClick={() => void resolve("account")}
            />
            <ChoiceCard
              icon={<MonitorSmartphoneIcon className="size-5" strokeWidth={2} aria-hidden />}
              title={t.in("web", "Keep this browser's data")}
              description={t.in("web", "Replaces your account's data, on every device, with what's here.")}
              counts={describeCounts(t, choice.local)}
              busy={busy === "browser"}
              disabled={busy !== undefined}
              onClick={() => setConfirming(true)}
            />
          </div>
          <KWButton variant="plain" size="regular" className="self-center" disabled={busy !== undefined} onClick={decideLater}>
            {t.in("web", "Decide later")}
          </KWButton>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t.in("web", "Replace your account's data?")}
        description={t.in("web", "Everything in your Keepwell account is deleted on every device and replaced with what's in this browser. This can't be undone.")}
        action={t.in("web", "Replace")}
        destructive
        onConfirm={() => void resolve("browser")}
      />
    </>
  )
}

function ChoiceCard({ icon, title, description, counts, busy, disabled, onClick }: { icon: ReactNode; title: string; description: string; counts: string; busy: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-[var(--radius-surface)] bg-card p-4 text-left ring-1 ring-transparent transition-[background-color,box-shadow] outline-none press-row",
        "hover:bg-secondary/60 focus-visible:ring-ring disabled:opacity-60"
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground" aria-hidden>
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="type-label text-foreground">{title}</span>
        <span className="type-caption leading-relaxed text-muted-foreground">{description}</span>
        <span className="type-caption font-semibold text-text-secondary tabular-nums">{counts}</span>
      </span>
      {busy ? <Spinner className="mt-2.5 size-4 shrink-0 text-muted-foreground" /> : <KWIcon name="chevronRight" size={16} className="mt-3 shrink-0 text-text-faint" />}
    </button>
  )
}
