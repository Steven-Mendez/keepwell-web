import { cn } from "@/lib/utils"

import type { KWIconName } from "./kw-icon-data"

// The class names behind the KW components in design.tsx, kept apart so plain links, dialogs and
// rows can wear the same look without importing a component module.

// KWButtonStyle: pill buttons by role.

export type KWButtonVariant =
  "primary" | "secondary" | "surface" | "destructive" | "link" | "plain"
export type KWButtonSize =
  "large" | "regular" | "row" | "text" | "medium" | "small" | "mini"

const BUTTON_VARIANTS: Record<KWButtonVariant, string> = {
  // White fill, black label: the main action of a screen.
  primary: "bg-white text-black hover:bg-white/90",
  secondary: "bg-secondary text-foreground hover:bg-secondary/80",
  surface: "bg-card text-foreground hover:bg-secondary",
  destructive: "bg-card text-negative hover:bg-negative-tint",
  link: "bg-secondary text-link hover:text-link-hover",
  plain: "bg-transparent text-foreground hover:bg-card",
}

/**
 * KWButtonStyle sizes folded onto the web's three control heights, so neighbors always line up:
 * 48 px for a lone full-width call to action, 40 px for every regular control (buttons, fields,
 * selects, segmented controls, circle buttons), 32 px for compact actions inside rows and chips.
 */
const BUTTON_SIZES: Record<KWButtonSize, string> = {
  large: "h-12 px-6 type-heading",
  regular: "h-10 px-5 type-label",
  row: "h-10 px-5 type-label",
  text: "h-10 px-4 type-label",
  medium: "h-10 px-4 type-label",
  small: "h-8 px-3.5 type-caption font-semibold",
  mini: "h-8 px-3 type-caption font-semibold",
}

export type ButtonCommon = {
  variant?: KWButtonVariant | undefined
  size?: KWButtonSize | undefined
  icon?: KWIconName | undefined
  shortcut?: string | undefined
  fill?: boolean | undefined
}

export function kwButtonClass({
  variant = "primary",
  size = "regular",
  fill = false,
}: ButtonCommon = {}) {
  return cn(
    "inline-flex shrink-0 press items-center justify-center gap-2 rounded-full whitespace-nowrap outline-none select-none",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    fill && "w-full"
  )
}

export type KWTransactionStyle = "expense" | "income" | "transfer" | "planned"

export const TRANSACTION_LOOK: Record<
  KWTransactionStyle,
  { icon: KWIconName; circle: string; amount: string }
> = {
  // Expenses use the soft coral, never an alarm red; transfers between own accounts stay neutral.
  expense: {
    icon: "arrowUpRight",
    circle: "bg-negative-tint text-negative",
    amount: "text-negative",
  },
  income: {
    icon: "arrowDownLeft",
    circle: "bg-positive-tint text-positive",
    amount: "text-positive",
  },
  transfer: {
    icon: "transfer",
    circle: "bg-neutral-tint text-neutral",
    amount: "text-foreground",
  },
  planned: {
    icon: "clock",
    circle: "bg-pending-tint text-pending",
    amount: "text-pending",
  },
}

export function transactionAmountClass(style: KWTransactionStyle): string {
  return TRANSACTION_LOOK[style].amount
}
