"use client"

import type { ComponentProps, RefObject } from "react"

import { KWChip } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { OptionSelect } from "@/components/kw/pickers"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import {
  TRANSACTION_FILTERS,
  scopeOptions,
  type TransactionFilter,
  type TransactionScope,
} from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { accountName, cardShortName } from "@/lib/presentation/display"

import { MoreFiltersChips } from "./more-filters"

function filterLabel(t: Translator, filter: TransactionFilter): string {
  const keys: Record<TransactionFilter, string> = {
    all: "All",
    expense: "Expenses",
    income: "Income",
    transfer: "Transfers",
    planned: "Drafts",
  }
  return t.in("transactions", keys[filter])
}

/** Search over description, note, category and method; Escape clears it and leaves the field. */
function SearchField({
  t,
  search,
  text,
  onTextChange,
}: {
  t: Translator
  search: RefObject<HTMLInputElement | null>
  text: string
  onTextChange: (text: string) => void
}) {
  return (
    <InputGroup className="rounded-full border-transparent bg-card lg:max-w-md">
      <InputGroupAddon className="pl-3.5 text-muted-foreground">
        <KWIcon name="search" size={18} />
      </InputGroupAddon>
      <InputGroupInput
        ref={search}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onTextChange("")
            event.currentTarget.blur()
          }
        }}
        placeholder={t.in("transactions", "Search merchant, note, category or #tag")}
        aria-label={t.in("transactions", "Search")}
      />
      <InputGroupAddon align="inline-end">
        {text ? (
          <button
            type="button"
            className="mr-1 flex size-8 items-center justify-center rounded-full bg-secondary text-text-secondary hover:text-foreground"
            onClick={() => onTextChange("")}
            aria-label={t.in("transactions", "Clear search")}
          >
            <KWIcon name="close" size={14} />
          </button>
        ) : (
          <Kbd className="mr-1.5">/</Kbd>
        )}
      </InputGroupAddon>
    </InputGroup>
  )
}

/** One account (a credit account with its card's short name) or all of them. */
function AccountSelect({
  t,
  options,
  scope,
  onScopeChange,
}: {
  t: Translator
  options: ReturnType<typeof scopeOptions>
  scope: TransactionScope
  onScopeChange: (scope: TransactionScope) => void
}) {
  return (
    <OptionSelect
      className="rounded-full border-transparent bg-card lg:w-72"
      value={scope.kind === "all" ? "" : scope.id}
      onChange={(value) =>
        onScopeChange(value ? { kind: "account", id: value } : { kind: "all" })
      }
      aria-label={t.in("transactions", "Show movements from")}
      options={[
        { value: "", label: t.in("transactions", "All accounts") },
        ...options.map(({ account, card }) => ({
          value: account.id,
          // Closed accounts come last (`scopeOptions`), marked, so their history stays reachable.
          label: [
            card && account.kind === "credit"
              ? `${accountName(account)} · ${cardShortName(t, card)}`
              : accountName(account),
            ...(account.closedAt ? [t.in("sharedpresentation", "Closed")] : []),
          ].join(" · "),
        })),
      ]}
    />
  )
}

/**
 * The search, the account picker, the kind chips and, after them, "Filters" with the active amount
 * and origin chips, above the list.
 */
export function TransactionFilters({
  t,
  search,
  text,
  onTextChange,
  options,
  scope,
  onScopeChange,
  filter,
  onFilterChange,
  more,
}: {
  t: Translator
  search: RefObject<HTMLInputElement | null>
  text: string
  onTextChange: (text: string) => void
  options: ReturnType<typeof scopeOptions>
  scope: TransactionScope
  onScopeChange: (scope: TransactionScope) => void
  filter: TransactionFilter
  onFilterChange: (filter: TransactionFilter) => void
  /** The amount range and origin, with what the "Filters" sheet needs to edit them. */
  more: Omit<ComponentProps<typeof MoreFiltersChips>, "t">
}) {
  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchField
          t={t}
          search={search}
          text={text}
          onTextChange={onTextChange}
        />
        <AccountSelect
          t={t}
          options={options}
          scope={scope}
          onScopeChange={onScopeChange}
        />
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t.in("transactions", "Transactions")}
      >
        {TRANSACTION_FILTERS.map((option) => (
          <KWChip
            key={option}
            pillId="transactions-filter"
            selected={filter === option}
            onClick={() => onFilterChange(option)}
          >
            {filterLabel(t, option)}
          </KWChip>
        ))}
        <MoreFiltersChips t={t} {...more} />
      </div>
    </>
  )
}
