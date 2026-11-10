"use client"

import { useMemo, useState } from "react"

import { KWIcon, KWMiniCard } from "@/components/kw/kw-icon"
import { CategoryBadge } from "@/components/kw/primitives"
import { folded, sourceKey, type PaymentSource } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { categoryName } from "@/lib/presentation/display"
import type { Account, TransactionCategory } from "@/lib/schema"
import { isFallbackCategory } from "@/lib/schema"
import { cn } from "@/lib/utils"

import type { MethodGroup, Thumbnail } from "./editor-model"
import { RadioMark } from "./flow-parts"

/** The plastic, banknote or transfer tile that stands for a method (iOS `MethodRow` thumbnail, KWMiniCard). */
export function MethodThumbnail({ thumbnail }: { thumbnail: Thumbnail }) {
  if (thumbnail.kind === "card") return <KWMiniCard color={thumbnail.color} />
  return <KWMiniCard kind={thumbnail.kind === "cash" ? "cash" : "transfer"} />
}

/**
 * A selectable row (method, account), like the iOS flow rows: on the `surface` card, title 15/600,
 * muted subtitle, the green check on the chosen one. Radio semantics inside a `radiogroup`.
 */
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
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50"
    >
      <MethodThumbnail thumbnail={thumbnail} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-body font-semibold text-foreground">{title}</span>
        {subtitle ? <span className="truncate type-caption-sm text-muted-foreground">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="shrink-0 type-caption text-muted-foreground tabular-nums">{trailing}</span> : null}
      <RadioMark selected={selected} />
    </button>
  )
}

const GROUP = "flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card"

export function MethodPicker({ groups, value, onChange }: { groups: MethodGroup[]; value: PaymentSource | undefined; onChange: (source: PaymentSource) => void }) {
  const selected = value ? sourceKey(value) : undefined
  return (
    <div className="flex flex-col gap-4" role="radiogroup">
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-2">
          <span className="type-caption font-semibold text-muted-foreground">{group.title}</span>
          <div className={GROUP}>
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
    <div className={GROUP} role="radiogroup">
      {accounts.map((account) => {
        const row = describe(account)
        return <ChoiceRow key={account.id} selected={account.id === value} onSelect={() => onChange(account.id)} {...row} />
      })}
    </div>
  )
}

const COLLAPSED_COUNT = 11

/**
 * Category tiles (iOS CategoryView): 96 px tiles on `surface`, the chosen one white with black
 * text, "New category" dashed; search in a `surface` capsule; the usual ones first.
 */
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
    <div className="flex flex-col gap-3">
      <label className="flex h-10 items-center gap-2 rounded-full bg-card px-4 text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
        <KWIcon name="search" size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.in("createtransaction", "Search category")}
          className="min-w-0 flex-1 bg-transparent type-body text-foreground outline-none placeholder:text-muted-foreground"
          data-editor-category-search
        />
      </label>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t.in("createtransaction", "Category")}>
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
                "flex h-24 flex-col items-center justify-center gap-2 rounded-[18px] px-2 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-secondary",
              )}
            >
              <CategoryBadge category={category} size="sm" />
              <span className={cn("line-clamp-2 type-caption leading-tight", selected ? "font-bold" : "font-semibold")}>{categoryName(t, category)}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={onCreate}
          className="flex h-24 flex-col items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-control-off px-2 text-center text-muted-foreground transition-colors outline-none hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-secondary">
            <KWIcon name="plus" size={16} strokeWidth={2.2} />
          </span>
          <span className="type-caption font-semibold leading-tight">{t.in("createtransaction", "New category")}</span>
        </button>
      </div>
      {!searching && ordered.length > COLLAPSED_COUNT ? (
        <button type="button" onClick={() => setExpanded((open) => !open)} className="self-start type-label text-link transition-colors hover:text-link-hover">
          {expanded ? t.in("web", "Show fewer") : t.in("createtransaction", "See all %lld", ordered.length)}
        </button>
      ) : null}
    </div>
  )
}
