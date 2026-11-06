"use client"

import { useSyncExternalStore, type ReactNode } from "react"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { DomainError, currencySymbol, formatAmountInput } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import type { CardColor, CardNetwork } from "@/lib/schema"
import { cardColorName } from "@/lib/presentation/display"
import { cn } from "@/lib/utils"

// Small form pieces the account dialogs share: labeled fields, a segmented picker, the card color
// swatches and the iOS error texts for domain failures.

export function LabeledField({ id, label, description, error, children }: { id: string; label: ReactNode; description?: ReactNode; error?: string | undefined; children: ReactNode }) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {error ? (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      ) : description ? (
        <FieldDescription>{description}</FieldDescription>
      ) : null}
    </Field>
  )
}

/** An amount field with the currency symbol in front; formats "10000" to "10,000.00" on blur. */
export function AmountInput({ id, value, onChange, currency, invalid, autoFocus }: { id: string; value: string; onChange: (value: string) => void; currency: string; invalid?: boolean; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-label text-muted-foreground">{currencySymbol(currency).trim()}</span>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className="h-10 pl-12 text-right tabular-nums"
        value={value}
        aria-invalid={invalid || undefined}
        autoFocus={autoFocus}
        placeholder="0.00"
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          const formatted = formatAmountInput(value)
          if (formatted) onChange(formatted)
        }}
      />
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (value: T) => void; options: readonly { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full flex-wrap gap-1 rounded-lg bg-secondary/70 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-w-0 flex-1 rounded-md px-3 py-1.5 text-label transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            option.value === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function ColorSwatches({ t, value, onChange, colors }: { t: Translator; value: CardColor | undefined; onChange: (color: CardColor) => void; colors: readonly CardColor[] }) {
  return (
    <div role="radiogroup" aria-label={t.in("accounts", "Card color")} className="flex flex-wrap gap-2">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === value}
          aria-label={cardColorName(t, color)}
          title={cardColorName(t, color)}
          onClick={() => onChange(color)}
          className={cn("size-9 rounded-full ring-offset-2 ring-offset-popover transition outline-none focus-visible:ring-2 focus-visible:ring-ring", color === value ? "ring-2 ring-foreground" : "ring-1 ring-border")}
          style={{ backgroundImage: `linear-gradient(135deg, var(--card-art-${color}-from), var(--card-art-${color}-to))` }}
        />
      ))}
    </div>
  )
}

export const NETWORKS: readonly CardNetwork[] = ["visa", "mastercard", "amex", "other"]

/** Keeps only digits, at most four. */
export const digitsOnly = (text: string) => text.replace(/\D/g, "").slice(0, 4)

/** iOS texts for the domain failures a form can hit. */
export function domainErrorText(t: Translator, error: unknown, fallback: string): string {
  if (error instanceof DomainError) {
    switch (error.code) {
      case "invalidLastFour":
        return t.in("onboarding", "Enter all 4 digits or leave it empty.")
      case "missingName":
        return t.in("accounts", "Write a name for the account.")
      case "invalidAmount":
        return t.in("addcard", "Check the balance.")
      case "invalidExpiry":
        return t.in("sharedpresentation", "Choose both the month and the year.")
      default:
        return fallback
    }
  }
  return fallback
}

/** Whether the viewport matches `query`; `false` while rendering on the server. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", onChange)
      return () => list.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
