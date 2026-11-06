"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"

import { EASE_OUT_IOS, SPRING } from "@/lib/motion"
import { cn } from "@/lib/utils"

export type WalletEntry = { id: string; label: string; art: ReactNode }

/** The width:height of a card (ISO/IEC 7810 ID-1), as KWComponentMetrics.cardArtRatio. */
const CARD_RATIO = 1.586
/** How much of each card shows above the next, as in Wallet (iOS WalletStack.reveal). */
const REVEAL = 76
/** The least a strip may shrink to when fitting the wallet into the screen: bank and badge still read. */
const MIN_REVEAL = 48
/** How far a card behind lifts on hover, peeking out of the deck. */
const PEEK = 14
/** The first turn of the deck, in seconds: an even ease-out with no spring overshoot, so nothing bounces. */
const TURN_DURATION = 0.38
/** Milliseconds before the second turn, a little under a turn so the roll flows. */
const TURN_INTERVAL = 260
/** Each turn takes this share of the one before, so a long roll speeds up instead of dragging. */
const TURN_ACCELERATION = 0.9
/** The fastest a turn may get, in seconds, so the cards still read as moving rather than jumping. */
const MIN_TURN_DURATION = 0.28
/** The shortest wait between turns, in milliseconds. */
const MIN_TURN_INTERVAL = 190

/**
 * The deck as drawn: turned like a wheel until `frontId` is last, painted in front. The cards that were
 * in front of it go round to the back in their order, so the deck's order never breaks.
 */
function deal(cards: readonly WalletEntry[], frontId: string | undefined): readonly WalletEntry[] {
  const at = cards.findIndex((card) => card.id === frontId)
  if (at < 0 || cards.length < 2) return cards
  return [...cards.slice(at + 1), ...cards.slice(0, at + 1)]
}

/**
 * iOS WalletStack for the web: every card in one Wallet-style deck, each showing its top strip above
 * the next, the last one whole in front. Selecting a card rolls the deck one card at a time, like an endless
 * scroll: on each turn the front card goes round to the back and the rest step down a slot, each turn
 * quicker than the last, until the selected card is in front.
 * With `fit`, the strips shrink (down to MIN_REVEAL) so the whole deck fits its box without scrolling.
 * Cards deal in from below and move with the app's spring when the chips reshuffle the deck; a card
 * behind lifts on hover; the selected one is ringed.
 */
export function WalletStack({ cards, selectedId, onSelect, fit = false }: { cards: readonly WalletEntry[]; selectedId?: string | undefined; onSelect: (id: string) => void; fit?: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 358, height: 0 })
  const reduceMotion = useReducedMotion()
  const target = cards.some((card) => card.id === selectedId) ? selectedId : cards.at(-1)?.id
  const [frontId, setFrontId] = useState(target)
  // How many turns the current roll has taken, which sets how fast the next one goes.
  const [roll, setRoll] = useState({ target, turns: 0 })
  if (roll.target !== target) setRoll({ target, turns: 0 })
  const pace = TURN_ACCELERATION ** roll.turns
  const turnDuration = Math.max(MIN_TURN_DURATION, TURN_DURATION * pace)
  const turnInterval = Math.max(MIN_TURN_INTERVAL, TURN_INTERVAL * pace)

  // A filter can take the front card away, leaving nothing to roll from, and reduced motion skips the
  // roll: either way, jump straight to the selected card.
  if (frontId !== target && (reduceMotion || !cards.some((card) => card.id === frontId))) setFrontId(target)

  // Roll one turn at a time toward the selected card; each turn brings forward the card behind the front.
  useEffect(() => {
    if (frontId === target || target === undefined) return
    const timer = setTimeout(() => {
      const at = cards.findIndex((card) => card.id === frontId)
      setFrontId(cards[(at - 1 + cards.length) % cards.length]?.id)
      setRoll((current) => ({ ...current, turns: current.turns + 1 }))
    }, turnInterval)
    return () => clearTimeout(timer)
  }, [cards, frontId, target, turnInterval])

  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // The box pads 4 px on the sides and 16 px on top so focus rings and the hover lift aren't clipped.
  const cardHeight = (size.width - 8) / CARD_RATIO
  const count = cards.length
  const room = fit && size.height > 0 && count > 1 ? (size.height - 16 - cardHeight) / (count - 1) : REVEAL
  const reveal = Math.max(MIN_REVEAL, Math.min(REVEAL, room))
  const deckHeight = count === 0 ? 0 : cardHeight + (count - 1) * reveal
  const deck = deal(cards, frontId)

  return (
    // `fit` boxes fill their column and only scroll when even the smallest strips can't fit.
    <div ref={box} className={cn("relative -mx-1 -mt-4 px-1 pt-4", fit && "min-h-0 flex-1 overflow-y-auto [scrollbar-width:none]")}>
      <ul className="relative w-full" style={{ height: deckHeight }}>
        <AnimatePresence initial={false} mode="popLayout">
          {deck.map((card, index) => {
            const y = index * reveal
            const isFront = index === count - 1
            // A lone card needs no "this one" ring.
            const isSelected = count > 1 && card.id === selectedId
            return (
              <motion.li
                key={card.id}
                className="absolute inset-x-0 top-0"
                style={{ zIndex: index }}
                initial={{ y: y + 120, opacity: 0 }}
                animate={{ y, opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
                whileHover={isFront ? { y: y - 4 } : { y: y - PEEK }}
                transition={{ y: { duration: turnDuration, ease: EASE_OUT_IOS }, default: SPRING }}
              >
                <motion.button
                  type="button"
                  onClick={() => onSelect(card.id)}
                  aria-label={card.label}
                  aria-current={isSelected ? "true" : undefined}
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING}
                  className={cn(
                    "block w-full rounded-[var(--radius-card)] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    // Cards behind cast their shadow upward onto the strip above, as stacked plastic does.
                    index > 0 && "shadow-[0_-10px_24px_-6px_rgb(0_0_0/0.55)]",
                  )}
                >
                  <span className={cn("block rounded-[var(--radius-card)] transition-shadow duration-(--duration-fast)", isSelected && "ring-2 ring-white/70 ring-offset-2 ring-offset-background")}>{card.art}</span>
                </motion.button>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </div>
  )
}
