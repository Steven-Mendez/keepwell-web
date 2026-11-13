"use client" // Error boundaries must be Client Components

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { downloadCsvExport } from "@/lib/platform/csv-download"

/**
 * Shown when a page fails to render, inside the root layout (so the language and styles are there).
 * The ledger lives in IndexedDB, untouched by a render error: reload, or take a CSV copy first.
 */
export default function ErrorPage({ error }: { error: unknown; retry: () => void }) {
  const t = useT()
  const [exportFailed, setExportFailed] = useState(false)

  useEffect(() => {
    console.error(error)
  }, [error])

  async function exportCsv() {
    setExportFailed(false)
    try {
      await downloadCsvExport()
    } catch {
      setExportFailed(true)
    }
  }

  return (
    <div role="alert" className="flex min-h-svh flex-col items-center justify-center gap-4 px-(--gutter) text-center">
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="type-title">{t.in("web", "Something went wrong")}</h1>
        <p className="type-body text-muted-foreground">
          {t.in("web", "Keepwell couldn't show this page. Your data is still on this device: reload to try again, or export a CSV to keep a copy.")}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="lg" onClick={() => window.location.reload()}>
          {t.in("web", "Reload")}
        </Button>
        <Button size="lg" variant="outline" onClick={() => void exportCsv()}>
          {t.in("settings", "Export CSV")}
        </Button>
      </div>
      {exportFailed && <p className="type-body text-destructive">{t.in("settings", "We couldn't create the file. Try again.")}</p>}
    </div>
  )
}
