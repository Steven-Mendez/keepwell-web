"use client"

import { useMemo, useState } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { KWButton, KWCircleButton, KWEmptyState, KWLargeTitleHeader, KWSegmented } from "@/components/kw/design"
import { Page, Surface } from "@/components/kw/primitives"
import { useLedger } from "@/hooks/use-ledger"
import { SUMMARY_MONTH_COUNT, summaryReport } from "@/lib/domain"
import { useT } from "@/lib/i18n"

import { CashFlowCard, WindowCard } from "./cash-flow-card"
import { CategoryCard, type CategoryMode } from "./category-card"
import { PaceCard } from "./pace-card"
import { summaryFormat } from "./summary-format"

/**
 * The three questions iOS Summary answers — did I save, where did it go, am I on track — laid out
 * as an analytics grid with a month stepper (desktop finance pattern, Mobbin: Revolut web).
 */
export function SummaryScreen() {
  const t = useT()
  const ledger = useLedger()
  const { openEditor } = useAppActions()
  const currency = ledger?.settings.currencies.principal ?? "USD"
  // Recomputed on every ledger change; "now" is read then, so a new month rolls the window over.
  const report = useMemo(() => (ledger ? summaryReport(ledger.transactions, currency, new Date()) : undefined), [ledger, currency])
  const [picked, setPicked] = useState<number>()
  const [mode, setMode] = useState<CategoryMode>("expenses")
  const last = (report?.months.length ?? SUMMARY_MONTH_COUNT) - 1
  const selectedIndex = Math.min(picked ?? last, last)
  const f = summaryFormat(t, currency)

  if (!ledger || !report) {
    return (
      <Page>
        <KWLargeTitleHeader title={t.in("summary", "Summary")} />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-96 animate-pulse rounded-2xl bg-card lg:col-span-2" />
          <div className="h-96 animate-pulse rounded-2xl bg-card" />
        </div>
      </Page>
    )
  }

  const hasMovements = report.averageExpense !== undefined || report.averageIncome !== undefined
  const selected = report.months[selectedIndex]
  const currentYear = report.months.at(-1)?.month.year
  const title = selected ? f.month(selected.month, "long", true, selected.month.year !== currentYear) : ""

  const stepper = hasMovements ? (
    <div className="flex flex-wrap items-center gap-3">
      <KWSegmented
        style="compact"
        aria-label={t.in("summary", "By category")}
        value={mode}
        onChange={setMode}
        options={[
          { value: "expenses", title: t.in("summary", "Expenses") },
          { value: "income", title: t.in("summary", "Income") },
        ]}
      />
      <div className="flex items-center gap-2">
      <KWCircleButton icon="chevronLeft" label={t.in("summary", "Previous month")} disabled={selectedIndex <= 0} onClick={() => setPicked(selectedIndex - 1)} />
      <span className="min-w-36 text-center type-heading tabular-nums" aria-live="polite">
        {title}
      </span>
      <KWCircleButton icon="chevronRight" label={t.in("summary", "Next month")} disabled={selectedIndex >= last} onClick={() => setPicked(selectedIndex + 1)} />
      </div>
    </div>
  ) : undefined

  return (
    <Page>
      <KWLargeTitleHeader title={t.in("summary", "Summary")} trailing={stepper} className="flex-wrap items-center" />
      {!hasMovements ? (
        <Surface>
          <KWEmptyState
            icon="chartBars"
            title={t.in("summary", "Your summary starts with one transaction")}
            message={t.in("summary", "Once you log expenses and income, you will see what came in, what went out and what you spent it on.")}
            action={
              <KWButton icon="plus" onClick={() => openEditor()}>
                {t.in("summary", "Log transaction")}
              </KWButton>
            }
          />
        </Surface>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <CashFlowCard t={t} f={f} report={report} selectedIndex={selectedIndex} onSelect={setPicked} className="lg:col-span-2" />
          <WindowCard t={t} f={f} report={report} selectedIndex={selectedIndex} />
          <CategoryCard t={t} f={f} report={report} selectedIndex={selectedIndex} categories={ledger.categories} mode={mode} className="lg:col-span-2" />
          <PaceCard t={t} f={f} report={report} selectedIndex={selectedIndex} />
        </div>
      )}
    </Page>
  )
}
