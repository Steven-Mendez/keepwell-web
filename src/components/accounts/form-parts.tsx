"use client"

import { useSyncExternalStore, type ReactNode } from "react"

import { KWSegmented } from "@/components/kw/design"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { currencySymbol, formatAmountInput } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import type { CardColor } from "@/lib/schema"
import { cardColorName } from "@/lib/presentation/display"
import { cn } from "@/lib/utils"

// Small form pieces the account dialogs share: labeled fields, a segmented picker, the card color
// swatches and the iOS error texts for domain failures. Fields follow the iOS forms: muted label,
// a `surface2` box with the 12 px input radius, errors in the soft negative color.

/** The iOS text field box: `surface2` fill, no border, 12 px radius, focus ring on desktop. */
export const KW_INPUT =
  "h-10 rounded-xl border-transparent bg-secondary px-3 type-body shadow-none placeholder:text-text-faint focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-ring/60 dark:bg-secondary aria-invalid:ring-2 aria-invalid:ring-negative/60"

export function LabeledField({
  id,
  label,
  description,
  error,
  children,
}: {
  id: string
  label: ReactNode
  description?: ReactNode
  error?: string | undefined
  children: ReactNode
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id} className="type-label text-text-secondary">
        {label}
      </FieldLabel>
      {children}
      {error ? (
        <p role="alert" className="type-caption text-negative">
          {error}
        </p>
      ) : description ? (
        <FieldDescription className="type-caption text-muted-foreground">
          {description}
        </FieldDescription>
      ) : null}
    </Field>
  )
}

/** An amount field with the currency symbol in front; formats "10000" to "10,000.00" on blur. */
export function AmountInput({
  id,
  value,
  onChange,
  currency,
  invalid,
  autoFocus,
  placeholder = "0.00",
}: {
  id: string
  value: string
  onChange: (value: string) => void
  currency: string
  invalid?: boolean
  autoFocus?: boolean
  placeholder?: string
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 type-label text-muted-foreground">
        {currencySymbol(currency).trim()}
      </span>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className={cn(KW_INPUT, "pl-12 text-right tabular-nums")}
        value={value}
        aria-invalid={invalid || undefined}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          const formatted = formatAmountInput(value)
          if (formatted) onChange(formatted)
        }}
      />
    </div>
  )
}

/** KWSegmentedControl (large) with the iOS choice labels. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: readonly { value: T; label: string }[]
  label: string
}) {
  return (
    <KWSegmented
      aria-label={label}
      value={value}
      onChange={onChange}
      options={options.map((option) => ({
        value: option.value,
        title: option.label,
      }))}
    />
  )
}

export function ColorSwatches({
  t,
  value,
  onChange,
  colors,
}: {
  t: Translator
  value: CardColor | undefined
  onChange: (color: CardColor) => void
  colors: readonly CardColor[]
}) {
  return (
    <div
      role="radiogroup"
      aria-label={t.in("accounts", "Card color")}
      className="flex flex-wrap gap-2"
    >
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={color === value}
          aria-label={cardColorName(t, color)}
          title={cardColorName(t, color)}
          onClick={() => onChange(color)}
          className={cn(
            "size-8 rounded-full ring-offset-2 ring-offset-card transition outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring",
            color === value ? "ring-2 ring-white" : "ring-1 ring-white/10"
          )}
          style={{
            backgroundImage: `linear-gradient(135deg, var(--card-art-${color}-from), var(--card-art-${color}-to))`,
          }}
        />
      ))}
    </div>
  )
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
    () => false
  )
}
