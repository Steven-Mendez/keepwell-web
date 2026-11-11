"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { useAppActions } from "@/components/app/app-actions"
import {
  KWButton,
  KWCircleButton,
  KWEmptyState,
  KWLargeTitleHeader,
} from "@/components/kw/design"
import { Page, Surface } from "@/components/kw/primitives"
import { SummarySkeleton } from "@/components/kw/skeletons"
import { useHiddenBalances } from "@/hooks/use-hidden-balances"
import { useLedger } from "@/hooks/use-ledger"
import {
  SUMMARY_MONTH_COUNT,
  netWorthHistory,
  summaryReport,
} from "@/lib/domain"
import { useT, type Translator } from "@/lib/i18n"
import type { TransactionCategory } from "@/lib/schema"

import { CashFlowCard } from "./cash-flow-card"
import { BudgetCard } from "./budget-card"
import { CategoryCard, type CategoryMode } from "./category-card"
import { KpiStrip } from "./kpi-strip"
import { NetWorthCard } from "./net-worth-card"
import { PaceCard } from "./pace-card"
import {
  CustomRangePicker,
  PeriodPicker,
  RangeSummary,
  useRangeSummary,
  type CustomRange,
  type Period,
} from "./range-view"
import { rangeText } from "./range-format"
import { summaryFormat, type SummaryFormat } from "./summary-format"

type RangeSummaryData = NonNullable<ReturnType<typeof useRangeSummary>>
type Report = ReturnType<typeof summaryReport>

/**
 * The month the stepper and the month charts follow: the latest unless one was picked, and which
 * way the title rolls, like `.contentTransition(.numericText())` on iOS's stepper.
 */
function useMonthPick(last: number) {
  const [picked, setPicked] = useState<number>()
  const [direction, setDirection] = useState<"up" | "down">()
  const selectedIndex = Math.min(picked ?? last, last)
  const pick = (index: number) => {
    setDirection(index < selectedIndex ? "down" : "up")
    setPicked(index)
  }
  return { selectedIndex, direction, pick }
}

/** The header's subtitle in a period: its months, and that it runs through today while it does. */
function rangeSubtitle(
  t: Translator,
  f: SummaryFormat,
  range: RangeSummaryData | undefined
) {
  if (!range) return undefined
  const text = rangeText(f, range.report.range)
  return range.report.isRunning ? t.in("summary", "%@ · through today", text) : text
}

/** The selected month's title, with its year once it isn't this year's. */
function monthTitle(f: SummaryFormat, report: Report, selectedIndex: number) {
  const selected = report.months[selectedIndex]
  const currentYear = report.months.at(-1)?.month.year
  return selected
    ? f.month(selected.month, "long", true, selected.month.year !== currentYear)
    : ""
}

