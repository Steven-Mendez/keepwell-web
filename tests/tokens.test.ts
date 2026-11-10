// The generated src/app/tokens.css (scripts/sync-ios-tokens.mjs): light by default, dark under
// prefers-color-scheme and inside `.dark`. Dark keeps the app's original values, both themes declare
// the same colors, light text passes WCAG AA, and the file matches keepwell-ios when it's checked out.
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = join(__dirname, "..")
const css = readFileSync(join(root, "src/app/tokens.css"), "utf8")

/** The declarations of the first block that starts with `opener`, as a name → value map. */
function declarations(opener: string): Map<string, string> {
  const start = css.indexOf(opener)
  if (start < 0) throw new Error(`no "${opener}" block`)
  let depth = 0
  let from = -1
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{" && depth++ === 0) from = i + 1
    if (css[i] === "}" && --depth === 0) {
      const body = css.slice(from, i).replace(/:root\s*\{/, "")
      return new Map(
        [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [
          match[1] as string,
          (match[2] as string).trim(),
        ])
      )
    }
  }
  throw new Error(`unbalanced "${opener}" block`)
}

const light = declarations(":root {")
const media = declarations("@media (prefers-color-scheme: dark)")
const dark = declarations(".dark {")

/** A role's hex value in one theme, following `var(--…)` references within that theme. */
function resolve(theme: Map<string, string>, name: string): string {
  const value = theme.get(name) ?? light.get(name)
  if (value === undefined) throw new Error(`${name} is not declared`)
  const ref = value.match(/^var\((--[\w-]+)\)$/)
  return ref ? resolve(theme, ref[1] as string) : value
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort(
    (x, y) => y - x
  ) as [number, number]
  return (lighter + 0.05) / (darker + 0.05)
}

describe("tokens.css", () => {
  it("defaults to light and switches to dark with the system and inside .dark", () => {
    expect(light.size).toBeGreaterThan(60)
    expect(css).toMatch(/:root \{\n {2}color-scheme: light;/)
    expect(css).toMatch(
      /@media \(prefers-color-scheme: dark\) \{\n {2}:root \{\n {4}color-scheme: dark;/
    )
    expect(css).toMatch(/\.dark \{\n {2}color-scheme: dark;/)
  })

  it("declares the same colors in every theme, and the two dark blocks agree", () => {
    expect([...media.keys()]).toEqual([...dark.keys()])
    expect([...media.entries()]).toEqual([...dark.entries()])
    for (const name of dark.keys()) expect(light.has(name), name).toBe(true)
  })

  it("keeps the original dark values", () => {
    const original: Record<string, string> = {
      "--background": "#000000",
      "--foreground": "#FFFFFF",
      "--card": "#16161A",
      "--primary": "#FFFFFF",
      "--primary-foreground": "#000000",
      "--secondary": "#26262D",
      "--muted-foreground": "#9A9AA6",
      "--border": "#2A2A31",
      "--ring": "#5B7CFF",
      "--positive": "#3FD69A",
      "--pending": "#FFB547",
      "--negative": "#FF8A7F",
      "--extra": "#C8F560",
      "--link": "#8FA8FF",
      "--nav": "#0B0B0D",
      "--logo": "#FFFFFF",
    }
    for (const [name, value] of Object.entries(original))
      expect(resolve(dark, name), name).toBe(value)
  })

  it("keeps the brand scale the same in both themes", () => {
    for (const step of ["500", "600", "700", "900"]) {
      expect(resolve(light, `--brand-${step}`)).toBe(
        resolve(dark, `--brand-${step}`)
      )
    }
  })

  it("passes WCAG AA for light text on light surfaces", () => {
    const text = [
      "--foreground",
      "--text-secondary",
      "--muted-foreground",
      "--text-faint",
      "--link",
      "--positive",
      "--pending",
      "--negative",
      "--extra",
      "--logo",
    ]
    for (const surface of ["--background", "--card", "--secondary"]) {
      for (const name of text) {
        expect(
          contrast(resolve(light, name), resolve(light, surface)),
          `${name} on ${surface}`
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
    expect(
      contrast(
        resolve(light, "--primary-foreground"),
        resolve(light, "--primary")
      )
    ).toBeGreaterThanOrEqual(4.5)
  })

  // Needs keepwell-ios next to this repo, as `pnpm tokens:check` does; CI without it skips.
  it.runIf(existsSync(join(root, "../keepwell-ios/Packages/DesignSystem")))(
    "is in sync with keepwell-ios",
    () => {
      const output = execFileSync(
        "node",
        ["scripts/sync-ios-tokens.mjs", "--check"],
        { cwd: root, encoding: "utf8" }
      )
      expect(output).toContain("in sync")
    }
  )
})
