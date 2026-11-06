"use client"

import Link from "next/link"
import type { ComponentProps, ReactNode } from "react"

import { Kbd } from "@/components/ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { KWIcon } from "./kw-icon"
import type { KWIconName } from "./kw-icon-data"

// The iOS DesignSystem components (keepwell-ios Packages/DesignSystem/Sources/DesignSystem/
// Components), redrawn for the web: same colors, radii, type and roles, with desktop behavior on
// top (hover, focus rings, tooltips that name the keyboard shortcut, denser sizes). Screens use
// these instead of restating colors and sizes, as iOS screens use KW* views. See DESIGN.md.

// KWButtonStyle: pill buttons by role.

export type KWButtonVariant = "primary" | "secondary" | "surface" | "destructive" | "link" | "plain"
export type KWButtonSize = "large" | "regular" | "row" | "text" | "medium" | "small" | "mini"

const BUTTON_VARIANTS: Record<KWButtonVariant, string> = {
  // White fill, black label: the main action of a screen.
  primary: "bg-white text-black hover:bg-white/90",
  secondary: "bg-secondary text-foreground hover:bg-secondary/80",
  surface: "bg-card text-foreground hover:bg-secondary",
  destructive: "bg-card text-negative hover:bg-negative-tint",
  link: "bg-secondary text-link hover:text-link-hover",
  plain: "bg-transparent text-foreground hover:bg-card",
}

/** Heights and type from KWButtonStyle.Size; the large ones are a touch shorter on desktop. */
const BUTTON_SIZES: Record<KWButtonSize, string> = {
  large: "h-12 px-6 type-heading",
  regular: "h-11 px-6 type-heading",
  row: "h-11 px-5 type-body font-semibold",
  text: "h-10 px-4 type-body font-semibold",
  medium: "h-10 px-4 type-label font-bold",
  small: "h-[34px] px-3.5 type-label",
  mini: "h-8 px-3 type-caption font-semibold",
}

type ButtonCommon = { variant?: KWButtonVariant | undefined; size?: KWButtonSize | undefined; icon?: KWIconName | undefined; shortcut?: string | undefined; fill?: boolean | undefined }

export function kwButtonClass({ variant = "primary", size = "regular", fill = false }: ButtonCommon = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full whitespace-nowrap transition-[background-color,color,opacity] outline-none select-none",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    fill && "w-full",
  )
}

function ButtonContent({ icon, shortcut, size, variant, children }: ButtonCommon & { children: ReactNode }) {
  const small = size === "mini" || size === "small"
  return (
    <>
      {icon ? <KWIcon name={icon} size={small ? 16 : 18} strokeWidth={2.2} /> : null}
      {children}
      {shortcut ? <kbd className={cn("rounded-md px-1.5 type-micro", variant === "primary" ? "bg-black/8 text-black/55" : "bg-secondary text-muted-foreground")}>{shortcut}</kbd> : null}
    </>
  )
}

export function KWButton({ variant = "primary", size = "regular", icon, shortcut, fill, className, children, ...props }: ButtonCommon & ComponentProps<"button">) {
  return (
    <button type="button" className={cn(kwButtonClass({ variant, size, fill: fill ?? false }), className)} {...props}>
      <ButtonContent icon={icon} shortcut={shortcut} size={size} variant={variant}>
        {children}
      </ButtonContent>
    </button>
  )
}

export function KWButtonLink({ variant = "primary", size = "regular", icon, shortcut, fill, className, children, ...props }: ButtonCommon & ComponentProps<typeof Link>) {
  return (
    <Link className={cn(kwButtonClass({ variant, size, fill: fill ?? false }), className)} {...props}>
      <ButtonContent icon={icon} shortcut={shortcut} size={size} variant={variant}>
        {children}
      </ButtonContent>
    </Link>
  )
}

// KWCircleButton: 40 pt round buttons for back, close, search and the white "+".

