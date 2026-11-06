// Holds every screen to src/components/kw/DESIGN.md, so the iOS design language can't drift screen
// by screen: the three control heights, the type-* scale, and Keepwell components instead of stock
// shadcn controls on screen. The kw/ wrappers and shadcn's own ui/ are exempt: they define the look.
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

const root = join(__dirname, "../src/components")

function screens(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === "ui" || name === "kw" ? [] : screens(path)
    return name.endsWith(".tsx") ? [path] : []
  })
}

const RULES: { name: string; pattern: RegExp }[] = [
  { name: "only 32, 40 or 48 px controls (DESIGN.md rule 5)", pattern: /(?<![\w-])(?:h|size|min-h)-(?:5\.5|6\.5|7|7\.5|9|11|\[3\dpx\])(?![\w.-])/ },
  { name: "type-* scale instead of Tailwind text sizes (rule 4)", pattern: /(?<![\w-])text-(?:xs|sm|base|lg|xl|2xl|3xl)(?![\w-])/ },
  { name: "KWButton/KWCircleButton instead of shadcn Button (rule 1)", pattern: /from "@\/components\/ui\/button"/ },
  { name: "every screen keeps the Page width (rule 7)", pattern: /<Page[^>]*className="[^"]*max-w-/ },
  { name: "Keepwell pills instead of shadcn Badge (rule 1)", pattern: /from "@\/components\/ui\/badge"/ },
  { name: "KWSegmented/KWChip instead of shadcn ToggleGroup (rule 1)", pattern: /from "@\/components\/ui\/toggle-group"/ },
]

const files = screens(root)

describe("Design language", () => {
  it("checks every screen file", () => {
    expect(files.length).toBeGreaterThan(20)
  })

  for (const rule of RULES) {
    it(rule.name, () => {
      const offenders = files.flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .flatMap((line, index) => (rule.pattern.test(line) ? [`${relative(root, file)}:${index + 1}: ${line.trim().slice(0, 120)}`] : [])),
      )
      expect(offenders).toEqual([])
    })
  }
})
