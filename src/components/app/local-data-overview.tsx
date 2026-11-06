"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  accountRepository,
  backupRepository,
  cardRepository,
  categoryRepository,
  settingsRepository,
  syncOutboxRepository,
  transactionRepository,
} from "@/lib/repositories"
import { BackupFormatError } from "@/lib/schema"

type Status = { tone: "positive" | "negative"; text: string } | null

/** Live counts from IndexedDB through the repositories, plus the backup file shared with iOS. */
export function LocalDataOverview() {
  const counts = useLiveQuery(async () => {
    const [accounts, cards, categories, transactions, outbox, settings] = await Promise.all([
      accountRepository.list(),
      cardRepository.list(),
      categoryRepository.list(),
      transactionRepository.list(),
      syncOutboxRepository.pendingCount(),
      settingsRepository.load(),
    ])
    return {
      rows: [
        { label: "Accounts", value: accounts.length },
        { label: "Cards", value: cards.length },
        { label: "Categories", value: categories.length },
        { label: "Movements", value: transactions.length },
        { label: "Changes waiting to sync", value: outbox },
      ],
      hasSettings: settings !== undefined,
    }
  })
  const [status, setStatus] = useState<Status>(null)
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
      setStatus({ tone: "positive", text: "Backup saved." })
    } catch (error) {
      setStatus({ tone: "negative", text: error instanceof Error ? error.message : "The backup could not be saved." })
    }
  }

  async function importBackup(file: File) {
    try {
      const summary = await backupRepository.import(await file.text())
      setStatus({
        tone: "positive",
        text: `Restored ${summary.accounts} accounts and ${summary.transactions} movements from ${new Date(summary.backupDate).toLocaleString()}.`,
      })
    } catch (error) {
      const text = error instanceof BackupFormatError || error instanceof Error ? error.message : "The file could not be restored."
      setStatus({ tone: "negative", text })
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <dl className="divide-y divide-divider rounded-surface bg-card">
        {(counts?.rows ?? []).map((row) => (
          <div key={row.label} className="flex items-center justify-between px-4 py-3">
            <dt className="text-label text-text-secondary">{row.label}</dt>
            <dd className="text-amount-sm tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={() => void exportBackup()} disabled={!counts?.hasSettings}>
          Export backup (.json)
        </Button>
        <Button size="lg" variant="secondary" onClick={() => fileInput.current?.click()}>
          Restore from a backup file
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
      </div>
      {status && (
        <p role="status" className={status.tone === "positive" ? "text-caption text-positive" : "text-caption text-negative"}>
          {status.text}
        </p>
      )}
    </section>
  )
}
