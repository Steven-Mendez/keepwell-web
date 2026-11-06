#!/usr/bin/env node
// Generates src/app/tokens.css from the iOS design system, the single source of truth for design
// tokens. It reads the Swift token files directly, so a color or size changed on iOS reaches the
// web by running `pnpm tokens:sync`; `pnpm tokens:check` fails when the two have drifted.
//
// Usage: node scripts/sync-ios-tokens.mjs [--ios ../keepwell-ios] [--check]
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const iosRoot = resolve(root, args.includes("--ios") ? args[args.indexOf("--ios") + 1] : "../keepwell-ios")
const check = args.includes("--check")
const outFile = join(root, "src/app/tokens.css")
const tokensDir = join(iosRoot, "Packages/DesignSystem/Sources/DesignSystem")

function read(path) {
  try {
    return readFileSync(join(tokensDir, path), "utf8")
  } catch {
    fail(`Can't read ${join(tokensDir, path)}. Clone keepwell-ios next to keepwell-web or pass --ios <path>.`)
  }
}

function fail(message) {
  console.error(`tokens: ${message}`)
  process.exit(1)
}

const kebab = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
const hex = (value) => `#${value.toUpperCase()}`

/** The body after `header`: `{…}` of a declaration, or `[…]` of an array or dictionary literal. */
function block(source, header, [open, close] = "{}") {
  const start = source.indexOf(header)
  if (start < 0) fail(`missing "${header}"`)
  const from = header.endsWith(open) ? start + header.length - 1 : source.indexOf(open, start + header.length)
  let depth = 0
  for (let i = from; i < source.length; i++) {
    if (source[i] === open) depth++
    if (source[i] === close && --depth === 0) return source.slice(from + 1, i)
  }
  fail(`unbalanced "${header}"`)
}

/** `static let name: UInt32 = 0xRRGGBB` lines of an enum body. */
function hexLets(body) {
  return [...body.matchAll(/static let (\w+): UInt32 = 0x([0-9A-Fa-f]{6})\b/g)].map(([, name, value]) => [name, hex(value)])
}

/** `case .a, .b: value` lines of a `switch self` inside the named property. */
function switchValues(source, property, parse) {
  const body = block(source, property)
  const result = new Map()
  for (const [, cases, value] of body.matchAll(/case ([.\w, ]+):\s*([^\n]+)/g)) {
    for (const name of cases.split(",").map((c) => c.trim().replace(/^\./, ""))) result.set(name, parse(value.trim()))
  }
  const fallback = body.match(/default:\s*([^\n]+)/)
  return { result, fallback: fallback ? parse(fallback[1].trim()) : undefined }
}

// Palette (KWColor.Hex)
const colorSource = read("Tokens/ColorTokens.swift")
const hexEnum = block(colorSource, "    enum Hex")
const palette = new Map()
for (const group of ["Surface", "Text", "Brand", "State"]) {
  for (const [name, value] of hexLets(block(hexEnum, `enum ${group}`))) palette.set(`${group}.${name}`, value)
}
if (palette.size < 20) fail("too few palette colors parsed; did ColorTokens.swift change shape?")

// Roles (KWColor.Hex.Semantic)
const semanticSource = read("Tokens/SemanticColorTokens.swift")
const semantic = []
for (const [, name, literal, ref] of block(block(semanticSource, "extension KWColor.Hex"), "enum Semantic").matchAll(
  /static let (\w+)(?:: UInt32 = 0x([0-9A-Fa-f]{6})| = (\w+\.\w+))/g,
)) {
  if (literal) semantic.push([name, { value: hex(literal) }])
  else if (palette.has(ref)) semantic.push([name, { ref }])
  else fail(`semantic "${name}" points at unknown token ${ref}`)
}

if (semantic.length === 0) fail("no roles parsed from SemanticColorTokens.swift")