export function KWCircleButton({
  icon,
  label,
  shortcut,
  variant = "surface",
  size = 40,
  className,
  ...props
}: { icon: KWIconName | ReactNode; label: string; shortcut?: string; variant?: "surface" | "white" | "translucent"; size?: number } & Omit<ComponentProps<"button">, "children">) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,opacity] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
              variant === "white" ? "bg-white text-black hover:bg-white/90" : variant === "translucent" ? "bg-white/14 text-foreground hover:bg-white/20" : "bg-card text-foreground hover:bg-secondary",
              className,
            )}
            style={{ width: size, height: size }}
            {...props}
          />
        }
      >
        {typeof icon === "string" ? <KWIcon name={icon as KWIconName} size={size / 2} strokeWidth={variant === "white" ? 2.2 : 2} /> : icon}
      </TooltipTrigger>
      <TooltipContent className="flex items-center gap-2">
        {label}
        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  )
}

// KWActionButton: a 48 pt circle with its caption underneath ("Expense", "Pay", "Edit name").

export function KWActionButton({ icon, title, variant = "neutral", shortcut, className, ...props }: { icon: KWIconName; title: string; variant?: "neutral" | "prominent" | "translucent" | "active"; shortcut?: string } & Omit<ComponentProps<"button">, "children">) {
  const circle = {
    neutral: "bg-secondary text-foreground group-hover/action:bg-secondary/70",
    prominent: "bg-white text-black group-hover/action:bg-white/90",
    translucent: "bg-white/18 text-foreground group-hover/action:bg-white/24",
    active: "bg-link text-black",
  }[variant]
  return (
    <button type="button" className={cn("group/action flex min-w-16 flex-col items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40", className)} title={shortcut ? `${title} (${shortcut})` : undefined} {...props}>
      <span className={cn("flex size-12 items-center justify-center rounded-full transition-colors", circle)}>
        <KWIcon name={icon} size={22} />
      </span>
      <span className="type-caption-sm font-medium text-foreground">{title}</span>
    </button>
  )
}

// KWSegmentedControl: single choice in a `surface` capsule.

export function KWSegmented<T extends string>({
  options,
  value,
  onChange,
  style = "large",
  className,
  "aria-label": ariaLabel,
}: {
  options: readonly { value: T; title: string; disabled?: boolean }[]
  value: T
  onChange: (value: T) => void
  /** large: equal widths, 38 pt; compact: hugging, 30 pt; accent: hugging with the accent selection. */
  style?: "large" | "compact" | "accent"
  className?: string
  "aria-label"?: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex rounded-full bg-card p-1", style === "accent" ? "gap-1.5" : "gap-0.5", style === "large" && "flex w-full", className)}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
              style === "large" ? "h-[38px] flex-1 px-3 type-label" : style === "accent" ? "h-[30px] px-3.5 type-caption font-bold" : "h-[30px] px-3 type-caption font-semibold",
              selected ? (style === "accent" ? "bg-ring text-foreground" : "bg-white text-black") : "text-text-secondary hover:text-foreground",
            )}
          >
            {option.title}
          </button>
        )
      })}
    </div>
  )
}

// KWChip: the list filter pill (filled), the currency chooser (outlined) and the lima highlight.

export function KWChip({ selected, look: variant = "filled", className, children, ...props }: { selected: boolean; look?: "filled" | "outlined" | "extra" } & ComponentProps<"button">) {
  const look = {
    filled: selected ? "bg-white text-black" : "bg-card text-text-secondary hover:text-foreground",
    outlined: selected ? "bg-white text-black ring-1 ring-white" : "bg-card text-text-secondary ring-1 ring-border ring-inset hover:text-foreground",
    extra: selected ? "bg-extra-tint text-extra ring-1 ring-extra" : "bg-card text-text-secondary ring-1 ring-border ring-inset hover:text-foreground",
  }[variant]
  return (
    <button type="button" aria-pressed={selected} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-4 type-label whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring", look, className)} {...props}>
      {children}
    </button>
  )
}

// KWLargeTitleHeader: the 30 pt screen title, optional subtitle, trailing actions.

