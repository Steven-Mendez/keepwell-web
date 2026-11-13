"use client" // Error boundaries must be Client Components

import { useEffect, useState, useSyncExternalStore } from "react"

import { makeTranslator, type Locale } from "@/lib/i18n/translate"
import { downloadCsvExport } from "@/lib/platform/csv-download"

/**
 * Replaces the root layout when the layout itself fails, so nothing from it is here: no I18nProvider,
 * no globals.css, no fonts. It picks the language the way the provider does and carries its own styles
 * (the tokens.css colors, light and dark with the system appearance).
 */

const noSubscribe = () => () => {}

function browserLocale(): Locale {
  try {
    const stored = localStorage.getItem("keepwell.locale")
    if (stored === "en" || stored === "es") return stored
  } catch {}
  return navigator.language.toLowerCase().startsWith("es") ? "es" : "en"
}

const STYLES = `
  :root { color-scheme: light dark; --bg: #F2F3F7; --fg: #0D1226; --muted: #5B6074; --border: #D9DCE4; --primary: #2448E0; --on-primary: #FFFFFF; --negative: #C22B28; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #000000; --fg: #FFFFFF; --muted: #9A9AA6; --border: #2A2A31; --primary: #FFFFFF; --on-primary: #000000; --negative: #FF8A7F; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font-family: system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
  main { min-height: 100svh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px 16px; text-align: center; }
  h1 { margin: 0; font-size: 22px; font-weight: 600; }
  p { margin: 0; max-width: 28rem; font-size: 15px; line-height: 1.45; color: var(--muted); }
  .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  button { height: 36px; padding: 0 12px; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid var(--border); background: transparent; color: var(--fg); }
  button.primary { border-color: transparent; background: var(--primary); color: var(--on-primary); }
  button:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
  .failed { color: var(--negative); }
`

export default function GlobalError({ error }: { error: unknown; retry: () => void }) {
  // The server (and the first render) say English; the browser's language arrives on hydration.
  const locale = useSyncExternalStore<Locale>(noSubscribe, browserLocale, () => "en")
  const t = makeTranslator(locale)
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
    <html lang={locale}>
      <head>
        <title>Keepwell</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{STYLES}</style>
      </head>
      <body>
        <main role="alert">
          <h1>{t.in("web", "Something went wrong")}</h1>
          <p>{t.in("web", "Keepwell couldn't show this page. Your data is still on this device: reload to try again, or export a CSV to keep a copy.")}</p>
          <div className="actions">
            <button type="button" className="primary" onClick={() => window.location.reload()}>
              {t.in("web", "Reload")}
            </button>
            <button type="button" onClick={() => void exportCsv()}>
              {t.in("settings", "Export CSV")}
            </button>
          </div>
          {exportFailed && <p className="failed">{t.in("settings", "We couldn't create the file. Try again.")}</p>}
        </main>
      </body>
    </html>
  )
}