// Categories, by stable id and by palette key
const categories = [...block(colorSource, "public static let category: [String: UInt32] = [", "[]").matchAll(/"([\w-]+)": 0x([0-9A-Fa-f]{6})/g)]
const categoryPalette = [...block(colorSource, "public static let categoryPalette: [(key: String, hex: UInt32)] = [", "[]").matchAll(/\("(\w+)", 0x([0-9A-Fa-f]{6})\)/g)]

// Card art: two token stops per palette
const cardArt = [...block(colorSource, "public var hexStops").matchAll(/case \.(\w+): \(0x([0-9A-Fa-f]{6}), 0x([0-9A-Fa-f]{6})\)/g)]

for (const [label, list, min] of [["category", categories, 5], ["category palette", categoryPalette, 5], ["card art", cardArt, 5]]) {
  if (list.length < min) fail(`too few ${label} colors parsed; did ColorTokens.swift change shape?`)
}

// Layout
const layoutSource = read("Tokens/LayoutTokens.swift")
const numbers = (header) => [...block(layoutSource, header).matchAll(/static let (\w+): CGFloat = ([\d.]+)/g)].map(([, n, v]) => [n, Number(v)])
const radius = numbers("public enum KWRadius {")
const layout = numbers("public enum KWLayout {")
// KWShadow(color: Color(hex:, opacity:), radius:, x:, y:). SwiftUI's radius is half a CSS blur.
const shadows = [
  ...block(layoutSource, "public struct KWShadow").matchAll(
    /static let (\w+) = Self\(color: Color\(hex: 0x([0-9A-Fa-f]{6}), opacity: ([\d.]+)\), radius: ([\d.]+), x: ([-\d.]+), y: ([-\d.]+)\)/g,
  ),
].map(([, name, color, opacity, radius, x, y]) => {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(color.slice(i, i + 2), 16))
  return [name, `${x}px ${y}px ${Number(radius) * 2}px rgb(${r} ${g} ${b} / ${Number(opacity)})`]
})
if (shadows.length < 2) fail("KWShadow presets not parsed; did LayoutTokens.swift change shape?")

// Typography
const typeSource = read("Typography/KWTypography.swift")
const styles = [...block(typeSource, "public enum KWTextStyle").matchAll(/^\s*case (\w+)$/gm)].map(([, n]) => n)
const sizes = switchValues(typeSource, "public var size: CGFloat {", Number)
const weights = switchValues(typeSource, "public var cssWeight: Int {", Number)
const tracking = switchValues(typeSource, "public var tracking: CGFloat {", Number)
const numeric = switchValues(typeSource, "public var isNumeric: Bool {", (v) => v === "true")
for (const style of styles) if (!sizes.result.has(style) || !weights.result.has(style)) fail(`text style ${style} has no size or weight`)

// Output. Names follow the contract globals.css maps into Tailwind; iOS roles keep their Swift
// names in kebab case, so `KWColor.Semantic.mutedForeground` is `--muted-foreground` here.
const primitiveVar = (ref) => `--kw-${kebab(ref.replace(".", "-"))}`
const roleVar = (name) => `--${kebab(name)}`
const roleNames = new Set(semantic.map(([name]) => name))
const lines = []
const decl = (name, value) => lines.push(`  ${name}: ${value};`)
const need = (role) => {
  if (!roleNames.has(role)) fail(`KWColor.Semantic.${role} is missing; the web maps it`)
  return `var(${roleVar(role)})`
}

