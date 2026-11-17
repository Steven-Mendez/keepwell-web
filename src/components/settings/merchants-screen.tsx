"use client"

import Link from "next/link"
import { useState } from "react"

import { BrandMark } from "@/components/kw/brand-mark"
import { KWEmptyState, KWGroupedCard, KWLargeTitleHeader } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { Page } from "@/components/kw/primitives"
import { CategoriesSkeleton } from "@/components/kw/skeletons"
import { useLedger, useMerchants } from "@/hooks/use-ledger"
import { useT, type Translator } from "@/lib/i18n"
import { categoryColor, categoryName } from "@/lib/presentation/display"
import { brandMonogram } from "@/lib/presentation/brands"
import { merchantLogo } from "@/lib/presentation/merchants"
import type { Merchant, TransactionCategory } from "@/lib/schema"

import { MerchantEditorDialog } from "./merchant-editor-dialog"

/** "Restaurants · Platform · 12 movements" under a merchant. */
function merchantDetail(t: Translator, merchant: Merchant, category: TransactionCategory | undefined, count: number): string {
  return [
    category ? categoryName(t, category) : undefined,
    merchant.isPlatform ? t.in("web", "Platform") : undefined,
    t.in("web", "sync.count.movements", count),
  ]
    .filter(Boolean)
    .join(" · ")
}

/**
 * Settings › Businesses: the person's merchants (the businesses movements were with and the
 * platforms they went through), with what each is used for. One opens to rename it, set its default
 * category, mark it as a platform, merge it into another or delete it.
 */
export function MerchantsScreen() {
  const t = useT()
  const ledger = useLedger()
  const merchants = useMerchants()
  const [editing, setEditing] = useState<Merchant>()

  const usage = new Map<string, number>()
  for (const movement of ledger?.transactions ?? []) {
    for (const id of new Set([movement.merchantId, movement.viaMerchantId])) {
      if (id !== undefined) usage.set(id, (usage.get(id) ?? 0) + 1)
    }
  }

  return (
    <Page>
      <Link
        href="/settings"
        className="-mb-2 inline-flex w-fit items-center gap-1 rounded-md type-label text-link outline-none hover:text-link-hover focus-visible:ring-2 focus-visible:ring-ring"
      >
        <KWIcon name="chevronLeft" size={16} />
        {t.in("settings", "Settings")}
      </Link>
      <KWLargeTitleHeader title={t.in("web", "Businesses")} />

      {!ledger || !merchants ? (
        <CategoriesSkeleton />
      ) : merchants.length === 0 ? (
        <div className="rounded-2xl bg-card">
          <KWEmptyState
            icon="cart"
            title={t.in("web", "No businesses yet")}
            message={t.in("web", "Pick a business when you log a movement and it shows here, with its logo when it has one.")}
          />
        </div>
      ) : (
        <KWGroupedCard>
          <ul className="flex flex-col divide-y divide-divider">
            {merchants.map((merchant) => {
              const category = ledger.categories.find((candidate) => candidate.id === merchant.defaultCategoryId)
              const logo = merchantLogo(merchant)
              return (
                <li key={merchant.id} className="flex min-h-14 items-center px-2">
                  <button
                    type="button"
                    onClick={() => setEditing(merchant)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50"
                  >
                    {logo ? (
                      <BrandMark brand={logo} color={categoryColor(category)} />
                    ) : (
                      <span
                        aria-hidden
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full type-body font-bold"
                        style={{ color: categoryColor(category), backgroundColor: `color-mix(in srgb, ${categoryColor(category)} 16%, transparent)` }}
                      >
                        {brandMonogram(merchant)}
                      </span>
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate type-body text-foreground">{merchant.name}</span>
                      <span className="truncate type-caption text-muted-foreground">
                        {merchantDetail(t, merchant, category, usage.get(merchant.id) ?? 0)}
                      </span>
                    </span>
                    <KWIcon name="chevronRight" size={16} className="shrink-0 text-text-faint" />
                  </button>
                </li>
              )
            })}
          </ul>
        </KWGroupedCard>
      )}

      <p className="type-caption text-muted-foreground">
        {t.in("web", "A business's default category is suggested when you log a new movement with it.")}
      </p>

      {editing && ledger && merchants ? (
        <MerchantEditorDialog
          key={editing.id}
          t={t}
          merchant={editing}
          merchants={merchants}
          categories={ledger.categories}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
    </Page>
  )
}
