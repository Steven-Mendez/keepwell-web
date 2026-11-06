"use client"

import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react"
import type { ReactNode } from "react"

import { DURATION, EASE_OUT_IOS, SPRING } from "@/lib/motion"
import { cn } from "@/lib/utils"

/**
 * Once for the whole app: every motion/react animation defaults to the standard spring and, under
 * `prefers-reduced-motion`, keeps opacity changes while dropping travel and scale (SwiftUI's
 * accessibilityReduceMotion), like the CSS rule in globals.css.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={SPRING}>
      {children}
    </MotionConfig>
  )
}

/**
 * The selection capsule that slides between options, the web's `matchedGeometryEffect`: render it
 * inside the selected option only, with one `layoutId` per control, and motion moves the single
 * capsule from the old option to the new one with the spring. Sits under the option's label.
 */
export function SelectionPill({
  layoutId,
  className,
}: {
  layoutId: string
  className?: string
}) {
  return (
    <motion.span
      aria-hidden
      layoutId={layoutId}
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 rounded-full",
        className
      )}
      transition={SPRING}
    />
  )
}

/**
 * A progress bar's fill, filling with the spring when it mounts and when `fraction` (0…1) changes,
 * like `.animation(.snappy, value: chart)` on iOS bars. Animates scaleX from the leading edge, so
 * nothing lays out again while it moves.
 */
export function SpringFill({
  fraction,
  className,
}: {
  fraction: number
  className?: string
}) {
  const clamped = Math.min(Math.max(fraction, 0), 1)
  return (
    <motion.span
      aria-hidden
      className={cn("block h-full w-full origin-left rounded-full", className)}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: clamped }}
      transition={SPRING}
    />
  )
}

const FADE = { duration: DURATION.base, ease: EASE_OUT_IOS }
const COLLAPSED = { opacity: 0, height: 0, y: 8, filter: "blur(4px)" }
const SHOWN = { opacity: 1, height: "auto", y: 0, filter: "blur(0px)" }

/**
 * A row that arrives in and leaves a live list (Dexie's useLiveQuery adds or drops it): it grows
 * from nothing while fading up 8 px out of a slight blur, and collapses the same way when removed,
 * so the rows around it glide instead of jumping. Needs an `AnimatedList` (AnimatePresence) above
 * it for the exit; without one it only plays its entrance. Under Reduce Motion only opacity moves.
 * `overflow: clip` (not hidden) keeps sticky headers inside working.
 */
export function ListItem({
  className,
  children,
}: {
  className?: string | undefined
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  const hidden = reduce ? { opacity: 0 } : COLLAPSED
  return (
    <motion.div
      className={cn("overflow-clip", className)}
      initial={hidden}
      animate={reduce ? { opacity: 1 } : SHOWN}
      exit={hidden}
      transition={{ ...SPRING, opacity: FADE, filter: FADE }}
    >
      {children}
    </motion.div>
  )
}

/**
 * The AnimatePresence for a list of `ListItem`s. Rows already there on first render don't animate,
 * so screens don't ripple on load; only real insertions and removals do.
 */
export function AnimatedList({ children }: { children: ReactNode }) {
  return <AnimatePresence initial={false}>{children}</AnimatePresence>
}
