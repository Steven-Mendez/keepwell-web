// Runs after `serwist build`: reads the precache manifest injected into public/sw.js and fails when a
// URL appears twice with different revisions. Serwist throws `add-to-cache-list-conflicting-entries`
// for that while evaluating the worker, so the browser refuses to register it ("ServiceWorker script
// evaluation failed") and nothing in the build notices. That is how `/~offline` broke the worker
// from its first commit: precached once as a prerendered page and again as an extra entry.
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

/**
 * The manifest's entries as esbuild writes them, `{revision:"…",url:"…"}` or `{url:"…",revision:null}`.
 * @param {string} source the built service worker
 * @returns {{ url: string, revision: string | null }[]}
 */
export function precacheEntries(source) {
  const entries = []
  const pattern = /\{\s*(?:revision:\s*(null|"[^"]*")\s*,\s*url:\s*"([^"]*)"|url:\s*"([^"]*)"\s*,\s*revision:\s*(null|"[^"]*"))\s*\}/g
  for (const match of source.matchAll(pattern)) {
    const url = match[2] ?? match[3] ?? ""
    const revision = match[1] ?? match[4] ?? "null"
    entries.push({ url, revision: revision === "null" ? null : revision.slice(1, -1) })
  }
  return entries
}

/**
 * URLs that more than one entry claims with a different revision: Serwist's rule for a conflict.
 * @param {{ url: string, revision: string | null }[]} entries
 * @returns {string[]}
 */
export function conflictingUrls(entries) {
  const revisions = new Map()
  const conflicts = new Set()
  for (const { url, revision } of entries) {
    if (revisions.has(url) && revisions.get(url) !== revision) conflicts.add(url)
    revisions.set(url, revision)
  }
  return [...conflicts]
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = resolve(import.meta.dirname, "..", process.argv[2] ?? "public/sw.js")
  const entries = precacheEntries(readFileSync(file, "utf-8"))
  if (entries.length === 0) {
    console.error(`${file}: no precache manifest found; did serwist build inject it?`)
    process.exit(1)
  }
  const conflicts = conflictingUrls(entries)
  if (conflicts.length > 0) {
    console.error(`${file}: precached twice with different revisions (Serwist would refuse to start): ${conflicts.join(", ")}`)
    process.exit(1)
  }
  console.log(`${file}: ${entries.length} precache entries, no URL repeated.`)
}
