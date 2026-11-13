"use client"

import { useEffect, useMemo, useState } from "react"

import { BrandMark } from "@/components/kw/brand-mark"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { useT } from "@/lib/i18n"
import {
  BRAND_SEARCH_DEBOUNCE_MS,
  searchBrands,
  type BrandSearchResult,
} from "@/lib/presentation/brand-search"
import { categoryColor } from "@/lib/presentation/display"
import {
  choiceLogo,
  choiceName,
  sameChoice,
  type MerchantChoice,
} from "@/lib/presentation/merchants"
import type { Merchant } from "@/lib/schema"
import { cn } from "@/lib/utils"

import { merchantOptions, needsBrandSearch, type MerchantOption } from "./merchant-state"

/** A stable key for a choice, so the field starts over when its value changes from outside. */
export function choiceKey(choice: MerchantChoice | undefined): string {
  if (!choice) return "none"
  return choice.type === "merchant" ? `m:${choice.id}` : `n:${choice.draft.brandId ?? ""}:${choice.draft.domain ?? ""}:${choice.draft.name}`
}

/**
 * "Business" or "Via": a combobox over the person's merchants, the app's brand table and, when
 * neither has what is typed, Brandfetch's brand search (debounced, straight from the browser). A
 * found brand or a typed name is only created as a merchant when the movement is saved.
 * Render it with `key={choiceKey(value)}` so a suggestion made elsewhere shows in the input.
 */
export function MerchantField({
  id,
  value,
  merchants,
  role = "business",
  excludeId,
  placeholder,
  onChange,
  className,
}: {
  id: string
  value: MerchantChoice | undefined
  merchants: readonly Merchant[]
  role?: "business" | "via"
  /** The business itself, never offered as its own platform. */
  excludeId?: string | undefined
  placeholder: string
  onChange: (choice: MerchantChoice | undefined) => void
  className?: string
}) {
  const t = useT()
  const [query, setQuery] = useState("")
  const [remote, setRemote] = useState<{ query: string; results: BrandSearchResult[] }>()
  const local = useMemo(() => merchantOptions(query, merchants, [], role, excludeId), [query, merchants, role, excludeId])
  const wantsRemote = needsBrandSearch(query, local)

  useEffect(() => {
    if (!wantsRemote) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void searchBrands(query, controller.signal).then((results) => {
        if (!controller.signal.aborted) setRemote({ query, results })
      })
    }, BRAND_SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [wantsRemote, query])

  const options = wantsRemote && remote?.query === query ? merchantOptions(query, merchants, remote.results, role, excludeId) : local
  const label = choiceName(value, merchants)
  const selected: MerchantOption | null =
    value && label !== undefined ? { key: choiceKey(value), label, group: "mine", choice: value, logo: choiceLogo(value, merchants) } : null

  return (
    <Combobox<MerchantOption>
      items={options}
      filter={null}
      value={selected}
      defaultInputValue={label ?? ""}
      onInputValueChange={(text) => setQuery(text === label ? "" : text)}
      onValueChange={(option) => onChange(option?.choice)}
      itemToStringLabel={(option) => option.label}
      isItemEqualToValue={(a, b) => sameChoice(a.choice, b.choice)}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        autoComplete="off"
        showTrigger={false}
        showClear={value !== undefined}
        className={cn("h-10 w-full", className)}
      />
      <ComboboxContent>
        <ComboboxEmpty>{t.in("web", "Type a name to add a business.")}</ComboboxEmpty>
        <ComboboxList>
          {(option: MerchantOption) => (
            <ComboboxItem key={option.key} value={option} className="gap-2.5 py-1.5">
              {option.logo ? (
                <BrandMark brand={option.logo} color={categoryColor(undefined)} size="sm" className="size-6" />
              ) : (
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary type-caption-sm text-text-secondary" aria-hidden>
                  {option.group === "new" ? "+" : [...option.label][0]?.toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">
                {option.group === "new" ? t.in("web", "Add “%@”", option.label) : option.label}
              </span>
              {option.detail ? <span className="shrink-0 truncate type-caption-sm text-muted-foreground">{option.detail}</span> : null}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