lines.push("/* Generated by scripts/sync-ios-tokens.mjs from keepwell-ios/Packages/DesignSystem, the single")
lines.push("   source of truth for design tokens. Do not edit: change the Swift tokens and run")
lines.push("   `pnpm tokens:sync`. iOS is dark-only, so this one palette is the app theme. */")
lines.push("")
lines.push(":root {")
lines.push("  color-scheme: dark;")
lines.push("")
lines.push("  /* Palette (KWColor.Hex) */")
for (const [ref, value] of palette) decl(primitiveVar(ref), value)
lines.push("")
lines.push("  /* Roles (KWColor.Semantic): the shadcn/ui names plus Keepwell's own */")
for (const [name, token] of semantic) decl(roleVar(name), token.ref ? `var(${primitiveVar(token.ref)})` : token.value)
lines.push("")
lines.push("  /* Brand scale (KWColor.Brand) */")
for (const [ref] of palette) {
  const step = ref.match(/^Brand\.b(\d+)$/)
  if (step) decl(`--brand-${step[1]}`, `var(${primitiveVar(ref)})`)
}
lines.push("")
lines.push("  /* shadcn sidebar: the iOS tab bar's surface (nav) with the same roles as the rest */")
decl("--sidebar", need("nav"))
decl("--sidebar-foreground", need("foreground"))
decl("--sidebar-primary", need("primary"))
decl("--sidebar-primary-foreground", need("primaryForeground"))
decl("--sidebar-accent", need("accent"))
decl("--sidebar-accent-foreground", need("accentForeground"))
decl("--sidebar-border", need("divider"))
decl("--sidebar-ring", need("ring"))
lines.push("")
lines.push("  /* Category palette people pick from (KWColor.categoryPalette), and defaults by id */")
for (const [, key, value] of categoryPalette) decl(`--category-${key}`, hex(value))
for (const [, id, value] of categories) decl(`--category-id-${id}`, hex(value))
lines.push("  /* Charts: the most distinct palette hues, in order */")
const chartKeys = ["blue", "green", "amber", "purple", "cyan"]
chartKeys.forEach((key, i) => {
  if (!categoryPalette.some(([, k]) => k === key)) fail(`category palette lost "${key}", used by --chart-${i + 1}`)
  decl(`--chart-${i + 1}`, `var(--category-${key})`)
})
lines.push("")
lines.push("  /* Card art (KWColor.CardArt.hexStops): the 135° gradient's two stops */")
for (const [, name, start, end] of cardArt) {
  decl(`--card-art-${name}-from`, hex(start))
  decl(`--card-art-${name}-to`, hex(end))
}
lines.push("")
lines.push("  /* Radii (KWRadius); --radius is the input radius shadcn scales from */")
for (const [name, value] of radius) decl(`--radius-${kebab(name)}`, `${value}px`)
decl("--radius", "var(--radius-input)")
lines.push("")
lines.push("  /* Shadows (KWShadow) */")
for (const [name, value] of shadows) decl(`--shadow-${kebab(name)}`, value)
lines.push("")
lines.push("  /* Layout (KWLayout) */")
for (const [name, value] of layout) decl(name === "gutter" ? "--gutter" : `--layout-${kebab(name)}`, `${value}px`)
lines.push("")
lines.push("  /* Type scale (KWTextStyle): size (pt / 16 as rem), CSS weight and tracking per style */")
for (const style of styles) {
  const name = `--type-${kebab(style)}`
  // rem, so text follows the browser's font size the way iOS styles follow Dynamic Type.
  decl(`${name}-size`, `${sizes.result.get(style) / 16}rem`)
  decl(`${name}-weight`, String(weights.result.get(style)))
  const track = tracking.result.get(style) ?? tracking.fallback ?? 0
  if (track !== 0) decl(`${name}-tracking`, `${track}px`)
}
lines.push("}")
lines.push("")
lines.push("/* Amount styles always use tabular figures, so columns of numbers line up (KWTextStyle.isNumeric). */")
const numericStyles = styles.filter((s) => numeric.result.get(s) ?? numeric.fallback)
lines.push(`${numericStyles.map((s) => `.text-${kebab(s)}`).join(",\n")} {\n  font-variant-numeric: tabular-nums;\n}`)
const css = `${lines.join("\n")}\n`

if (check) {
  let current = ""
  try {
    current = readFileSync(outFile, "utf8")
  } catch {}
  if (current !== css) fail("src/app/tokens.css is out of date with keepwell-ios. Run `pnpm tokens:sync`.")
  console.log("tokens: in sync with keepwell-ios")
} else {
  writeFileSync(outFile, css)
  console.log(`tokens: wrote ${palette.size} palette colors, ${semantic.length} roles, ${styles.length} text styles`)
}
