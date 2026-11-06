/**
 * Keepwell's motion constants for JavaScript-driven animation, the twins of the CSS tokens in
 * src/app/globals.css (`--ease-out-ios`, `--ease-spring`, `--duration-*`). Shaped as motion/react
 * transitions so they can be passed straight to `transition`, but free of any import.
 */

/** iOS-style entrance curve for elements and modals: `cubic-bezier(0.22, 1, 0.36, 1)`. */
export const EASE_OUT_IOS = [0.22, 1, 0.36, 1] as const

/**
 * The standard spring: fast and settled, without a showy bounce (ζ ≈ 0.84, response ≈ 0.265 s, the
 * physics of SwiftUI's `.spring(response: 0.45, dampingFraction: 0.82)` tightened for the web).
 * `--ease-spring` in CSS is this same spring sampled into `linear()`.
 */
export const SPRING = {
  type: "spring",
  stiffness: 450,
  damping: 32,
  mass: 0.8,
} as const

/** Durations in seconds, matching the CSS tokens. Nothing a user triggers often runs past 0.3 s. */
export const DURATION = {
  press: 0.1,
  fast: 0.15,
  base: 0.2,
  slow: 0.28,
} as const
