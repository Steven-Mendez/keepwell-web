"use client"

import Link from "next/link"
import { useId, type ComponentProps, type ReactNode } from "react"

import { Kbd } from "@/components/ui/kbd"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import {
  kwButtonClass,
  TRANSACTION_LOOK,
  type ButtonCommon,
  type KWTransactionStyle,
} from "./design-styles"
import { KWIcon } from "./kw-icon"
import { SelectionPill } from "./motion"
import type { KWIconName } from "./kw-icon-data"

export type {
  KWButtonSize,
  KWButtonVariant,
  KWTransactionStyle,
} from "./design-styles"

// The iOS DesignSystem components (keepwell-ios Packages/DesignSystem/Sources/DesignSystem/
// Components), redrawn for the web: same colors, radii, type and roles, with desktop behavior on
// top (hover, focus rings, tooltips that name the keyboard shortcut, denser sizes). Screens use
// these instead of restating colors and sizes, as iOS screens use KW* views. See DESIGN.md.

function ButtonContent({
  icon,
  shortcut,
  size,
  variant,
  children,
}: ButtonCommon & { children: ReactNode }) {
  const small = size === "mini" || size === "small"
  return (
    <>
      {icon ? (
        <KWIcon name={icon} size={small ? 16 : 18} strokeWidth={2.2} />
      ) : null}
      {children}
      {shortcut ? (
        <kbd
          className={cn(
            "rounded-md px-1.5 type-micro",
            variant === "primary"
              ? "bg-primary-foreground/10 text-primary-foreground/70"
              : "bg-secondary text-muted-foreground"
          )}
        >
          {shortcut}
        </kbd>
      ) : null}
    </>
  )
}

export function KWButton({
  variant = "primary",
  size = "regular",
  icon,
  shortcut,
  fill,
  className,
  children,
  ...props
}: ButtonCommon & ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        kwButtonClass({ variant, size, fill: fill ?? false }),
        className
      )}
      {...props}
    >
      <ButtonContent
        icon={icon}
        shortcut={shortcut}
        size={size}
        variant={variant}
      >
        {children}
      </ButtonContent>
    </button>
  )
}

export function KWButtonLink({
  variant = "primary",
  size = "regular",
  icon,
  shortcut,
  fill,
  className,
  children,
  ...props
}: ButtonCommon & ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        kwButtonClass({ variant, size, fill: fill ?? false }),
        className
      )}
      {...props}
    >
      <ButtonContent
        icon={icon}
        shortcut={shortcut}
        size={size}
        variant={variant}
      >
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
}: {
  icon: KWIconName | ReactNode
  label: string
  shortcut?: string | undefined
  variant?: "surface" | "white" | "translucent"
  size?: number
} & Omit<ComponentProps<"button">, "children">) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className={cn(
              "inline-flex shrink-0 press items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
              variant === "white"
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : variant === "translucent"
                  ? "bg-foreground/14 text-foreground hover:bg-foreground/20"
                  : "bg-card text-foreground hover:bg-secondary",
              className
            )}
            style={{ width: size, height: size }}
            {...props}
          />
        }
      >
        {typeof icon === "string" ? (
          <KWIcon
            name={icon as KWIconName}
            size={size / 2}
            strokeWidth={variant === "white" ? 2.2 : 2}
          />
        ) : (
          icon
        )}
      </TooltipTrigger>
      <TooltipContent className="flex items-center gap-2">
        {label}
        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  )
}

// KWActionButton: a 48 pt circle with its caption underneath ("Expense", "Pay", "Edit name").

export function KWActionButton({
  icon,
  title,
  variant = "neutral",
  shortcut,
  className,
  ...props
}: {
  icon: KWIconName
  title: string
  variant?: "neutral" | "prominent" | "translucent" | "active"
  shortcut?: string | undefined
} & Omit<ComponentProps<"button">, "children">) {
  const circle = {
    neutral: "bg-secondary text-foreground group-hover/action:bg-secondary/70",
    prominent:
      "bg-primary text-primary-foreground group-hover/action:bg-primary/90",
    translucent:
      "bg-foreground/18 text-foreground group-hover/action:bg-foreground/24",
    active: "bg-link text-primary-foreground",
  }[variant]
  return (
    <button
      type="button"
      className={cn(
        "group/action flex min-w-16 press flex-col items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
        className
      )}
      title={shortcut ? `${title} (${shortcut})` : undefined}
      {...props}
    >
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-full transition-colors",
          circle
        )}
      >
        <KWIcon name={icon} size={22} />
      </span>
      <span className="type-caption-sm font-medium text-foreground">
        {title}
      </span>
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
  /** large: equal widths, 40 px tall in all; compact and accent: hugging, 32 px tall (row height). */
  style?: "large" | "compact" | "accent"
  className?: string
  "aria-label"?: string
}) {
  // The selection is one capsule that slides between options (KWSegmentedControl animates it with
  // .snappy): a shared layoutId per control, so motion carries it from the old option to the new.
  const pillId = useId()

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "relative isolate inline-flex rounded-full bg-card p-1",
        style === "accent" ? "gap-1.5" : "gap-0.5",
        style === "large" && "flex w-full",
        className
      )}
    >
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
              "relative isolate rounded-full whitespace-nowrap transition-[color,opacity] duration-(--duration-fast) outline-none focus-visible:ring-2 focus-visible:ring-ring active:opacity-70 disabled:opacity-40",
              style === "large"
                ? "h-8 flex-1 px-3 type-label"
                : style === "accent"
                  ? "h-6 px-3 type-caption font-bold"
                  : "h-6 px-3 type-caption font-semibold",
              selected
                ? style === "accent"
                  ? // White in both modes: the light accent is deep enough for it.
                    "text-white"
                  : "text-primary-foreground"
                : "text-text-secondary hover:text-foreground"
            )}
          >
            {selected ? (
              <SelectionPill
                layoutId={pillId}
                className={style === "accent" ? "bg-ring" : "bg-primary"}
              />
            ) : null}
            {option.title}
          </button>
        )
      })}
    </div>
  )
}