export function KWLargeTitleHeader({ title, subtitle, trailing, className }: { title: ReactNode; subtitle?: ReactNode; trailing?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="type-title text-foreground">{title}</h1>
        {subtitle ? <div className="type-body text-muted-foreground">{subtitle}</div> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </header>
  )
}

// KWSectionHeader + KWGroupedCard: titled groups of rows on the `surface` card.

export function KWSectionHeader({ title, style = "small", children, className }: { title: ReactNode; style?: "small" | "large"; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-2 px-1", className)}>
      <h2 className={style === "small" ? "type-label text-muted-foreground" : "type-heading text-foreground"}>{title}</h2>
      {children}
    </div>
  )
}

/** "+ Add"-style text action beside a section title, in the link color. */
export function KWTextAction({ className, ...props }: ComponentProps<"button">) {
  return <button type="button" className={cn("type-label text-link transition-colors outline-none hover:text-link-hover focus-visible:underline", className)} {...props} />
}

export function KWGroupedCard({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col divide-y divide-divider overflow-hidden rounded-[var(--radius-surface)] bg-card", className)} {...props} />
}

export function KWSection({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <KWSectionHeader title={title}>{action}</KWSectionHeader>
      {children}
    </section>
  )
}

/**
 * KWValueRow: a label and its value inside a grouped card. With `href` or `onClick` it becomes a
 * navigation row with the chevron, hover and focus, as settings rows are tappable on iOS.
 */
export function KWValueRow({
  label,
  value,
  leading,
  trailing,
  href,
  onClick,
  tone = "default",
  className,
}: {
  label: ReactNode
  value?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  href?: string
  onClick?: () => void
  tone?: "default" | "destructive" | "link"
  className?: string
}) {
  const interactive = href !== undefined || onClick !== undefined
  const content = (
    <>
      {leading ? <span className="flex shrink-0 items-center text-text-faint">{leading}</span> : null}
      <span className={cn("min-w-0 flex-1 truncate type-body", tone === "destructive" ? "text-negative" : tone === "link" ? "text-link" : "text-foreground")}>{label}</span>
      {value !== undefined ? <span className="min-w-0 truncate text-right type-body text-text-secondary">{value}</span> : null}
      {trailing}
      {interactive && tone === "default" && trailing === undefined ? <KWIcon name="chevronRight" size={16} className="shrink-0 text-text-faint" /> : null}
    </>
  )
  const classes = cn("flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left", interactive && "transition-colors outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50", className)
  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    )
  }
  return <div className={classes}>{content}</div>
}

// KWEmptyState: an icon in a `surface` circle, a short title, one sentence, the next step.

export function KWEmptyState({ icon, title, message, action, className }: { icon: KWIconName; title: ReactNode; message?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-4 px-4 py-12 text-center", className)}>
      <span className="flex size-16 items-center justify-center rounded-full bg-card text-text-secondary">
        <KWIcon name={icon} size={28} />
      </span>
      <div className="flex max-w-sm flex-col gap-2">
        <p className="text-xl font-extrabold text-foreground">{title}</p>
        {message ? <p className="type-body leading-relaxed text-muted-foreground">{message}</p> : null}
      </div>
      {action}
    </div>
  )
}

// KWTransactionIcon: the movement's kind in a 40 pt tinted circle.

export type KWTransactionStyle = "expense" | "income" | "transfer" | "planned"

const TRANSACTION_LOOK: Record<KWTransactionStyle, { icon: KWIconName; circle: string; amount: string }> = {
  // Expenses use the soft coral, never an alarm red; transfers between own accounts stay neutral.
  expense: { icon: "arrowUpRight", circle: "bg-negative-tint text-negative", amount: "text-negative" },
  income: { icon: "arrowDownLeft", circle: "bg-positive-tint text-positive", amount: "text-positive" },
  transfer: { icon: "transfer", circle: "bg-neutral-tint text-neutral", amount: "text-foreground" },
  planned: { icon: "clock", circle: "bg-pending-tint text-pending", amount: "text-pending" },
}

export function KWTransactionIcon({ style, className }: { style: KWTransactionStyle; className?: string }) {
  const look = TRANSACTION_LOOK[style]
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", look.circle, className)} aria-hidden>
      <KWIcon name={look.icon} size={20} />
    </span>
  )
}

export function transactionAmountClass(style: KWTransactionStyle): string {
  return TRANSACTION_LOOK[style].amount
}
