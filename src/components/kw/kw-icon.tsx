import type { CardColor } from "@/lib/schema"
import { cn } from "@/lib/utils"

import { KW_LOCKUP, KW_SYMBOL } from "./kw-brand"
import { KW_ICONS, KW_ROUND_JOINS, type KWIconName } from "./kw-icon-data"

/**
 * KWIconView: one of the design's stroke icons at any size. The stroke is 2 units of the 24-unit
 * design space, so it stays proportional at 18, 20 or 24 px, as on iOS.
 */
export function KWIcon({ name, size = 20, strokeWidth = 2, className }: { name: KWIconName; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin={KW_ROUND_JOINS.has(name) ? "round" : "miter"}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      {KW_ICONS[name].map((element, index) => {
        switch (element[0]) {
          case "path":
            return <path key={index} d={element[1]} />
          case "circle":
            return <circle key={index} cx={element[1]} cy={element[2]} r={element[3]} />
          case "rect":
            return <rect key={index} x={element[1]} y={element[2]} width={element[3]} height={element[4]} rx={element[5]} />
        }
      })}
    </svg>
  )
}

/** KWLogoMark: the Keepwell symbol in one color (`currentColor`), from the designer's artwork. */
export function KWLogoMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox={KW_SYMBOL.viewBox} className={className} aria-hidden>
      <path d={KW_SYMBOL.d} fill="currentColor" />
    </svg>
  )
}

/** KWLockup: symbol and "KEEPWELL" in one color (`currentColor`); `height` sets its size. */
export function KWLockup({ height = 32, className }: { height?: number; className?: string }) {
  const [, , width, viewHeight] = KW_LOCKUP.box
  return (
    <svg width={(height * width) / viewHeight} height={height} viewBox={KW_LOCKUP.viewBox} className={className} role="img" aria-label="Keepwell">
      <path d={KW_LOCKUP.d} fill="currentColor" />
    </svg>
  )
}

/** KWAppIconTile: the app icon in miniature, the white symbol on the icon's blue gradient. */
export function KWAppIconTile({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden text-white", className)}
      style={{ width: size, height: size, borderRadius: size * (17 / 72), backgroundImage: "linear-gradient(180deg, var(--brand-500), var(--brand-700))" }}
    >
      <span className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/30 to-transparent to-50%" aria-hidden />
      {/* Placed as on the icon: 52% of the tile wide, slightly above center. */}
      <span className="relative inline-flex" style={{ transform: `translateY(${-size * (2.5 / 72)}px)` }}>
        <KWLogoMark size={size * (40 / 72)} />
      </span>
    </span>
  )
}

/** KWMiniCard: the small card thumbnail rows use; `solid` for cash, `transfer` for a bank transfer. */
export function KWMiniCard({ color, kind = "palette", chip = true, size = "small", className }: { color?: CardColor | undefined; kind?: "palette" | "cash" | "transfer"; chip?: boolean; size?: "tiny" | "small"; className?: string }) {
  const [width, height] = size === "tiny" ? [32, 21] : [46, 29]
  const art = color ?? "azul"
  const light = art === "platino" || art === "oro" || art === "lima"
  if (kind === "transfer") {
    return (
      <span className={cn("inline-flex shrink-0 items-center justify-center rounded-mini bg-secondary text-text-secondary", className)} style={{ width, height }} aria-hidden>
        <KWIcon name="transfer" size={14} strokeWidth={2.2} />
      </span>
    )
  }
  if (kind === "cash") {
    return (
      <span className={cn("inline-flex shrink-0 items-center justify-center rounded-mini bg-positive-tint text-positive", className)} style={{ width, height }} aria-hidden>
        <KWIcon name="cash" size={size === "tiny" ? 14 : 16} />
      </span>
    )
  }
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center overflow-hidden rounded-mini", className)}
      style={{ width, height, backgroundImage: `linear-gradient(135deg, var(--card-art-${art}-from), var(--card-art-${art}-to))` }}
      aria-hidden
    >
      <span className={cn("pointer-events-none absolute inset-0 bg-linear-to-b to-transparent to-50%", light ? "from-white/50" : "from-white/30")} />
      {chip ? <span className="relative ml-1.5 h-[7px] w-[9px] rounded-[2px] bg-(--card-art-chip-from)" /> : null}
    </span>
  )
}
