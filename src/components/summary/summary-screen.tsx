"use client"

import { ChartColumnIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { EmptyState, Page, PageHeader, Surface } from "@/components/kw/primitives"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useLedger } from "@/hooks/use-ledger"
import { SUMMARY_MONTH_COUNT, summaryReport } from "@/lib/domain"
import { useT } from "@/lib/i18n"

import { CashFlowCard, WindowCard } from "./cash-flow-card"
import { CategoryCard } from "./category-card"
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
  const last = (report?.months.length ?? SUMMARY_MONTH_COUNT) - 1
  const selectedIndex = Math.min(picked ?? last, last)
  const f = summaryFormat(t, currency)

  if (!ledger || !report) {
    return (
      <Page>
        <PageHeader title={t.in("summary", "Summary")} />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </Page>
    )
  }

  const hasMovements = report.averageExpense !== undefined || report.averageIncome !== undefined
  const selected = report.months[selectedIndex]
  const currentYear = report.months.at(-1)?.month.year
  const title = selected ? f.month(selected.month, "long", true, selected.month.year !== currentYear) : ""

  const stepper = hasMovements ? (
    <div className="flex items-center gap-1 rounded-xl bg-card p-1 ring-1 ring-border/60">
      <Button variant="ghost" size="icon" aria-label={t.in("summary", "Previous month")} disabled={selectedIndex <= 0} onClick={() => setPicked(selectedIndex - 1)}>
        <ChevronLeftIcon />
      </Button>
      <span className="min-w-36 text-center type-label tabular-nums" aria-live="polite">
        {title}
      </span>
      <Button variant="ghost" size="icon" aria-label={t.in("summary", "Next month")} disabled={selectedIndex >= last} onClick={() => setPicked(selectedIndex + 1)}>
        <ChevronRightIcon />
      </Button>
    </div>
  ) : undefined

  return (
    <Page>
      <PageHeader title={t.in("summary", "Summary")} actions={stepper} />
      {!hasMovements ? (
        <Surface>
          <EmptyState
            icon={ChartColumnIcon}
            title={t.in("summary", "Your summary starts with one transaction")}
            description={t.in("summary", "Once you log expenses and income, you will see what came in, what went out and what you spent it on.")}
          >
            <Button onClick={() => openEditor()}>
              <PlusIcon data-icon="inline-start" />
              {t.in("summary", "Log transaction")}
            </Button>
          </EmptyState>
        </Surface>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <CashFlowCard t={t} f={f} report={report} selectedIndex={selectedIndex} onSelect={setPicked} className="lg:col-span-2" />
          <WindowCard t={t} f={f} report={report} selectedIndex={selectedIndex} />
          <CategoryCard t={t} f={f} report={report} selectedIndex={selectedIndex} categories={ledger.categories} className="lg:col-span-2" />
          <PaceCard t={t} f={f} report={report} selectedIndex={selectedIndex} />
        </div>
      )}
    </Page>
  )
}
