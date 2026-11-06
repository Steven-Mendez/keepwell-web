"use client"

import type { ReactNode } from "react"

import { KWGroupedCard, KWSectionHeader, KWValueRow } from "@/components/kw/design"
import { cn } from "@/lib/utils"

/** iOS SettingsSection: a KWSectionHeader over a KWGroupedCard, with an optional footnote. */
export function SettingsSection({ title, footnote, children, className }: { title: ReactNode; footnote?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <KWSectionHeader title={title} />
      <KWGroupedCard>{children}</KWGroupedCard>
      {footnote ? <p className="px-1 type-caption leading-relaxed text-muted-foreground">{footnote}</p> : null}
    </section>
  )
}

/** A row holding a control: its label (and an optional line under it) with the control on the right. */
export function SettingsRow({ label, description, children, htmlFor }: { label: ReactNode; description?: ReactNode; children?: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="type-body text-foreground">
            {label}
          </label>
        ) : (
          <span className="type-body text-foreground">{label}</span>
        )}
        {description ? <span className="type-caption text-muted-foreground">{description}</span> : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  )
}

/** KWValueRow in its navigation style: tappable, value and chevron on the right. */
export function SettingsLinkRow({ label, value, href, onClick, tone }: { label: ReactNode; value?: ReactNode; href?: string; onClick?: () => void; tone?: "destructive" | "link" }) {
  return <KWValueRow label={label} {...(value !== undefined ? { value } : {})} {...(href ? { href } : {})} {...(onClick ? { onClick } : {})} {...(tone ? { tone } : {})} />
}

/** The inputs that sit inside a grouped card: `surface2` fill, no border, the 12 px input radius. */
export const SETTINGS_INPUT = "h-10 rounded-xl border-0 bg-secondary px-3 type-body shadow-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-secondary"
