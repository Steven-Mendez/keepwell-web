import {
  TRANSACTION_FILTERS,
  dec,
  decimalText,
  type AmountRange,
  type TransactionFilter,
  type TransactionOrigin,
  type TransactionScope,
} from "@/lib/domain"
import { formatAmount, formatNumber } from "@/lib/domain/format"
import type { Decimal } from "@/lib/domain"

/** The list's filters that live in the URL: `filter`, `account`, `min`, `max`, `origin` and `rule`. */
export interface ListFilters {
  filter: TransactionFilter
  scope: TransactionScope
  amount: AmountRange
  origin: TransactionOrigin
}

export const NO_FILTERS: ListFilters = {
  filter: "all",
  scope: { kind: "all" },
  amount: {},
  origin: { kind: "any" },
}

const DECIMAL = /^[0-9]+(\.[0-9]+)?$/

function readBound(params: URLSearchParams, name: string): Decimal | undefined {
  const text = params.get(name)
  return text && DECIMAL.test(text) ? dec(text) : undefined
}

/** The filters a link carries; anything it leaves out, or writes wrong, is the default. */
export function readFilterParams(params: URLSearchParams): ListFilters {
  const requested = params.get("filter")
  const filter =
    requested && (TRANSACTION_FILTERS as readonly string[]).includes(requested)
      ? (requested as TransactionFilter)
      : "all"
  const account = params.get("account")
  const min = readBound(params, "min")
  const max = readBound(params, "max")
  const rule = params.get("rule")
  const origin: TransactionOrigin = rule
    ? { kind: "rule", id: rule }
    : params.get("origin") === "subscriptions"
      ? { kind: "subscriptions" }
      : { kind: "any" }
  return {
    filter,
    scope: account ? { kind: "account", id: account } : { kind: "all" },
    amount: { ...(min ? { min } : {}), ...(max ? { max } : {}) },
    origin,
  }
}

/** `params` with the filters written in, leaving any other parameter in place. */
export function writeFilterParams(
  params: URLSearchParams,
  filters: ListFilters
): URLSearchParams {
  const next = new URLSearchParams(params)
  const set = (name: string, value: string | undefined) => {
    if (value === undefined) next.delete(name)
    else next.set(name, value)
  }
  set("filter", filters.filter === "all" ? undefined : filters.filter)
  set("account", filters.scope.kind === "account" ? filters.scope.id : undefined)
  set("min", filters.amount.min ? decimalText(filters.amount.min) : undefined)
  set("max", filters.amount.max ? decimalText(filters.amount.max) : undefined)
  set("origin", filters.origin.kind === "subscriptions" ? "subscriptions" : undefined)
  set("rule", filters.origin.kind === "rule" ? filters.origin.id : undefined)
  return next
}

/** Whole amounts without cents ("C$100"), others with them ("C$99.50"); `digits` forces either. */
function bound(value: Decimal, currency?: string, digits = value.isInteger() ? 0 : 2): string {
  return currency
    ? formatAmount(value, currency, { fractionDigits: digits })
    : formatNumber(value, digits)
}

/**
 * The active amount chip: "≥ C$100", "≤ C$500" or "C$100 – 500"; `undefined` without bounds. Both
 * ends of a range read alike: with cents on both ("C$8.50 – 15.00") when either has them.
 */
export function amountChipLabel(
  range: AmountRange,
  currency: string
): string | undefined {
  if (range.min && range.max) {
    const digits = range.min.isInteger() && range.max.isInteger() ? 0 : 2
    return `${bound(range.min, currency, digits)} – ${bound(range.max, undefined, digits)}`
  }
  if (range.min) return `≥ ${bound(range.min, currency)}`
  if (range.max) return `≤ ${bound(range.max, currency)}`
  return undefined
}
