import { exportCsvFrom } from "@/lib/domain/csv"
import { ledgerStore } from "@/lib/repositories"

export function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export const today = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

/**
 * Downloads a CSV of every movement in this browser. Settings and the error screens share it, so a
 * copy can be kept even when a page fails to render. Throws when the file can't be made.
 */
export async function downloadCsvExport(): Promise<void> {
  download(await exportCsvFrom(ledgerStore), `keepwell-${today()}.csv`, "text/csv;charset=utf-8")
}