// KWChip: the list filter pill (filled), the currency chooser (outlined) and the lima highlight.

export function KWChip({
  selected,
  look: variant = "filled",
  pillId,
  className,
  children,
  ...props
}: {
  selected: boolean
  look?: "filled" | "outlined" | "extra"
  /** Chips of one filter row sharing a `pillId` slide the white selection between them (filled look). */
  pillId?: string
} & ComponentProps<"button">) {
  const slides = pillId !== undefined && variant === "filled"
  const look = {
    filled: selected
      ? cn("text-primary-foreground", !slides && "bg-primary")
      : "bg-card text-text-secondary hover:text-foreground",
    outlined: selected
      ? "bg-primary text-primary-foreground ring-1 ring-primary"
      : "bg-card text-text-secondary ring-1 ring-border ring-inset hover:text-foreground",
    extra: selected
      ? "bg-extra-tint text-extra ring-1 ring-extra"
      : "bg-card text-text-secondary ring-1 ring-border ring-inset hover:text-foreground",
  }[variant]
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "relative isolate inline-flex h-8 press items-center gap-1.5 rounded-full px-3.5 type-label whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
        look,
        className
      )}
      {...props}
    >
      {slides && selected ? (
        <SelectionPill layoutId={pillId} className="bg-primary" />
      ) : null}
      {children}
    </button>
  )
}

// KWLargeTitleHeader: the 30 pt screen title, optional subtitle, trailing actions.

export function KWLargeTitleHeader({
  title,
  subtitle,
  trailing,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="type-title text-foreground">{title}</h1>
        {subtitle ? (
          <div className="type-body text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      ) : null}
    </header>
  )
}

// KWSectionHeader + KWGroupedCard: titled groups of rows on the `surface` card.

export function KWSectionHeader({
  title,
  style = "small",
  children,
  className,
}: {
  title: ReactNode
  style?: "small" | "large"
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-2 px-1",
        className
      )}
    >
      <h2
        className={
          style === "small"
            ? "type-label text-muted-foreground"
            : "type-heading text-foreground"
        }
      >
        {title}
      </h2>
      {children}
    </div>
  )
}

/** "+ Add"-style text action beside a section title, in the link color. */
export function KWTextAction({
  className,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "type-label text-link transition-colors outline-none hover:text-link-hover focus-visible:underline",
        className
      )}
      {...props}
    />
  )
}

export function KWGroupedCard({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col divide-y divide-divider overflow-hidden rounded-[var(--radius-surface)] bg-card",
        className
      )}
      {...props}
    />
  )
}

export function KWSection({
  title,
  action,
  children,
  className,
}: {
  title: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
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
      {leading ? (
        <span className="flex shrink-0 items-center text-text-faint">
          {leading}
        </span>
      ) : null}
      <span
        className={cn(
          "min-w-0 flex-1 truncate type-body",
          tone === "destructive"
            ? "text-negative"
            : tone === "link"
              ? "text-link"
              : "text-foreground"
        )}
      >
        {label}
      </span>
      {value !== undefined ? (
        <span className="min-w-0 truncate text-right type-body text-text-secondary">
          {value}
        </span>
      ) : null}
      {trailing}
      {interactive && tone === "default" && trailing === undefined ? (
        <KWIcon
          name="chevronRight"
          size={16}
          className="shrink-0 text-text-faint"
        />
      ) : null}
    </>
  )
  const classes = cn(
    "flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left",
    interactive &&
      "press-row outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50",
    className
  )
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

export function KWEmptyState({
  icon,
  title,
  message,
  action,
  className,
}: {
  icon: KWIconName
  title: ReactNode
  message?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 px-4 py-12 text-center",
        className
      )}
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-card text-text-secondary">
        <KWIcon name={icon} size={28} />
      </span>
      <div className="flex max-w-sm flex-col gap-2">
        {/* KWEmptyState title: 20 pt, weight 800 (the amount-sm step of the scale). */}
        <p className="type-amount-sm text-foreground">{title}</p>
        {message ? (
          <p className="type-body leading-relaxed text-muted-foreground">
            {message}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

// KWTransactionIcon: the movement's kind in a 40 pt tinted circle.

export function KWTransactionIcon({
  style,
  className,
}: {
  style: KWTransactionStyle
  className?: string
}) {
  const look = TRANSACTION_LOOK[style]
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full",
        look.circle,
        className
      )}
      aria-hidden
    >
      <KWIcon name={look.icon} size={20} />
    </span>
  )
}
