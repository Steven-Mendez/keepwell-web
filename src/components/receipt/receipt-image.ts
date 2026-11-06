import { KW_ICONS } from "@/components/kw/kw-icon-data"

import type { Receipt } from "./receipt-model"

// iOS ReceiptImage.swift: the ticket on the brand gradient under the wordmark, without the
// screen's buttons, drawn straight onto a canvas at 3× (no DOM snapshot, no dependency), so the
// PNG is identical in every browser and stays sharp when zoomed. Geometry follows ReceiptTicket.swift.

const WIDTH = 390
const SCALE = 3
const GUTTER = 20
const TICKET_PADDING = 16
const SCALLOP = 7
const CORNER = 20

/** The palette, read from the generated tokens so a token change reaches the image too. */
function palette() {
  const style = getComputedStyle(document.documentElement)
  const token = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback
  return {
    b500: token("--kw-brand-b500", "#4A74FF"),
    b700: token("--kw-brand-b700", "#1A33A8"),
    surface: token("--kw-surface-surface", "#16161A"),
    divider: token("--kw-surface-divider", "#24242A"),
    primary: token("--kw-text-primary", "#FFFFFF"),
    secondary: token("--kw-text-secondary", "#C9C9D2"),
    muted: token("--kw-text-muted", "#9A9AA6"),
    positive: token("--kw-state-positive", "#3FD69A"),
    pending: token("--kw-state-pending", "#FFB547"),
    onPositive: token("--kw-text-on-positive", "#00261A"),
  }
}

type Ctx = CanvasRenderingContext2D

interface TextStyle {
  size: number
  weight: number
  tracking?: number
}

