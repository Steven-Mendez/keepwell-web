"use client"

import { useMemo } from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { COMMON_CURRENCIES } from "./currencies"

// Pickers on shadcn's Select and Combobox, so every choice in the app opens the same themed popup
// instead of the browser's native list.

export interface Option<T extends string> {
  value: T
  label: string
}

/** A short list (network, month, account): shadcn Select with the chosen label in the trigger. */
export function OptionSelect<T extends string>({
  id,
  value,
  options,
  onChange,
  placeholder,
  className,
  disabled,
  "aria-label": ariaLabel,
}: {
  id?: string
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  "aria-label"?: string
}) {
  return (
    <Select<T>
      items={options}
      value={value}
      onValueChange={(next) => next !== null && onChange(next)}
      {...(disabled ? { disabled } : {})}
    >
      <SelectTrigger
        id={id}
        className={cn("h-10 w-full", className)}
        {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
      >
        <SelectValue {...(placeholder ? { placeholder } : {})} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const ALL_CURRENCIES: readonly string[] =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("currency")
    : COMMON_CURRENCIES

function currencyDisplayName(locale: string, code: string): string {
  try {
    return new Intl.DisplayNames(locale, { type: "currency" }).of(code) ?? code
  } catch {
    return code
  }
}

/**
 * Any ISO 4217 currency, searchable by code or name (iOS "Search currency"), common ones first.
 * `only` limits the choice (an account in one of the person's two currencies).
 */
export function CurrencyPicker({
  id,
  value,
  onChange,
  exclude,
  only,
  className,
  disabled,
}: {
  id?: string
  /** `undefined` shows the search placeholder with nothing chosen. */
  value: string | undefined
  onChange: (code: string) => void
  exclude?: string | undefined
  only?: readonly string[]
  className?: string
  disabled?: boolean
}) {
  const t = useT()
  const items = useMemo(() => {
    const codes = only ?? [
      ...COMMON_CURRENCIES,
      ...ALL_CURRENCIES.filter((code) => !COMMON_CURRENCIES.includes(code)),
    ]
    return codes
      .filter((code) => code !== exclude)
      .map((code) => ({
        value: code,
        label: `${code} · ${currencyDisplayName(t.locale, code)}`,
      }))
  }, [t.locale, exclude, only])
  const selected =
    value === undefined
      ? null
      : (items.find((item) => item.value === value) ?? {
          value,
          label: `${value} · ${currencyDisplayName(t.locale, value)}`,
        })

  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(item) => item && onChange(item.value)}
      isItemEqualToValue={(a, b) => a.value === b.value}
      {...(disabled ? { disabled } : {})}
    >
      <ComboboxInput
        id={id}
        placeholder={t.in("onboarding", "Search currency")}
        className={cn("h-10 w-full", className)}
        disabled={disabled ?? false}
      />
      <ComboboxContent>
        <ComboboxEmpty>{t.in("web", "No results.")}</ComboboxEmpty>
        <ComboboxList>
          {(item: { value: string; label: string }) => (
            <ComboboxItem key={item.value} value={item}>
              <span className="w-10 font-semibold tabular-nums">
                {item.value}
              </span>
              <span className="truncate text-muted-foreground">
                {item.label.slice(item.value.length + 3)}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
