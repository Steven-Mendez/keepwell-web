// Every literal key the screens translate must exist: in the iOS catalogs (the same English and
// Spanish as the iPhone app) or, for desktop-only text, in the web catalog with its Spanish.
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { hasString, translate } from "@/lib/i18n"
import { WEB_STRINGS } from "@/lib/i18n/web-strings"
import { categorySymbol } from "@/lib/presentation/display"
import { SYMBOL_ICONS } from "@/lib/presentation/icons"
import { DEFAULT_CATEGORIES } from "@/lib/schema"

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === "ui" ? [] : sources(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

const calls = sources(join(__dirname, "../src")).flatMap((file) => {
  const text = readFileSync(file, "utf8")
  return [...text.matchAll(/\bt\.in\(\s*"(\w+)",\s*"((?:[^"\\]|\\.)*)"/g)].map(([, ns, key]) => ({ file, ns: ns as string, key: JSON.parse(`"${key}"`) as string }))
})

describe("Strings", () => {
  it("finds the screens' translations", () => {
    expect(calls.length).toBeGreaterThan(300)
  })

  it.each(calls.map((call) => [`${call.ns} › ${call.key}`, call] as const))("%s exists", (_, call) => {
    expect(hasString(call.key, call.ns), `${call.file}`).toBe(true)
  })

  it("every web-only string has Spanish", () => {
    for (const [key, entry] of Object.entries(WEB_STRINGS)) expect(entry.es, key).toBeTruthy()
  })

  it("fills arguments, numbered placeholders and plurals like iOS", () => {
    expect(translate("es", "Spent in %@", ["noviembre"], "home")).toBe("Gastado en noviembre")
    expect(translate("en", "%lld accounts", [1], "home")).toBe("1 account")
    expect(translate("es", "%lld accounts", [3], "home")).toBe("3 cuentas")
    expect(translate("es", "%@%% saved", ["71"], "home")).toBe("71% ahorrado")
  })

  it("translates every default category by id and draws its icon", () => {
    for (const category of DEFAULT_CATEGORIES) {
      expect(hasString(category.name, "sharedpresentation"), category.id).toBe(true)
      expect(SYMBOL_ICONS[categorySymbol(category)], category.id).toBeDefined()
    }
    expect(translate("es", "Loan payments", [], "sharedpresentation")).toBe("Pagos de préstamos")
  })
})