function setFont(ctx: Ctx, family: string, style: TextStyle) {
  ctx.font = `${style.weight} ${style.size}px ${family}`
  // Older engines lack letterSpacing; the text then keeps its natural spacing.
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${style.tracking ?? 0}px`
}

/** Word wrap; a word longer than the line breaks between characters. */
function wrap(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split("\n")) {
    let line = ""
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate
        continue
      }
      if (line) lines.push(line)
      line = ""
      let rest = word
      while (ctx.measureText(rest).width > maxWidth && rest.length > 1) {
        let cut = rest.length - 1
        while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxWidth)
          cut--
        lines.push(rest.slice(0, cut))
        rest = rest.slice(cut)
      }
      line = rest
    }
    lines.push(line)
  }
  return lines
}

function ticketPath(
  ctx: Ctx,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const bottom = y + height
  ctx.beginPath()
  ctx.moveTo(x, y + CORNER)
  ctx.arc(x + CORNER, y + CORNER, CORNER, Math.PI, Math.PI * 1.5)
  ctx.lineTo(x + width - CORNER, y)
  ctx.arc(x + width - CORNER, y + CORNER, CORNER, Math.PI * 1.5, 0)
  ctx.lineTo(x + width, bottom)
  // Whole bites only, spread evenly, so both ends meet the sides cleanly (KWTicketShape).
  const count = Math.max(Math.round(width / (SCALLOP * 3)), 1)
  const step = width / count
  for (let index = count - 1; index >= 0; index--) {
    const center = x + step * (index + 0.5)
    ctx.lineTo(center + SCALLOP, bottom)
    ctx.arc(center, bottom, SCALLOP, 0, Math.PI, true)
    ctx.lineTo(center - step / 2, bottom)
  }
  ctx.closePath()
}

function drawIcon(
  ctx: Ctx,
  name: "check",
  x: number,
  y: number,
  size: number,
  lineWidth: number,
  color: string
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 24, size / 24)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth / (size / 24)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  for (const element of KW_ICONS[name]) {
    if (element[0] === "path") ctx.stroke(new Path2D(element[1]))
  }
  ctx.restore()
}

function drawLogoMark(
  ctx: Ctx,
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 72, size / 72)
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.beginPath()
  ctx.arc(36, 21, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 7.5
  ctx.lineCap = "round"
  ctx.stroke(new Path2D("M15 34v7a21 21 0 0 0 42 0v-7"))
  ctx.restore()
}

/** Every weight the image uses, loaded before measuring, or the first draw falls back to another font. */
async function loadFonts(family: string) {
  if (!document.fonts) return
  await Promise.all(
    [400, 500, 600, 700, 800].map((weight) =>
      document.fonts.load(`${weight} 16px ${family}`).catch(() => [])
    )
  )
}

/** A row: label on the left, value on the right, each wrapping in its own column. */
interface RowLayout {
  labelLines: string[]
  valueLines: string[]
  height: number
}

/**
 * Draws the receipt and returns it as a PNG. Two passes over one function: the first measures the
 * height (the canvas can't grow once drawn), the second draws at that size.
 */
export async function receiptPng(receipt: Receipt): Promise<Blob> {
  const family = getComputedStyle(document.body).fontFamily || "sans-serif"
  await loadFonts(family)
  const colors = palette()
  const measure = document.createElement("canvas").getContext("2d")
  if (!measure) throw new Error("Canvas is unavailable")
  const height = layout(measure, receipt, family, colors, false)
  const canvas = document.createElement("canvas")
  canvas.width = WIDTH * SCALE
  canvas.height = Math.ceil(height * SCALE)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas is unavailable")
  ctx.scale(SCALE, SCALE)
  layout(ctx, receipt, family, colors, true)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("The image could not be encoded")),
      "image/png"
    )
  )
}

function layout(
  ctx: Ctx,
  receipt: Receipt,
  family: string,
  colors: ReturnType<typeof palette>,
  draw: boolean
): number {
  const ticketX = GUTTER
  const ticketWidth = WIDTH - GUTTER * 2
  const contentX = ticketX + TICKET_PADDING
  const contentWidth = ticketWidth - TICKET_PADDING * 2
  const center = WIDTH / 2
  ctx.textBaseline = "alphabetic"

  // Pass one only measures; text and shapes are drawn on the second pass.
  const centered = (
    lines: string[],
    style: TextStyle,
    color: string,
    top: number,
    lineHeight: number
  ) => {
    if (!draw) return
    setFont(ctx, family, style)
    ctx.fillStyle = color
    ctx.textAlign = "center"
    lines.forEach((line, index) =>
      ctx.fillText(line, center, top + lineHeight * index + lineHeight * 0.75)
    )
  }

  // Ticket rows measured first: the ticket's height must be known before it is filled.
  const label: TextStyle = { size: 15, weight: 400 }
  const value: TextStyle = { size: 15, weight: 600 }
  const rowLineHeight = 20
  const labelWidth = Math.round(contentWidth * 0.5)
  const valueWidth = contentWidth - labelWidth - 12
  const rows: RowLayout[] = receipt.rows.map((row) => {
    setFont(ctx, family, label)
    const labelLines = wrap(ctx, row.label, labelWidth)
    setFont(ctx, family, value)
    const valueLines = wrap(ctx, row.value, valueWidth)
    return {
      labelLines,
      valueLines,
      height:
        Math.max(labelLines.length, valueLines.length) * rowLineHeight + 26,
    }
  })

  const dateStyle: TextStyle = { size: 12, weight: 500 }
  setFont(ctx, family, dateStyle)
  const dateLines = wrap(ctx, receipt.date, contentWidth)
  const descriptionStyle: TextStyle = { size: 17, weight: 600 }
  setFont(ctx, family, descriptionStyle)
  const descriptionLines = wrap(ctx, receipt.description, contentWidth)
  // minimumScaleFactor(0.6): a long amount shrinks to fit on one line.
  let amountStyle: TextStyle = { size: 40, weight: 800, tracking: -1 }
  setFont(ctx, family, amountStyle)
  const amountWidth = ctx.measureText(receipt.amount).width
  if (amountWidth > contentWidth)
    amountStyle = {
      ...amountStyle,
      size: Math.max(24, (40 * contentWidth) / amountWidth),
    }

  const wordmarkTop = 36
  const ticketTop = wordmarkTop + 30 + 52
  let y = ticketTop + 40
  const dateTop = y
  y += dateLines.length * 16 + 12
  const headlineTop = y
  y += 18 + 2
  const amountTop = y
  y += 48 + 2
  const descriptionTop = y
  y += descriptionLines.length * 22 + 2
  const pillTop = y + 4
  y = pillTop + 23 + 12 + 4
  const dividerY = y
  y += 1 + 4 + 12
  const rowsTop = y
  y += rows.reduce((total, row) => total + row.height, 0)
  y += 12 + 12 + 8
  const ticketBottom = y
  const totalHeight = ticketBottom + 40
  if (!draw) return totalHeight

  // Background and wordmark.
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, totalHeight)
  gradient.addColorStop(0, colors.b500)
  gradient.addColorStop(1, colors.b700)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, WIDTH, totalHeight)
  const wordStyle: TextStyle = { size: 24, weight: 800, tracking: -2 }
  setFont(ctx, family, wordStyle)
  const wordWidth = ctx.measureText("keepwell").width
  const markSize = 26
  const left = center - (markSize + 10 + wordWidth) / 2
  drawLogoMark(ctx, left, wordmarkTop + 2, markSize, "#FFFFFF")
  ctx.fillStyle = "#FFFFFF"
  ctx.textAlign = "left"
  ctx.fillText("keepwell", left + markSize + 10, wordmarkTop + 23)

  // The ticket.
  ticketPath(ctx, ticketX, ticketTop, ticketWidth, ticketBottom - ticketTop)
  ctx.fillStyle = colors.surface
  ctx.fill()

  centered(dateLines, dateStyle, colors.muted, dateTop, 16)
  centered(
    [receipt.headline],
    { size: 14, weight: 600 },
    colors.secondary,
    headlineTop,
    18
  )
  centered([receipt.amount], amountStyle, colors.primary, amountTop, 48)
  centered(
    descriptionLines,
    descriptionStyle,
    colors.primary,
    descriptionTop,
    22
  )

  // Status capsule: the state color on a 14% tint of itself.
  const pillStyle: TextStyle = { size: 12, weight: 700 }
  setFont(ctx, family, pillStyle)
  const pillColor = receipt.confirmed ? colors.positive : colors.pending
  const pillWidth = ctx.measureText(receipt.status).width + 20
  ctx.save()
  ctx.globalAlpha = 0.14
  ctx.fillStyle = pillColor
  ctx.beginPath()
  ctx.roundRect(center - pillWidth / 2, pillTop, pillWidth, 23, 11.5)
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = pillColor
  ctx.textAlign = "center"
  ctx.fillText(receipt.status, center, pillTop + 16)

  ctx.fillStyle = colors.divider
  ctx.fillRect(contentX, dividerY, contentWidth, 1)

  let rowTop = rowsTop
  for (const row of rows) {
    const textTop = rowTop + 13
    setFont(ctx, family, label)
    ctx.fillStyle = colors.secondary
    ctx.textAlign = "left"
    row.labelLines.forEach((line, lineIndex) =>
      ctx.fillText(line, contentX, textTop + rowLineHeight * lineIndex + 15)
    )
    setFont(ctx, family, value)
    ctx.fillStyle = colors.primary
    ctx.textAlign = "right"
    row.valueLines.forEach((line, lineIndex) =>
      ctx.fillText(
        line,
        contentX + contentWidth,
        textTop + rowLineHeight * lineIndex + 15
      )
    )
    rowTop += row.height
  }

  // The check badge, punched through the ticket's top edge with a ring of the backdrop.
  ctx.beginPath()
  ctx.arc(center, ticketTop, 30, 0, Math.PI * 2)
  ctx.fillStyle = colors.positive
  ctx.fill()
  ctx.beginPath()
  ctx.arc(center, ticketTop, 27.5, 0, Math.PI * 2)
  ctx.lineWidth = 5
  ctx.strokeStyle = colors.b500
  ctx.stroke()
  drawIcon(
    ctx,
    "check",
    center - 14,
    ticketTop - 14,
    28,
    2.8,
    colors.onPositive
  )

  return totalHeight
}
