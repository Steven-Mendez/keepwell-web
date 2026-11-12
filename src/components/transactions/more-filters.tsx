"use client"

import { useState } from "react"

import { AmountInput } from "@/components/accounts/form-parts"
import { KWButton, KWChip, KWSegmented } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  amountRangeError,
  type AmountRange,
  type TransactionOrigin,
} from "@/lib/domain"
import { formatAmountInput, parseAmount } from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"
import type { RecurringRule } from "@/lib/schema"

import { amountChipLabel } from "./filter-params"

/** The amount range and origin together: what the "Filters" sheet edits. */
export interface MoreFilters {
  amount: AmountRange
  origin: TransactionOrigin
}

const boundText = (value: AmountRange["min"]) =>
  value ? (formatAmountInput(value.toFixed()) ?? value.toFixed()) : ""

/** A typed bound: `undefined` when blank, `null` when it isn't an amount. */
function typedBound(text: string) {
  if (text.trim() === "") return undefined
  const value = parseAmount(text)
  return value === undefined || value.lt(0) ? null : value
}

/**
 * bunq's two rows: the amount in the principal currency (minimum and maximum) and the origin (all
 * movements or subscriptions only). "Apply" stays off while the minimum is above the maximum.
 */
function FiltersDialog({
  t,
  value,
  principal,
  second,
  onApply,
  onClose,
}: {
  t: Translator
  value: MoreFilters
  principal: string
  second: string | undefined
  onApply: (filters: MoreFilters) => void
  onClose: () => void
}) {
  const [minText, setMinText] = useState(boundText(value.amount.min))
  const [maxText, setMaxText] = useState(boundText(value.amount.max))
  const [origin, setOrigin] = useState<TransactionOrigin>(value.origin)
  const min = typedBound(minText)
  const max = typedBound(maxText)
  const range: AmountRange = {
    ...(min ? { min } : {}),
    ...(max ? { max } : {}),
  }
  const minAboveMax = amountRangeError(range) === "minAboveMax"
  const canApply = min !== null && max !== null && !minAboveMax

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-5 rounded-2xl bg-card p-6 ring-1 ring-border/60 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="type-heading">
            {t.in("transactions", "Filters")}
          </DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!canApply) return
            onApply({ amount: range, origin })
          }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 type-label text-text-secondary">
              {t.in("transactions", "Amount")}
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="filter-min"
                  className="type-caption text-muted-foreground"
                >
                  {t.in("transactions", "Minimum")}
                </label>
                <AmountInput
                  id="filter-min"
                  value={minText}
                  onChange={setMinText}
                  currency={principal}
                  invalid={min === null || minAboveMax}
                  placeholder=""
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="filter-max"
                  className="type-caption text-muted-foreground"
                >
                  {t.in("transactions", "Maximum")}
                </label>
                <AmountInput
                  id="filter-max"
                  value={maxText}
                  onChange={setMaxText}
                  currency={principal}
                  invalid={max === null || minAboveMax}
                  placeholder=""
                />
              </div>
            </div>
            {minAboveMax ? (
              <p role="alert" className="type-caption text-negative">
                {t.in("transactions", "Minimum is above maximum")}
              </p>
            ) : second && second !== principal ? (
              <p className="type-caption text-muted-foreground">
                {t.in(
                  "transactions",
                  "Converted to %@ at each movement's rate",
                  principal
                )}
              </p>
            ) : null}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 type-label text-text-secondary">
              {t.in("transactions", "Origin")}
            </legend>
            <KWSegmented<TransactionOrigin["kind"]>
              aria-label={t.in("transactions", "Origin")}
              // A rule's list (opened from the rule) selects neither until one is picked.
              value={origin.kind}
              onChange={(kind) =>
                setOrigin(
                  kind === "subscriptions"
                    ? { kind: "subscriptions" }
                    : { kind: "any" }
                )
              }
              options={[
                { value: "any", title: t.in("transactions", "All") },
                {
                  value: "subscriptions",
                  title: t.in("transactions", "Subscriptions only"),
                },
              ]}
            />
          </fieldset>
          <DialogFooter className="-mx-6 -mb-6 gap-2 rounded-b-2xl border-divider bg-transparent px-6 pb-6">
            <KWButton variant="surface" onClick={onClose}>
              {t.in("web", "Cancel")}
            </KWButton>
            <KWButton type="submit" disabled={!canApply}>
              {t.in("transactions", "Apply")}
            </KWButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** An active filter above the list (Origin): filled, its ✕ clears it, a tap reopens the sheet. */
function ActiveChip({
  t,
  label,
  onOpen,
  onClear,
}: {
  t: Translator
  label: string
  onOpen: () => void
  onClear: () => void
}) {
  return (
    <span className="inline-flex h-8 items-center rounded-full bg-primary text-primary-foreground">
      <button
        type="button"
        className="h-full rounded-l-full pr-1 pl-3.5 type-label whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onOpen}
      >
        {label}
      </button>
      <button
        type="button"
        className="flex h-full w-8 items-center justify-center rounded-r-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onClear}
        aria-label={t.in("transactions", "Remove filter %@", label)}
      >
        <KWIcon name="close" size={12} />
      </button>
    </span>
  )
}

/** "Subscriptions", the rule's name, or "Deleted rule" once it's gone. */
function originLabel(
  t: Translator,
  origin: TransactionOrigin,
  rules: readonly RecurringRule[]
): string | undefined {
  switch (origin.kind) {
    case "any":
      return undefined
    case "subscriptions":
      return t.in("transactions", "Subscriptions")
    case "rule":
      return (
        rules.find((rule) => rule.id === origin.id)?.name ??
        t.in("transactions", "Deleted rule")
      )
  }
}

/**
 * The "Filters" chip at the end of the kind chips, the active amount and origin chips after it,
 * and the sheet both open.
 */
export function MoreFiltersChips({
  t,
  value,
  onChange,
  principal,
  second,
  rules,
}: {
  t: Translator
  value: MoreFilters
  onChange: (filters: MoreFilters) => void
  principal: string
  second: string | undefined
  rules: readonly RecurringRule[]
}) {
  const [isOpen, setOpen] = useState(false)
  const amountLabel = amountChipLabel(value.amount, principal)
  const origin = originLabel(t, value.origin, rules)
  return (
    <>
      <KWChip
        selected={false}
        look="outlined"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        {t.in("transactions", "Filters")}
      </KWChip>
      {amountLabel ? (
        <ActiveChip
          t={t}
          label={amountLabel}
          onOpen={() => setOpen(true)}
          onClear={() => onChange({ ...value, amount: {} })}
        />
      ) : null}
      {origin ? (
        <ActiveChip
          t={t}
          label={origin}
          onOpen={() => setOpen(true)}
          onClear={() => onChange({ ...value, origin: { kind: "any" } })}
        />
      ) : null}
      {isOpen ? (
        <FiltersDialog
          t={t}
          value={value}
          principal={principal}
          second={second}
          onApply={(filters) => {
            onChange(filters)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}
