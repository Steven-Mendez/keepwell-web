#!/usr/bin/env node
// Generates src/lib/i18n/strings.generated.json from the iOS string catalogs (Localizable.xcstrings),
// the single source of truth for user-visible text. The web shows the same English and Spanish as
// iOS, keyed by the same English source text; `pnpm strings:check` fails when the two drift.
//
// Usage: node scripts/sync-ios-strings.mjs [--ios ../keepwell-ios] [--check]
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const iosRoot = resolve(root, args.includes("--ios") ? args[args.indexOf("--ios") + 1] : "../keepwell-ios")
const check = args.includes("--check")
const outFile = join(root, "src/lib/i18n/strings.generated.json")

function catalogs(dir) {
  const found = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    console.error(`strings: can't read ${dir}. Clone keepwell-ios next to keepwell-web or pass --ios <path>.`)
    process.exit(1)
  }
  for (const name of entries) {
    if (name === "build" || name === ".build" || name.startsWith(".")) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) found.push(...catalogs(path))
    else if (name === "Localizable.xcstrings") found.push(path)
  }
  return found
}

/** "Packages/Features/Sources/Home/Presentation/…" → "home"; the app and widget catalogs keep their folder. */
function namespace(path) {
  const parts = relative(iosRoot, path).split("/")
  const sources = parts.indexOf("Sources")
  const name = sources >= 0 ? parts[sources + 1] : parts[0]
  return (name ?? basename(dirname(path))).toLowerCase()
}

function unit(localization) {
  if (!localization) return undefined
  if (localization.stringUnit) return localization.stringUnit.value
  const plural = localization.variations?.plural
  if (plural) return Object.fromEntries(Object.entries(plural).map(([form, value]) => [form, value.stringUnit.value]))
  return undefined
}

const result = {}
for (const path of catalogs(iosRoot).sort()) {
  const ns = namespace(path)
  const catalog = JSON.parse(readFileSync(path, "utf8"))
  const strings = (result[ns] ??= {})
  for (const [key, value] of Object.entries(catalog.strings).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const en = unit(value.localizations?.en)
    const es = unit(value.localizations?.es)
    strings[key] = { ...(en === undefined ? {} : { en }), ...(es === undefined ? {} : { es }) }
  }
}

const text = JSON.stringify(result, null, 1) + "\n"
if (check) {
  let current = ""
  try {
    current = readFileSync(outFile, "utf8")
  } catch {}
  if (current !== text) {
    console.error("strings: src/lib/i18n/strings.generated.json is out of date. Run `pnpm strings:sync`.")
    process.exit(1)
  }
  console.log("strings: up to date")
} else {
  writeFileSync(outFile, text)
  const count = Object.values(result).reduce((sum, strings) => sum + Object.keys(strings).length, 0)
  console.log(`strings: wrote ${count} strings in ${Object.keys(result).length} namespaces`)
}
