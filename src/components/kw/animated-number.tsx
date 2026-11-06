"use client"

import NumberFlow from "@number-flow/react"

import { cn } from "@/lib/utils"
import { DURATION } from "@/lib/motion"

/**
 * The app's standard spring (src/lib/motion.ts) sampled into linear(), the same curve as the CSS
 * `--ease-spring`. Inlined because NumberFlow animates through the Web Animations API, which can't
 * read custom properties.
 */
const SPRING_EASING =
  "linear(0, 0.046 5%, 0.152 10%, 0.283 15%, 0.418 20%, 0.544 25%, 0.654 30%, 0.746 35%, 0.82 40%, 0.877 45%, 0.92 50%, 0.951 55%, 0.973 60%, 0.988 65%, 0.997 70%, 1.003 75%, 1.006 80%, 1.007 85%, 1.007 90%, 1.007 95%, 1)"
const TRANSFORM_TIMING = {
  duration: DURATION.slow * 1000,
  easing: SPRING_EASING,
}
const OPACITY_TIMING = { duration: DURATION.fast * 1000, easing: "ease-out" }

type Parsed = {
  prefix: string
  value: number
  fractionDigits: number
  grouped: boolean
  suffix: string
}

/**
 * Reads back a string formatAmount/formatNumber wrote ("−C$1,234.50", "+$12", "36.6243", "42%"):
 * the text around one number, the number and how it was written. Anything else (the "••••" mask,
 * text with two numbers) is undefined and shown as plain text.
 */
export function parseFormatted(text: string): Parsed | undefined {
  const match = /^(\D*?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(\D*)$/.exec(text)
  if (!match) return undefined
  const [, prefix = "", whole = "", fraction = "", suffix = ""] = match
  const digits = whole.replaceAll(",", "")
  const value = Number(fraction ? `${digits}.${fraction}` : digits)
  if (!Number.isFinite(value)) return undefined
  return {
    prefix,
    value,
    fractionDigits: fraction.length,
    grouped: whole.includes(",") || digits.length <= 3,
    suffix,
  }
}

/**
 * SwiftUI's `.contentTransition(.numericText())` for the web, on NumberFlow: changed digits spin to
 * their new value with the app's spring, up when the number grows and down when it shrinks, while
 * unchanged ones stay put. Takes the already formatted text so money is written exactly as
 * formatAmount writes it (sign, symbol, grouping, decimals). The first render doesn't animate, and
 * NumberFlow skips motion under `prefers-reduced-motion`. The fraction is exposed as
 * `::part(fraction)` for styles that set cents smaller.
 */
export function AnimatedNumber({
  value,
  className,
}: {
  value: string
  className?: string | undefined
}) {
  const parsed = parseFormatted(value)
  if (!parsed) {
    // Keyed so swapping to or from the mask cross-fades (`.contentTransition(.opacity)`).
    return (
      <span
        key={value}
        className={cn(
          "inline-block animate-fade-in whitespace-pre tabular-nums",
          className
        )}
      >
        {value}
      </span>
    )
  }
  return (
    <NumberFlow
      value={parsed.value}
      locales="en-US"
      format={{
        minimumFractionDigits: parsed.fractionDigits,
        maximumFractionDigits: parsed.fractionDigits,
        useGrouping: parsed.grouped,
      }}
      prefix={parsed.prefix}
      suffix={parsed.suffix}
      transformTiming={TRANSFORM_TIMING}
      opacityTiming={OPACITY_TIMING}
      aria-label={value}
      className={cn("tabular-nums", className)}
    />
  )
}
