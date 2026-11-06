"use client"

import { ChevronRightIcon, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { createElement, type ComponentProps, type ReactNode } from "react"

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { formatMoney, type Money, type Sign } from "@/lib/domain"
import type { CardColor, CardKind, CardNetwork, TransactionCategory } from "@/lib/schema"
import { categoryColor, categorySymbol, cardArtIsLight } from "@/lib/presentation/display"
import { symbolIcon } from "@/lib/presentation/icons"
import { cn } from "@/lib/utils"

// Keepwell's look on top of shadcn: wrappers in the spirit of the iOS DesignSystem (KWScreen,
// KWSurfaceCard, KWTransactionRow, KWCardArt), built from the generated tokens.

/** A page's content column with the desktop gutters. */
export function Page({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto flex w-full max-w-6xl flex-col gap-6 px-(--gutter) py-6 md:px-8 md:py-8", className)} {...props} />
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="type-title">{title}</h1>
        {subtitle ? <p className="type-body text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/** KWSurfaceCard: the grouped surface every section sits on. */
export function Surface({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-2xl bg-card text-card-foreground ring-1 ring-border/60", className)} {...props} />
}

export function SectionTitle({ title, href, action, className }: { title: ReactNode; href?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-2 px-4 pt-4 pb-2", className)}>
      <h2 className="type-heading">{title}</h2>
      {href && action ? (
        <Link href={href} className="inline-flex items-center gap-0.5 type-label text-link hover:text-link-hover">
          {action}
          <ChevronRightIcon className="size-4" aria-hidden />
        </Link>
      ) : (
        action
      )}
    </div>
  )
}

export function Amount({ value, sign, fractionDigits, className }: { value: Money; sign?: Sign; fractionDigits?: number; className?: string }) {
  return <span className={cn("tabular-nums", className)}>{formatMoney(value, { ...(sign ? { sign } : {}), ...(fractionDigits === undefined ? {} : { fractionDigits }) })}</span>
}

/** A category's symbol in a tinted circle, like the iOS rows. */
export function CategoryBadge({ category, symbol, size = "md", className }: { category?: TransactionCategory | undefined; symbol?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const color = categoryColor(category)
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full", size === "sm" ? "size-8" : size === "lg" ? "size-12" : "size-10", className)}
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)` }}
      aria-hidden
    >
      {/* A lookup by stored symbol name, so the glyph is created from the table rather than declared here. */}
      {createElement(symbolIcon(symbol ?? categorySymbol(category)), { className: size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-5", strokeWidth: 2 })}
    </span>
  )
}

export function IconBadge({ icon: Icon, tone = "neutral", className }: { icon: LucideIcon; tone?: "neutral" | "positive" | "negative" | "pending" | "accent"; className?: string }) {
  const tones = {
    neutral: "bg-neutral-tint text-neutral",
    positive: "bg-positive-tint text-positive",
    negative: "bg-negative-tint text-negative",
    pending: "bg-pending-tint text-pending",
    accent: "bg-accent-tint text-link",
  }
  return (
    <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full", tones[tone], className)} aria-hidden>
      <Icon className="size-5" strokeWidth={2} />
    </span>
  )
}

export function EmptyState({ icon: Icon, title, description, children }: { icon: LucideIcon; title: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  )
}

/** KWCardArt: a real plastic's face, colored by its stored art. */
export function CardArt({
  color,
  bank,
  network,
  lastFour,
  kind,
  kindLabel,
  holder,
  caption,
  className,
  size = "md",
}: {
  color: CardColor | undefined
  bank: string
  network?: CardNetwork | undefined
  lastFour?: string | undefined
  kind: CardKind
  kindLabel?: string
  holder?: string | undefined
  caption?: ReactNode
  className?: string
  size?: "sm" | "md"
}) {
  const art = color ?? "azul"
  const light = cardArtIsLight(art)
  return (
    <div
      className={cn(
        "relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-2xl p-4 shadow-depth select-none",
        light ? "text-[#24272D]" : "text-white",
        size === "sm" && "rounded-xl p-3",
        className,
      )}
      style={{ backgroundImage: `linear-gradient(135deg, var(--card-art-${art}-from), var(--card-art-${art}-to))` }}
      data-kind={kind}
    >
      <span className={cn("pointer-events-none absolute -top-1/3 -right-1/4 aspect-square w-3/4 rounded-full", light ? "bg-white/30" : "bg-white/10")} aria-hidden />
      <div className="relative flex items-start justify-between gap-2">
        <span className={cn("truncate font-bold", size === "sm" ? "type-caption" : "type-heading")}>{bank}</span>
        {caption ? <span className="type-micro opacity-80">{caption}</span> : null}
      </div>
      {size === "md" ? (
        <span className="relative h-7 w-10 rounded-md" style={{ backgroundImage: "linear-gradient(135deg, var(--card-art-chip-from), var(--card-art-chip-to))" }} aria-hidden />
      ) : null}
      <div className="relative flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          {holder ? <span className="truncate type-micro tracking-wider opacity-80">{holder}</span> : null}
          <span className={cn("font-mono tracking-widest tabular-nums", size === "sm" ? "type-caption-sm" : "type-label")}>{lastFour ? `•••• ${lastFour}` : "•••• ••••"}</span>
        </div>
        <div className="flex flex-col items-end">
          {network && network !== "other" ? <NetworkMark network={network} small={size === "sm"} /> : null}
          {kindLabel ? <span className="type-micro opacity-80">{kindLabel}</span> : null}
        </div>
      </div>
    </div>
  )
}

function NetworkMark({ network, small }: { network: Exclude<CardNetwork, "other">; small: boolean }) {
  if (network === "mastercard") {
    return (
      <span className={cn("flex", small ? "h-4" : "h-6")} aria-label="Mastercard">
        <span className="aspect-square h-full rounded-full bg-[#EB001B]" />
        <span className="-ml-[35%] aspect-square h-full rounded-full bg-[#F79E1B] mix-blend-screen" />
      </span>
    )
  }
  return <span className={cn("font-black italic", small ? "type-caption" : "type-heading")}>{network === "visa" ? "VISA" : "AMEX"}</span>
}

/** A label/value row of a detail panel (iOS grouped list rows). */
export function DetailRow({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-4 py-3", className)}>
      <span className="type-label text-text-secondary">{label}</span>
      <span className="min-w-0 text-right type-body break-words">{children}</span>
    </div>
  )
}

export function DetailGroup({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("divide-y divide-divider overflow-hidden rounded-xl bg-secondary/60", className)} {...props} />
}
