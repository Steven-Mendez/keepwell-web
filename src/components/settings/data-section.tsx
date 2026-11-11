"use client"

import { HardDriveIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"

import { toast } from "@/components/ui/toast"
import { exportCsvFrom, importCsv } from "@/lib/domain/csv"
import type { Translator } from "@/lib/i18n"
import { signOut } from "@/lib/api/account"
import { requestPersistentStorage, type StoragePersistence } from "@/lib/platform/persistent-storage"
import { eraseAllData, ledgerStore } from "@/lib/repositories"

import { StatusPill } from "./account-section"
import { ConfirmDialog } from "./confirm-dialog"
import { SettingsLinkRow, SettingsRow, SettingsSection } from "./settings-rows"

function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

const today = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

/** Pick one file through a hidden input, the browser's stand-in for the iOS document picker. */
function useFilePicker(accept: string, onFile: (file: File) => void) {
  const input = useRef<HTMLInputElement>(null)
  const element = (
    <input
      ref={input}
      type="file"
      accept={accept}
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ""
        if (file) onFile(file)
      }}
    />
  )
  return { open: () => input.current?.click(), element }
}

/** Downloads a CSV of every movement. */
async function exportCsv(t: Translator) {
  try {
    download(await exportCsvFrom(ledgerStore), `Keepwell-${today()}.csv`, "text/csv;charset=utf-8")
  } catch {
    toast.add({ title: t.in("settings", "We couldn't create the file. Try again."), type: "error" })
  }
}

async function importCsvFile(t: Translator, file: File) {
  let text: string
  try {
    text = await file.text()
  } catch {
    toast.add({ title: t.in("settings", "We couldn't read that file. Export it again as CSV (UTF-8)."), type: "error" })
    return
  }
  try {
    const result = await importCsv(ledgerStore, text)
    toast.add({
      title: t.in("settings", "%lld transactions imported", result.imported),
      ...(result.skipped > 0 ? { description: t.in("settings", "%lld rows skipped", result.skipped) } : {}),
      type: result.imported > 0 ? "success" : "info",
    })
  } catch {
    toast.add({ title: t.in("settings", "We couldn't import the file. Try again."), type: "error" })
  }
}

/**
 * "Data & sync": the account's sync (when signed in), CSV in and out (the one way to keep a copy or
 * move movements by hand) and the browser's storage status, since the data lives here.
 */
export function DataSection({ t, syncRows }: { t: Translator; syncRows?: ReactNode }) {
  const [persistence, setPersistence] = useState<StoragePersistence>()

  useEffect(() => {
    requestPersistentStorage().then(setPersistence, () => setPersistence("unsupported"))
  }, [])

  const csvPicker = useFilePicker("text/csv,.csv", (file) => void importCsvFile(t, file))

  return (
    <SettingsSection id="data" title={t.in("settings", "Data & sync")} footnote={t.in("web", "Your data lives in this browser. Export a CSV now and then to keep a copy.")}>
      {syncRows}
      <SettingsLinkRow icon="share" label={t.in("settings", "Export CSV")} description={t.in("web", "Every movement, in a file for a spreadsheet.")} onClick={() => void exportCsv(t)} />
      <SettingsLinkRow icon="download" label={t.in("settings", "Import CSV")} description={t.in("web", "Adds movements from a CSV file.")} onClick={csvPicker.open} />
      {csvPicker.element}
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
