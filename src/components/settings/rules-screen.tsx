"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import {
  KWButton,
  KWCircleButton,
  KWEmptyState,
  KWGroupedCard,
  KWLargeTitleHeader,
} from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { CategoryBadge, Page } from "@/components/kw/primitives"
import { CategoriesSkeleton } from "@/components/kw/skeletons"
import { tagLine } from "@/components/kw/tag-editor"
import { toast } from "@/components/ui/toast"
import { useLedger } from "@/hooks/use-ledger"
import { reorderCategorizationRules, tagUsage } from "@/lib/domain"
import { useT, type Translator } from "@/lib/i18n"
import { categoryName } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"
import type { CategorizationRule, TransactionCategory } from "@/lib/schema"

import { RuleEditorDialog, type RuleEditorTarget } from "./rule-editor-dialog"

/** "Expenses · #trabajo" under a rule. */
function ruleDetail(t: Translator, rule: CategorizationRule): string {
  const kind =
    rule.kind === "income"
      ? t.in("settings", "Income")
      : t.in("settings", "Expenses")
  return [kind, tagLine(rule.tags)].filter(Boolean).join(" · ")
}

/**
 * Settings › Rules (iOS RulesView): "“Uber” → Transport" in the order they're tried, since the first
 * rule a new movement's description or note matches picks its category. Add, edit, delete, and move
 * up or down as in Categories.
 */
export function RulesScreen() {
  const t = useT()
  const ledger = useLedger()
  const [editor, setEditor] = useState<RuleEditorTarget>()
  const rules = ledger?.categorizationRules ?? []
  const usage = useMemo(
    () => tagUsage(ledger?.transactions ?? []),
    [ledger?.transactions]
  )

  const categoryOf = (rule: CategorizationRule): TransactionCategory | undefined =>
    ledger?.categories.find(
      (category) => category.id === rule.categoryId && category.kind === rule.kind
    )

  async function move(index: number, to: number) {
    if (to < 0 || to >= rules.length) return
    const order = rules.map((rule) => rule.id)
    const [id] = order.splice(index, 1)
    if (id) order.splice(to, 0, id)
    try {
      await reorderCategorizationRules(ledgerStore, order)
    } catch {
      toast.add({
        title: t.in("settings", "We couldn't save the new order. Try again."),
        type: "error",
      })
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
      <KWLargeTitleHeader
        title={t.in("settings", "Rules")}
        trailing={
          <KWButton icon="plus" onClick={() => setEditor({ mode: "create" })}>
            {t.in("settings", "New rule")}
          </KWButton>
        }
      />

      {!ledger ? (
        <CategoriesSkeleton />
      ) : rules.length === 0 ? (
        <div className="rounded-2xl bg-card">
          <KWEmptyState
            icon="bolt"
            title={t.in("settings", "No rules yet")}
            message={t.in(
              "settings",
              "Teach Keepwell that “Uber” is Transport, and new movements that say so get it on their own."
            )}
          />
        </div>
      ) : (
        <KWGroupedCard>
          <ol className="flex flex-col divide-y divide-divider">
            {rules.map((rule, index) => {
              const category = categoryOf(rule)
              const name = category
                ? categoryName(t, category)
                : t.in("settings", "Deleted category")
              return (
                <li
                  key={rule.id}
                  className="group flex min-h-14 items-center gap-2 px-2"
                >
                  <button
                    type="button"
                    onClick={() => setEditor({ mode: "edit", rule })}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50"
                  >
                    <CategoryBadge category={category} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate type-body text-foreground">
                        {t.in("settings", "“%@” → %@", rule.match, name)}
                      </span>
                      <span className="truncate type-caption text-muted-foreground">
                        {ruleDetail(t, rule)}
                      </span>
                    </span>
                    <KWIcon
                      name="chevronRight"
                      size={16}
                      className="shrink-0 text-text-faint"
                    />
                  </button>
                  {rules.length > 1 ? (
                    <span className="flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                      <KWCircleButton
                        icon="arrowUp"
                        size={32}
                        label={t.in("settings", "Move up")}
                        disabled={index === 0}
                        onClick={() => void move(index, index - 1)}
                      />
                      <KWCircleButton
                        icon="arrowDown"
                        size={32}
                        label={t.in("settings", "Move down")}
                        disabled={index === rules.length - 1}
                        onClick={() => void move(index, index + 1)}
                      />
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </KWGroupedCard>
      )}

      <p className="px-1 type-caption text-muted-foreground">
        {t.in(
          "settings",
          "New movements take the category of the first rule that matches, unless you pick one. Past ones stay as they are."
        )}
      </p>

      {editor && ledger ? (
        <RuleEditorDialog
          key={editor.mode === "edit" ? editor.rule.id : "new"}
          t={t}
          target={editor}
          categories={ledger.categories}
          tagUsage={usage}
          onClose={() => setEditor(undefined)}
        />
      ) : null}
    </Page>
  )
}
