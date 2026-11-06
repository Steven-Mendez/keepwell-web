"use client"

import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { Surface } from "@/components/kw/primitives"
import { cn } from "@/lib/utils"

/** A titled group of rows, like iOS SettingsSection + KWGroupedCard. */
export function SettingsSection({ title, footnote, children, className }: { title: ReactNode; footnote?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <h2 className="px-1 type-caption font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      <Surface className="divide-y divide-divider overflow-hidden">{children}</Surface>
      {footnote ? <p className="px-1 type-caption text-muted-foreground">{footnote}</p> : null}
    </section>
  )
}

/** One row: a label (and an optional line under it) with its control or value on the right. */
export function SettingsRow({ label, description, children, htmlFor }: { label: ReactNode; description?: ReactNode; children?: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="type-body">
            {label}
          </label>
        ) : (
          <span className="type-body">{label}</span>
        )}
        {description ? <span className="type-caption text-muted-foreground">{description}</span> : null}
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  )
}

/** A row that navigates or acts, with a trailing value and chevron. */
export function SettingsLinkRow({ label, value, href, onClick, tone }: { label: ReactNode; value?: ReactNode; href?: string; onClick?: () => void; tone?: "destructive" | "link" }) {
  const className = cn(
    "flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left type-body transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none",
    tone === "destructive" && "text-destructive",
    tone === "link" && "text-link",
  )
  const content = (
    <>
      <span>{label}</span>
      <span className="flex items-center gap-1 type-label text-muted-foreground">
        {value}
        {tone ? null : <ChevronRightIcon className="size-4" aria-hidden />}
      </span>
    </>
  )
  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    )
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  )
}
