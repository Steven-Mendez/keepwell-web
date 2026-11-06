"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { DownloadIcon, UploadIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/toast"
import { requestPersistentStorage, type StoragePersistence } from "@/lib/platform/persistent-storage"
import {
  accountRepository,
  backupRepository,
  cardRepository,
  categoryRepository,
  settingsRepository,
  syncOutboxRepository,
  transactionRepository,
} from "@/lib/repositories"

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

/** Stack proof for this phase: live IndexedDB data through the repositories, and the iOS backup file. */
export function LocalDataOverview() {
  const data = useLiveQuery(async () => {
    const [accounts, cards, categories, transactions, pending, settings] = await Promise.all([
      accountRepository.list(),
      cardRepository.list(),
      categoryRepository.list(),
      transactionRepository.list(),
      syncOutboxRepository.pendingCount(),
      settingsRepository.load(),
    ])
    return {
      counts: [
        { label: "Accounts", value: accounts.length },
        { label: "Cards", value: cards.length },
        { label: "Categories", value: categories.length },
        { label: "Movements", value: transactions.length },
      ],
      pending,
      hasSettings: settings !== undefined,
    }
  })

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-heading">On this device</CardTitle>
          <CardDescription>Stored in this browser and available offline.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(data?.counts ?? []).map((row) => (
              <div key={row.label} className="rounded-lg bg-muted px-4 py-3">
                <dt className="text-caption text-muted-foreground">{row.label}</dt>
                <dd className="text-amount-sm tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <SyncCard pending={data?.pending} />
      <BackupCard canExport={data?.hasSettings ?? false} />
    </div>
  )
}

function SyncCard({ pending }: { pending: number | undefined }) {
  const [persistence, setPersistence] = useState<StoragePersistence>()
  useEffect(() => {
    requestPersistentStorage().then(setPersistence, () => setPersistence("unsupported"))
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-heading">Sync</CardTitle>
        <CardDescription>Changes wait here until cloud sync is turned on.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-label text-text-secondary">Pending changes</span>
          <span className="text-amount-sm tabular-nums">{pending ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-label text-text-secondary">Storage</span>
          {persistence === "persisted" ? (
            <Badge className="bg-positive-tint text-positive">Kept by the browser</Badge>
          ) : persistence === "best-effort" ? (
            <Badge className="bg-pending-tint text-pending">May be cleared</Badge>
          ) : (
            <Badge variant="secondary">{persistence === "unsupported" ? "Unknown" : "Checking…"}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function BackupCard({ canExport }: { canExport: boolean }) {
  const fileInput = useRef<HTMLInputElement>(null)

  async function exportBackup() {
    try {
      const text = await backupRepository.export()
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }))
      const link = document.createElement("a")
      link.href = url
      link.download = `Keepwell-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      toast.add({ title: "Backup saved", type: "success" })
    } catch (error) {
      toast.add({ title: "Backup not saved", description: errorText(error, "Try again."), type: "error" })
    }
  }

  async function importBackup(file: File) {
    try {
      const summary = await backupRepository.import(await file.text())
      toast.add({
        title: "Backup restored",
        description: `${summary.accounts} accounts and ${summary.transactions} movements from ${new Date(summary.backupDate).toLocaleString()}.`,
        type: "success",
      })
    } catch (error) {
      toast.add({ title: "Backup not restored", description: errorText(error, "Your data wasn't changed."), type: "error" })
    }
  }

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-heading">Backup</CardTitle>
        <CardDescription>
          One .json file with everything, readable by Keepwell for iPhone too. Restoring replaces all data on this device.
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex flex-wrap gap-2 border-t pt-4">
        <Button onClick={() => void exportBackup()} disabled={!canExport}>
          <DownloadIcon data-icon="inline-start" />
          Export backup
        </Button>
        <Button variant="secondary" onClick={() => fileInput.current?.click()}>
          <UploadIcon data-icon="inline-start" />
          Restore from a file
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (file) void importBackup(file)
          }}
        />
      </CardFooter>
    </Card>
  )
}
