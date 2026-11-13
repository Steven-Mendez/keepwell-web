"use client"

import { useState } from "react"

import { KWButton } from "@/components/kw/design"
import { KWSwitch } from "@/components/movement-editor/flow-parts"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  deleteMerchant,
  mergeMerchants,
  orderedCategories,
  saveMerchant,
} from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { categoryName } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"
import {
  MAX_MERCHANT_NAME_LENGTH,
  type Merchant,
  type TransactionCategory,
} from "@/lib/schema"

import { ConfirmDialog } from "./confirm-dialog"
import { SETTINGS_INPUT } from "./settings-rows"

/**
 * One merchant: its name, the category it suggests for new movements and whether it is a platform
 * (offered first in "Via"). It can be merged into another (everything that named it names the other)
 * or deleted (movements keep everything else and name no business).
 */
export function MerchantEditorDialog({
  t,
  merchant,
  merchants,
  categories,
  onClose,
}: {
  t: Translator
  merchant: Merchant
  merchants: readonly Merchant[]
  categories: readonly TransactionCategory[]
  onClose: () => void
}) {
  const [name, setName] = useState(merchant.name)
  const [categoryId, setCategoryId] = useState(merchant.defaultCategoryId ?? "")
  const [isPlatform, setPlatform] = useState(merchant.isPlatform)
  const [mergeInto, setMergeInto] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [confirm, setConfirm] = useState<"delete" | "merge">()

  const ordered = orderedCategories([...categories])
  const groups = [
    { label: t.in("settings", "Expenses"), options: ordered.filter((category) => category.kind === "expense") },
    { label: t.in("settings", "Income"), options: ordered.filter((category) => category.kind === "income") },
  ]
  const others = merchants.filter((candidate) => candidate.id !== merchant.id)
  const target = others.find((candidate) => candidate.id === mergeInto)
  const canSave = name.trim() !== "" && !saving

  async function run(work: () => Promise<unknown>, failure: string) {
    setSaving(true)
    setError(undefined)
    try {
      await work()
      onClose()
    } catch {
      setError(failure)
    } finally {
      setSaving(false)
    }
  }

  const save = () =>
    run(
      () =>
        saveMerchant(ledgerStore, {
          id: merchant.id,
          name,
          ...(merchant.domain ? { domain: merchant.domain } : {}),
          ...(merchant.brandId ? { brandId: merchant.brandId } : {}),
          ...(categoryId ? { defaultCategoryId: categoryId } : {}),
          isPlatform,
        }),
      t.in("web", "We couldn't save the business. Try again.")
    )

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90svh] gap-5 overflow-y-auto rounded-2xl bg-card p-6 ring-1 ring-border/60 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="type-heading">{t.in("web", "Edit business")}</DialogTitle>
          </DialogHeader>
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault()
              if (canSave) void save()
            }}
          >
            <label className="flex flex-col gap-1.5">
              <span className="type-label text-text-secondary">{t.in("web", "Name")}</span>
              <Input
                className={SETTINGS_INPUT}
                value={name}
                maxLength={MAX_MERCHANT_NAME_LENGTH}
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
              />
              {merchant.domain ? <span className="type-caption text-muted-foreground">{merchant.domain}</span> : null}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="type-label text-text-secondary">{t.in("web", "Default category")}</span>
              <select className={SETTINGS_INPUT} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">{t.in("web", "None")}</option>
                {groups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((category) => (
                      <option key={category.id} value={category.id}>
                        {categoryName(t, category)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="type-caption text-muted-foreground">
                {t.in("web", "Suggested when you log a new movement with this business.")}
              </span>
            </label>
            <div className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="type-body text-foreground">{t.in("web", "Platform")}</span>
                <span className="type-caption text-muted-foreground">
                  {t.in("web", "Delivery apps and app stores: offered first in “Via”.")}
                </span>
              </span>
              <KWSwitch checked={isPlatform} onChange={setPlatform} label={t.in("web", "Platform")} />
            </div>
            {others.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className="type-label text-text-secondary">{t.in("web", "Merge into")}</span>
                <div className="flex gap-2">
                  <select
                    className={`${SETTINGS_INPUT} min-w-0 flex-1`}
                    value={mergeInto}
                    aria-label={t.in("web", "Merge into")}
                    onChange={(event) => setMergeInto(event.target.value)}
                  >
                    <option value="">{t.in("settings", "Choose")}</option>
                    {others.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                  <KWButton variant="surface" disabled={!target || saving} onClick={() => setConfirm("merge")}>
                    {t.in("web", "Merge")}
                  </KWButton>
                </div>
              </div>
            ) : null}
            {error ? <p className="type-caption text-negative">{error}</p> : null}
            <DialogFooter className="-mx-6 -mb-6 gap-2 rounded-b-2xl border-divider bg-transparent px-6 pb-6 sm:justify-between">
              <KWButton
                variant="destructive"
                icon="trash"
                className="bg-negative-tint"
                disabled={saving}
                onClick={() => setConfirm("delete")}
              >
                {t.in("web", "Delete business")}
              </KWButton>
              <KWButton type="submit" disabled={!canSave}>
                {t.in("settings", "Save")}
              </KWButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(undefined)}
        title={t.in("web", "Delete %@?", merchant.name)}
        description={t.in("web", "Its movements stay as they are, without a business.")}
        action={t.in("settings", "Delete")}
        destructive
        onConfirm={() => void run(() => deleteMerchant(ledgerStore, merchant.id), t.in("web", "We couldn't delete the business. Try again."))}
      />
      <ConfirmDialog
        open={confirm === "merge" && target !== undefined}
        onOpenChange={(open) => !open && setConfirm(undefined)}
        title={t.in("web", "Merge %@ into %@?", merchant.name, target?.name ?? "")}
        description={t.in("web", "Its movements and rules move to %@, and %@ is deleted.", target?.name ?? "", merchant.name)}
        action={t.in("web", "Merge")}
        onConfirm={() => void run(() => mergeMerchants(ledgerStore, merchant.id, mergeInto), t.in("web", "We couldn't merge the businesses. Try again."))}
      />
    </>
  )
}
