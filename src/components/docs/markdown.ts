/**
 * The rendered docs article as Markdown, for "Copy page" and "View Markdown". Read from the DOM, so it
 * is always what the page shows (in its language), including every platform tab, not only the open one.
 * Covers what the docs use: headings, paragraphs, lists, steps, tables, callouts, code and links.
 */
export function articleToMarkdown(
  article: HTMLElement,
  origin: string
): string {
  return blocks(article, origin)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .concat("\n")
}

function blocks(node: Element, origin: string): string[] {
  const out: string[] = []
  for (const child of Array.from(node.children)) {
    if (
      child.getAttribute("aria-hidden") === "true" ||
      child.hasAttribute("data-md-skip")
    )
      continue
    out.push(...block(child as HTMLElement, origin))
  }
  return out.filter((text) => text.trim() !== "")
}

function block(el: HTMLElement, origin: string): string[] {
  const tag = el.tagName
  if (tag === "H1") return [`# ${inline(el, origin)}`]
  if (tag === "H2") return [`## ${inline(el, origin).replace(/\s*#$/, "")}`]
  if (tag === "H3") return [`### ${inline(el, origin)}`]
  if (tag === "P")
    return [
      el.hasAttribute("data-md-prompt")
        ? `> ${inline(el, origin)}`
        : inline(el, origin),
    ]
  if (tag === "PRE")
    return ["```\n" + (el.textContent ?? "").replace(/\n$/, "") + "\n```"]
  if (tag === "UL" || tag === "OL") return [list(el, origin)]
  if (tag === "TABLE") return [table(el, origin)]
  if (el.getAttribute("role") === "note") {
    return [
      blocks(el, origin)
        .join("\n\n")
        .split("\n")
        .map((line) => `> ${line}`.trimEnd())
        .join("\n"),
    ]
  }
  // A platform tab: its label as a heading, then its content.
  const label = el.getAttribute("data-tab-label")
  if (label) return [`### ${label}`, ...blocks(el, origin)]
  if (
    el.getAttribute("role") === "tablist" ||
    el.getAttribute("data-slot") === "code-block-actions" ||
    tag === "BUTTON"
  )
    return []
  if (tag === "NAV") return []
  // A container with its own text (a callout's body, a step's detail) reads as one paragraph.
  if (
    Array.from(el.childNodes).some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
    )
  )
    return [inline(el, origin)]
  return blocks(el, origin)
}

function list(el: HTMLElement, origin: string): string {
  const ordered = el.tagName === "OL"
  return Array.from(el.children)
    .filter((item) => item.tagName === "LI")
    .map((item, index) => {
      const marker = ordered ? `${index + 1}.` : "-"
      // Steps hold a title and a body; anything block-like inside an item is indented under it.
      const parts = blocks(item, origin)
      const text =
        parts.length > 0 ? parts : [inline(item as HTMLElement, origin)]
      // Steps draw their own number; drop it so it isn't doubled.
      const cleaned =
        ordered && /^\d+$/.test(text[0] ?? "") ? text.slice(1) : text
      const [first = "", ...rest] = cleaned
      return [
        `${marker} ${first}`,
        ...rest.map((line) => line.replace(/^/gm, "   ")),
      ].join("\n")
    })
    .join("\n")
}

function table(el: HTMLElement, origin: string): string {
  const rows = Array.from(el.querySelectorAll("tr")).map((row) =>
    Array.from(row.children).map((cell) =>
      inline(cell as HTMLElement, origin).replace(/\|/g, "\\|")
    )
  )
  if (rows.length === 0) return ""
  const [head, ...body] = rows
  return [
    `| ${head!.join(" | ")} |`,
    `| ${head!.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n")
}

function inline(el: Element, origin: string): string {
  let text = ""
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent
      continue
    }
    if (
      !(node instanceof HTMLElement) ||
      node.getAttribute("aria-hidden") === "true"
    )
      continue
    const inner = inline(node, origin)
    if (node.tagName === "STRONG" || node.tagName === "B")
      text += `**${inner}**`
    else if (node.tagName === "CODE") text += `\`${node.textContent}\``
    else if (node.tagName === "A") {
      const href = node.getAttribute("href") ?? ""
      text += href.startsWith("#")
        ? inner
        : `[${inner}](${href.startsWith("/") ? origin + href : href})`
    } else if (node.tagName === "BR") text += "\n"
    else text += inner
  }
  return text.replace(/[ \t]+/g, " ").trim()
}
