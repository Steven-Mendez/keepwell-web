"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import { KWGroupedCard, KWSectionHeader } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import type { KWIconName } from "@/components/kw/kw-icon-data"
import { cn } from "@/lib/utils"

/** A row's leading glyph: a KWIcon name, or a Lucide icon where iOS has no equivalent. */
export type SettingsIcon = KWIconName | ReactNode

/**
 * A titled group of rows (Mobbin: Base, Wise): a small label over a grouped card, with an optional
 * footnote. `id` is the anchor the section list on wide screens jumps to.
 */
export function SettingsSection({ id, title, footnote, children, className }: { id?: string; title?: ReactNode; footnote?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("flex scroll-mt-24 flex-col gap-2", className)}>
      {title ? <KWSectionHeader title={title} /> : null}
      <KWGroupedCard>{children}</KWGroupedCard>
      {footnote ? <p className="px-1 type-caption leading-relaxed text-muted-foreground">{footnote}</p> : null}
    </section>
  )
}

/** The round glyph at the start of a row (Wise's settings rows). */
export function RowIcon({ icon, tone = "default" }: { icon: SettingsIcon; tone?: "default" | "destructive" }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4",
        tone === "destructive" ? "bg-negative-tint text-negative" : "bg-secondary text-foreground"
      )}
      aria-hidden
    >
      {typeof icon === "string" ? <KWIcon name={icon as KWIconName} size={16} /> : icon}
    </span>
  )
}

function RowText({ label, description, htmlFor, tone = "default" }: { label: ReactNode; description?: ReactNode; htmlFor?: string; tone?: "default" | "destructive" | "link" }) {
  const labelClass = cn("type-body", tone === "destructive" ? "text-negative" : tone === "link" ? "text-link" : "text-foreground")
  return (
    <span className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <span className={labelClass}>{label}</span>
      )}
      {description ? <span className="type-caption leading-snug text-muted-foreground">{description}</span> : null}
    </span>
  )
}

/**
 * A row holding a control (Copilot Money): icon, title and one line under it on the left, the
 * control on the right. On a phone the control drops under the text instead of squeezing it.
 */
export function SettingsRow({
  icon,
  label,
  description,
  children,
  htmlFor,
  wide,
}: {
  icon?: SettingsIcon
  label: ReactNode
  description?: ReactNode
  children?: ReactNode
  htmlFor?: string
  /** A field or picker: on a phone it takes the row's whole width under the text. */
  wide?: boolean
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-3">
      {icon ? <RowIcon icon={icon} /> : null}
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <RowText label={label} description={description} {...(htmlFor ? { htmlFor } : {})} />
        {children ? <div className={cn("flex max-w-full min-w-0 items-center gap-2", wide && "max-sm:w-full")}>{children}</div> : null}
      </div>
    </div>
  )
}

/**
 * A tappable row (Wise, Base): icon, title, an optional line under it, the value on the right and
 * the chevron. `destructive` rows show no chevron and a red icon, as a final action.
 */
export function SettingsLinkRow({
  icon,
  label,
  description,
  value,
  href,
  onClick,
  tone = "default",
  disabled,
}: {
  icon?: SettingsIcon
  label: ReactNode
  description?: ReactNode
  value?: ReactNode
  href?: string
  onClick?: () => void
  tone?: "default" | "destructive" | "link"
  disabled?: boolean
}) {
  const content = (
    <>
      {icon ? <RowIcon icon={icon} tone={tone === "destructive" ? "destructive" : "default"} /> : null}
      <RowText label={label} description={description} tone={tone} />
      {value !== undefined ? <span className="max-w-[45%] shrink-0 truncate text-right type-body text-text-secondary">{value}</span> : null}
      {tone === "default" ? <KWIcon name="chevronRight" size={16} className="shrink-0 text-text-faint" /> : null}
    </>
  )
  const classes = cn(
    "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left press-row outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50 disabled:pointer-events-none disabled:opacity-50"
  )
  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={classes}>
      {content}
    </button>
  )
}

/** The inputs that sit inside a grouped card: `surface2` fill, no border, the 12 px input radius. */
export const SETTINGS_INPUT = "h-10 rounded-xl border-0 bg-secondary px-3 type-body shadow-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-secondary"
