"use client"

import { ArrowLeftRightIcon, BanknoteIcon, CheckIcon, PlusIcon, SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { CategoryBadge } from "@/components/kw/primitives"
import { Input } from "@/components/ui/input"
import { folded, sourceKey, type PaymentSource } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { categoryName } from "@/lib/presentation/display"
import type { Account, TransactionCategory } from "@/lib/schema"
import { isFallbackCategory } from "@/lib/schema"
import { cn } from "@/lib/utils"

import type { MethodGroup, Thumbnail } from "./editor-model"

/** The plastic, banknote or transfer tile that stands for a method (iOS `MethodRow.Thumbnail`). */
export function MethodThumbnail({ thumbnail }: { thumbnail: Thumbnail }) {
  if (thumbnail.kind === "card") {
    const art = thumbnail.color ?? "azul"
    return (
      <span
        className="relative inline-flex h-7 w-11 shrink-0 overflow-hidden rounded-[5px] shadow-depth"
        style={{ backgroundImage: `linear-gradient(135deg, var(--card-art-${art}-from), var(--card-art-${art}-to))` }}
        aria-hidden
      >
        <span className="absolute top-2 left-1.5 h-2 w-2.5 rounded-[2px]" style={{ backgroundImage: "linear-gradient(135deg, var(--card-art-chip-from), var(--card-art-chip-to))" }} />
      </span>
    )
  }
  const Icon = thumbnail.kind === "cash" ? BanknoteIcon : ArrowLeftRightIcon
  return (
    <span className={cn("inline-flex h-7 w-11 shrink-0 items-center justify-center rounded-[5px]", thumbnail.kind === "cash" ? "bg-positive-tint text-positive" : "bg-accent-tint text-link")} aria-hidden>
      <Icon className="size-4" />
    </span>
  )
}

/** A selectable row of a list (method, account): radio semantics inside a `role="radiogroup"`. */
export function ChoiceRow({
  selected,
  onSelect,
  thumbnail,
  title,
  subtitle,
  trailing,
}: {
  selected: boolean
  onSelect: () => void
  thumbnail: Thumbnail
  title: string
  subtitle?: string | undefined
  trailing?: string | undefined
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "bg-accent-tint ring-ring/70" : "ring-transparent hover:bg-accent/60",
      )}
    >
      <MethodThumbnail thumbnail={thumbnail} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-label">{title}</span>
        {subtitle ? <span className="truncate type-caption text-muted-foreground">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="shrink-0 type-caption text-muted-foreground tabular-nums">{trailing}</span> : null}
      <CheckIcon className={cn("size-4 shrink-0 text-link", selected ? "opacity-100" : "opacity-0")} aria-hidden />
    </button>
  )
}

export function MethodPicker({ groups, value, onChange }: { groups: MethodGroup[]; value: PaymentSource | undefined; onChange: (source: PaymentSource) => void }) {
  const selected = value ? sourceKey(value) : undefined
  return (
    <div className="flex flex-col gap-3" role="radiogroup">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <span className="px-1 type-caption-sm text-muted-foreground">{group.title}</span>
          {group.rows.map((row) => (
            <ChoiceRow
              key={sourceKey(row.source)}
              selected={sourceKey(row.source) === selected}
              onSelect={() => onChange(row.source)}
              thumbnail={row.thumbnail}
              title={row.title}
              subtitle={row.subtitle}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function AccountPicker({
  accounts,
  value,
  onChange,
  describe,
}: {
  accounts: Account[]
  value: string | undefined
  onChange: (id: string) => void
  describe: (account: Account) => { title: string; subtitle?: string | undefined; trailing?: string | undefined; thumbnail: Thumbnail }
}) {
  return (
    <div className="flex flex-col gap-1" role="radiogroup">
      {accounts.map((account) => {
        const row = describe(account)
        return <ChoiceRow key={account.id} selected={account.id === value} onSelect={() => onChange(account.id)} {...row} />
      })}
    </div>
  )
}

const COLLAPSED_COUNT = 11

/** Category tiles, the usual ones first, with search and "New category" (iOS CategoryView). */
export function CategoryPicker({
  categories,
  usage,
  value,
  onChange,
  onCreate,
}: {
  categories: TransactionCategory[]
  usage: Map<string, number>
  value: string | undefined
  onChange: (id: string) => void
  onCreate: () => void
}) {
  const t = useT()
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState(false)
  const ordered = useMemo(() => {
    const ranked = categories
      .map((category, index) => ({ category, index, used: usage.get(category.id) ?? 0 }))
      .sort((a, b) => {
        // The catch-all "Other" stays last so it never hides the person's own.
        const fallback = Number(isFallbackCategory(a.category.id)) - Number(isFallbackCategory(b.category.id))
        if (fallback !== 0) return fallback
        return a.used === b.used ? a.index - b.index : b.used - a.used
      })
      .map((entry) => entry.category)
    const needle = folded(query.trim())
    return needle === "" ? ranked : ranked.filter((category) => folded(categoryName(t, category)).includes(needle) || folded(category.name).includes(needle))
  }, [categories, usage, query, t])
  const searching = query.trim() !== ""
  const limit = searching || expanded ? ordered.length : COLLAPSED_COUNT
  // The chosen one always stays in view, even past the fold.
  const visible = ordered.slice(0, limit)
  const chosen = ordered.find((category) => category.id === value)
  if (chosen && !visible.includes(chosen)) visible[visible.length - 1] = chosen

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.in("createtransaction", "Search category")} className="h-9 pl-8" data-editor-category-search />
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label={t.in("createtransaction", "Category")}>
        {visible.map((category) => {
          const selected = category.id === value
          return (
            <button
              key={category.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(category.id)}
              className={cn(
                "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 text-center ring-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "bg-accent-tint ring-ring/70" : "bg-secondary/40 ring-transparent hover:bg-accent/70",
              )}
            >
              <CategoryBadge category={category} size="sm" />
              <span className="line-clamp-2 type-caption-sm leading-tight">{categoryName(t, category)}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={onCreate}
          className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-1.5 py-2 text-center text-muted-foreground transition-colors outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-secondary">
            <PlusIcon className="size-4" aria-hidden />
          </span>
          <span className="type-caption-sm leading-tight">{t.in("createtransaction", "New category")}</span>
        </button>
      </div>
      {!searching && ordered.length > COLLAPSED_COUNT ? (
        <button type="button" onClick={() => setExpanded((open) => !open)} className="self-start px-1 type-label text-link hover:text-link-hover">
          {expanded ? t.in("web", "Show fewer") : t.in("createtransaction", "See all %lld", ordered.length)}
        </button>
      ) : null}
    </div>
  )
}
