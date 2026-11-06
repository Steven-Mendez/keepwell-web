"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { KWButton } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { toast } from "@/components/ui/toast"
import { exportCsvFrom, importCsv } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { requestPersistentStorage, type StoragePersistence } from "@/lib/platform/persistent-storage"
import { backupRepository, eraseAllData, ledgerStore, NothingToBackUpError } from "@/lib/repositories"

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

/**
 * Backup (.json, the file iOS reads too), CSV in and out and "Delete all my data" (iOS
 * SettingsSections `data`). The data lives in this browser, so its storage status sits here too.
 */
export function DataSection({ t }: { t: Translator }) {
  const router = useRouter()
  const [pendingRestore, setPendingRestore] = useState<File>()
  const [eraseOpen, setEraseOpen] = useState(false)
  const [persistence, setPersistence] = useState<StoragePersistence>()

  useEffect(() => {
    requestPersistentStorage().then(setPersistence, () => setPersistence("unsupported"))
  }, [])

  async function backUp() {
    try {
      const text = await backupRepository.export()
      const name = `Keepwell-${today()}.json`
      download(text, name, "application/json")
      toast.add({ title: t.in("web", "Backup saved · %@. Keep the file somewhere safe; Keepwell for iPhone can open it too.", name), type: "success" })
    } catch (error) {
      toast.add({ title: error instanceof NothingToBackUpError ? t.in("web", "Nothing to back up yet.") : t.in("settings", "We couldn't create the backup. Try again."), type: "error" })
    }
  }

  async function restore(file: File) {
    let text: string
    try {
      text = await file.text()
    } catch {
      toast.add({ title: t.in("settings", "We couldn't read that file."), type: "error" })
      return
    }
    try {
      const summary = await backupRepository.import(text)
      const when = new Date(summary.backupDate).toLocaleDateString(t.locale, { day: "numeric", month: "long", year: "numeric" })
      toast.add({ title: t.in("settings", "Restored the backup from %@ · %lld transactions", when, summary.transactions), type: "success" })
    } catch (error) {
      const isFormat = error instanceof Error && error.name === "BackupFormatError"
      toast.add({ title: isFormat ? t.in("settings", "That file isn't a Keepwell backup, so nothing was changed.") : t.in("settings", "We couldn't restore the backup. Try again."), type: "error" })
    }
  }

  async function exportCsv() {
    try {
      download(await exportCsvFrom(ledgerStore), `Keepwell-${today()}.csv`, "text/csv;charset=utf-8")
    } catch {
      toast.add({ title: t.in("settings", "We couldn't create the file. Try again."), type: "error" })
    }
  }

  async function importCsvFile(file: File) {
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

  async function erase() {
    try {
      await eraseAllData()
      router.replace("/welcome")
    } catch {
      toast.add({ title: t.in("settings", "We couldn't delete your data. Try again."), type: "error" })
    }
  }

  const backupPicker = useFilePicker("application/json,.json", setPendingRestore)
  const csvPicker = useFilePicker("text/csv,.csv", (file) => void importCsvFile(file))

  return (
    <>
      <SettingsSection title={t.in("settings", "Data")} footnote={t.in("web", "One .json file with everything. Restoring replaces all data in this browser.")}>
        <SettingsLinkRow label={t.in("settings", "Back up now")} onClick={() => void backUp()} />
        <SettingsLinkRow label={t.in("web", "Restore from a file")} onClick={backupPicker.open} />
        <SettingsLinkRow label={t.in("settings", "Export CSV")} onClick={() => void exportCsv()} />
        <SettingsLinkRow label={t.in("settings", "Import CSV")} onClick={csvPicker.open} />
        {backupPicker.element}
        {csvPicker.element}
      </SettingsSection>

      <SettingsSection title={t.in("web", "On this device")} footnote={t.in("web", "Your data lives in this browser. Back it up now and then to keep a copy.")}>
        <SettingsRow label={t.in("web", "Storage")} description={t.in("web", "Stored in this browser")}>
          {persistence === "persisted" ? (
            <StatusPill tone="positive">{t.in("web", "Kept by the browser")}</StatusPill>
          ) : persistence === "best-effort" ? (
            <StatusPill tone="pending">{t.in("web", "May be cleared")}</StatusPill>
          ) : (
            <StatusPill tone="neutral">{persistence ? "—" : "…"}</StatusPill>
          )}
        </SettingsRow>
      </SettingsSection>

      {/* iOS puts "Delete all my data" apart, as a full-width destructive row button. */}
      <div className="flex flex-col gap-2">
        <KWButton variant="destructive" size="row" fill onClick={() => setEraseOpen(true)}>
          <KWIcon name="trash" size={18} />
          {t.in("settings", "Delete all my data")}
        </KWButton>
        <p className="px-1 type-caption text-muted-foreground">{t.in("web", "Deletes the data in this browser.")}</p>
      </div>

      <ConfirmDialog
        open={pendingRestore !== undefined}
        onOpenChange={(open) => {
          if (!open) setPendingRestore(undefined)
        }}
        title={t.in("settings", "Replace your data with this backup?")}
        description={t.in("web", "What's in this browser now is replaced by the backup.")}
        action={t.in("settings", "Restore")}
        destructive
        onConfirm={() => {
          if (pendingRestore) void restore(pendingRestore)
          setPendingRestore(undefined)
        }}
      />
      <ConfirmDialog
        open={eraseOpen}
        onOpenChange={setEraseOpen}
        title={t.in("settings", "Delete all your data?")}
        description={t.in("web", "Your accounts, cards and transactions are deleted from this browser. This can't be undone.")}
        action={t.in("settings", "Delete everything")}
        destructive
        onConfirm={() => void erase()}
      />
    </>
  )
}

/** A state pill on its 14 % tint, as iOS shows state next to a value. */
function StatusPill({ tone, children }: { tone: "positive" | "pending" | "neutral"; children: React.ReactNode }) {
  const look = { positive: "bg-positive-tint text-positive", pending: "bg-pending-tint text-pending", neutral: "bg-secondary text-muted-foreground" }[tone]
  return <span className={`inline-flex h-6 items-center rounded-full px-2.5 type-caption font-semibold ${look}`}>{children}</span>
}
