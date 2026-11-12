"use client"

import { HardDriveIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"

import { toast } from "@/components/ui/toast"
import type { Translator } from "@/lib/i18n"
import { signOut } from "@/lib/api/account"
import { downloadCsvExport } from "@/lib/platform/csv-download"
import { requestPersistentStorage, type StoragePersistence } from "@/lib/platform/persistent-storage"
import { eraseAllData } from "@/lib/repositories"

import { StatusPill } from "./account-section"
import { ConfirmDialog } from "./confirm-dialog"
import { SettingsLinkRow, SettingsRow, SettingsSection } from "./settings-rows"

/** Downloads a CSV of every movement. */
async function exportCsv(t: Translator) {
  try {
    await downloadCsvExport()
  } catch {
    toast.add({ title: t.in("settings", "We couldn't create the file. Try again."), type: "error" })
  }
}

/**
 * "Data & sync": the account's sync (when signed in), CSV export (the one way to keep a copy by hand) and the browser's storage status, since the data lives here.
 */
export function DataSection({ t, syncRows }: { t: Translator; syncRows?: ReactNode }) {
  const [persistence, setPersistence] = useState<StoragePersistence>()

  useEffect(() => {
    requestPersistentStorage().then(setPersistence, () => setPersistence("unsupported"))
  }, [])

  return (
    <SettingsSection id="data" title={t.in("settings", "Data & sync")} footnote={t.in("web", "Your data lives in this browser. Export a CSV now and then to keep a copy.")}>
      {syncRows}
      <SettingsLinkRow icon="share" label={t.in("settings", "Export CSV")} description={t.in("settings", "A copy of every movement")} onClick={() => void exportCsv(t)} />
      <SettingsRow icon={<HardDriveIcon strokeWidth={2} />} label={t.in("web", "Storage")} description={t.in("web", "Stored in this browser")}>
        {persistence === "persisted" ? (
          <StatusPill tone="positive">{t.in("web", "Kept by the browser")}</StatusPill>
        ) : persistence === "best-effort" ? (
          <StatusPill tone="pending">{t.in("web", "May be cleared")}</StatusPill>
        ) : (
          <StatusPill tone="neutral">{persistence ? "—" : "…"}</StatusPill>
        )}
      </SettingsRow>
    </SettingsSection>
  )
}

/** "Delete all my data" (iOS puts it apart, as a destructive row): this browser only, then the welcome. */
export function EraseDataRow({ t, signedIn = false, onSignedOut }: { t: Translator; signedIn?: boolean; onSignedOut?: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function erase() {
    try {
      await eraseAllData(signedIn ? { signOut } : {})
      if (signedIn) onSignedOut?.()
      router.replace("/welcome")
    } catch {
      // Sign-out may have gone through before the erase failed: let Settings show the signed-out state.
      if (signedIn) onSignedOut?.()
      toast.add({ title: t.in("settings", "We couldn't delete your data. Try again."), type: "error" })
    }
  }

  return (
    <>
      <SettingsLinkRow icon="trash" tone="destructive" label={t.in("settings", "Delete all my data")} description={t.in("web", "Deletes the data in this browser.")} onClick={() => setOpen(true)} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t.in("settings", "Delete all your data?")}
        description={
          signedIn
            ? `${t.in("web", "Your accounts, cards and transactions are deleted from this browser. This can't be undone.")} ${t.in("settings", "Your Keepwell account keeps its copy; to erase it too, delete your account.")} ${t.in("web", "You'll be signed out on this browser.")}`
            : t.in("web", "Your accounts, cards and transactions are deleted from this browser. This can't be undone.")
        }
        action={t.in("settings", "Delete everything")}
        destructive
        onConfirm={() => void erase()}
      />
    </>
  )
}