function MonthStepper({
  t,
  title,
  direction,
  selectedIndex,
  last,
  onPick,
}: {
  t: Translator
  title: string
  direction: "up" | "down" | undefined
  selectedIndex: number
  last: number
  onPick: (index: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <KWCircleButton
          icon="chevronLeft"
          label={t.in("summary", "Previous month")}
          disabled={selectedIndex <= 0}
          onClick={() => onPick(selectedIndex - 1)}
        />
        <span
          className="min-w-36 overflow-hidden text-center type-heading tabular-nums"
          aria-live="polite"
        >
          <span
            key={title}
            className={cn(
              "inline-block",
              direction === "up" && "animate-digit-up",
              direction === "down" && "animate-digit-down"
            )}
          >
            {title}
          </span>
        </span>
        <KWCircleButton
          icon="chevronRight"
          label={t.in("summary", "Next month")}
          disabled={selectedIndex >= last}
          onClick={() => onPick(selectedIndex + 1)}
        />
      </div>
    </div>
  )
}

function EmptySummary({ t, onLog }: { t: Translator; onLog: () => void }) {
  return (
    <Surface>
      <KWEmptyState
        icon="chartBars"
        title={t.in("summary", "Your summary starts with one transaction")}
        message={t.in(
          "summary",
          "Once you log expenses and income, you will see what came in, what went out and what you spent it on."
        )}
        action={
          <KWButton icon="plus" onClick={onLog}>
            {t.in("summary", "Log transaction")}
          </KWButton>
        }
      />
    </Surface>
  )
}

function MonthSummary({
  t,
  f,
  report,
  selectedIndex,
  onSelect,
  categories,
  mode,
  onModeChange,
}: {
  t: Translator
  f: SummaryFormat
  report: Report
  selectedIndex: number
  onSelect: (index: number) => void
  categories: readonly TransactionCategory[]
  mode: CategoryMode
  onModeChange: (mode: CategoryMode) => void
}) {
  return (
    <>
      <KpiStrip t={t} f={f} report={report} selectedIndex={selectedIndex} />
      {/* Charts on the left, stacked; categories as a tall column on the right (Mobbin: Monarch, YNAB). */}
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-3 lg:grid-rows-2">
        <CashFlowCard
          t={t}
          f={f}
          report={report}
          selectedIndex={selectedIndex}
          onSelect={onSelect}
          className="lg:col-span-2"
        />
        <CategoryCard
          t={t}
          f={f}
          report={report}
          selectedIndex={selectedIndex}
          categories={categories}
          mode={mode}
          onModeChange={onModeChange}
          className="lg:col-start-3 lg:row-span-2 lg:row-start-1"
        />
        <PaceCard
          t={t}
          f={f}
          report={report}
          selectedIndex={selectedIndex}
          className="lg:col-span-2"
        />
      </div>
      <BudgetCard
        t={t}
        f={f}
        summary={report.months[selectedIndex]}
        categories={categories}
      />
    </>
  )
}

/**
 * The three questions iOS Summary answers — did I save, where did it go, am I on track — as one
 * screen without scrolling: the month's figures in a strip, then cash flow and pace stacked beside
 * the category breakdown, all following the month stepper (Mobbin: Monarch's cash flow page).
 * On the web the same page also reads a whole period (this year, the last 12 months, any span of
 * months) against the same months a year earlier; the iPhone keeps to one month.
 */
export function SummaryScreen() {
  const t = useT()
  const ledger = useLedger()
  const { openEditor } = useAppActions()
  const currency = ledger?.settings.currencies.principal ?? "USD"
  // Recomputed on every ledger change; "now" is read then, so a new month rolls the window over.
  const report = useMemo(
    () =>
      ledger
        ? summaryReport(ledger.transactions, currency, new Date())
        : undefined,
    [ledger, currency]
  )
  const netWorth = useMemo(
    () =>
      ledger
        ? netWorthHistory(
            ledger.accounts,
            ledger.transactions,
            ledger.settings.currencies,
            new Date()
          )
        : [],
    [ledger]
  )
  const [hidden] = useHiddenBalances()
  const [mode, setMode] = useState<CategoryMode>("expenses")
  const [period, setPeriod] = useState<Period>("month")
  const [custom, setCustom] = useState<CustomRange>()
  const range = useRangeSummary(ledger?.transactions, currency, period, custom)
  const last = (report?.months.length ?? SUMMARY_MONTH_COUNT) - 1
  const { selectedIndex, direction, pick } = useMonthPick(last)
  const f = summaryFormat(t, currency)

  if (!ledger || !report) return <SummarySkeleton />

  const hasMovements =
    report.averageExpense !== undefined || report.averageIncome !== undefined

  const controls = hasMovements ? (
    <div className="flex flex-wrap items-center gap-3">
      <PeriodPicker t={t} value={period} onChange={setPeriod} />
      {period === "month" ? (
        <MonthStepper
          t={t}
          title={monthTitle(f, report, selectedIndex)}
          direction={direction}
          selectedIndex={selectedIndex}
          last={last}
          onPick={pick}
        />
      ) : null}
      {period === "custom" && range ? (
        <CustomRangePicker
          t={t}
          f={f}
          activity={range.activity}
          range={range.report.range}
          onChange={setCustom}
        />
      ) : null}
    </div>
  ) : undefined

  return (
    <>
      {/* Wide: a month fits exactly the window's height below the top bar, so it reads without
        scrolling; a period has more charts and scrolls. Net worth spans a year whatever the
        period, so it follows below, outside that first screen. */}
      <Page
        className={cn(
          "lg:gap-4 lg:py-6",
          !range && "lg:h-[calc(100svh-var(--topbar-h))] lg:min-h-[640px]"
        )}
      >
        <KWLargeTitleHeader
          title={t.in("summary", "Summary")}
          subtitle={rangeSubtitle(t, f, range)}
          trailing={controls}
          className="flex-wrap items-center"
        />
        {!hasMovements ? (
          <EmptySummary t={t} onLog={() => openEditor()} />
        ) : range ? (
          <RangeSummary
            t={t}
            f={f}
            report={range.report}
            years={range.years}
            categories={ledger.categories}
          />
        ) : (
          <MonthSummary
            t={t}
            f={f}
            report={report}
            selectedIndex={selectedIndex}
            onSelect={pick}
            categories={ledger.categories}
            mode={mode}
            onModeChange={setMode}
          />
        )}
      </Page>
      {hasMovements && netWorth.length > 0 ? (
        <Page className="pt-0 md:pt-0 lg:pt-0">
          <NetWorthCard
            t={t}
            f={f}
            points={netWorth}
            convertsCurrencies={ledger.settings.currencies.second !== undefined}
            hidden={hidden}
          />
        </Page>
      ) : null}
    </>
  )
}
