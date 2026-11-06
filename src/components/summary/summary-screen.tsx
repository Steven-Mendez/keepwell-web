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
import { useLedger } from "@/hooks/use-ledger"
import { SUMMARY_MONTH_COUNT, summaryReport } from "@/lib/domain"
import { useT } from "@/lib/i18n"

import { CashFlowCard } from "./cash-flow-card"
import { CategoryCard, type CategoryMode } from "./category-card"
import { KpiStrip } from "./kpi-strip"
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
import { summaryFormat } from "./summary-format"

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
  const [picked, setPicked] = useState<number>()
  // Which way the month title rolls, like `.contentTransition(.numericText())` on iOS's stepper.
  const [direction, setDirection] = useState<"up" | "down">()
  const [mode, setMode] = useState<CategoryMode>("expenses")
  const [period, setPeriod] = useState<Period>("month")
  const [custom, setCustom] = useState<CustomRange>()
  const range = useRangeSummary(ledger?.transactions, currency, period, custom)
  const last = (report?.months.length ?? SUMMARY_MONTH_COUNT) - 1
  const selectedIndex = Math.min(picked ?? last, last)
  const f = summaryFormat(t, currency)
  const pick = (index: number) => {
    setDirection(index < selectedIndex ? "down" : "up")
    setPicked(index)
  }

  if (!ledger || !report) return <SummarySkeleton />

  const hasMovements =
    report.averageExpense !== undefined || report.averageIncome !== undefined
  const selected = report.months[selectedIndex]
  const currentYear = report.months.at(-1)?.month.year
  const title = selected
    ? f.month(selected.month, "long", true, selected.month.year !== currentYear)
    : ""

  const stepper = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <KWCircleButton
          icon="chevronLeft"
          label={t.in("summary", "Previous month")}
          disabled={selectedIndex <= 0}
          onClick={() => pick(selectedIndex - 1)}
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
          onClick={() => pick(selectedIndex + 1)}
        />
      </div>
    </div>
  )

  const controls = hasMovements ? (
    <div className="flex flex-wrap items-center gap-3">
      <PeriodPicker t={t} value={period} onChange={setPeriod} />
      {period === "month" ? stepper : null}
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
  const subtitle = range
    ? range.report.isRunning
      ? t.in("web", "%@ · through today", rangeText(f, range.report.range))
      : rangeText(f, range.report.range)
    : undefined

  return (
    // Wide: a month fits exactly the window's height below the top bar, so it reads without
    // scrolling; a period has more charts and scrolls.
    <Page
      className={cn(
        "lg:gap-4 lg:py-6",
        !range && "lg:h-[calc(100svh-var(--topbar-h))] lg:min-h-[640px]"
      )}
    >
      <KWLargeTitleHeader
        title={t.in("summary", "Summary")}
        subtitle={subtitle}
        trailing={controls}
        className="flex-wrap items-center"
      />
      {!hasMovements ? (
        <Surface>
          <KWEmptyState
            icon="chartBars"
            title={t.in("summary", "Your summary starts with one transaction")}
            message={t.in(
              "summary",
              "Once you log expenses and income, you will see what came in, what went out and what you spent it on."
            )}
            action={
              <KWButton icon="plus" onClick={() => openEditor()}>
                {t.in("summary", "Log transaction")}
              </KWButton>
            }
          />
        </Surface>
      ) : range ? (
        <RangeSummary
          t={t}
          f={f}
          report={range.report}
          years={range.years}
          categories={ledger.categories}
        />
      ) : (
        <>
          <KpiStrip t={t} f={f} report={report} selectedIndex={selectedIndex} />
          {/* Charts on the left, stacked; categories as a tall column on the right (Mobbin: Monarch, YNAB). */}
          <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-3 lg:grid-rows-2">
            <CashFlowCard
              t={t}
              f={f}
              report={report}
              selectedIndex={selectedIndex}
              onSelect={pick}
              className="lg:col-span-2"
            />
            <CategoryCard
              t={t}
              f={f}
              report={report}
              selectedIndex={selectedIndex}
              categories={ledger.categories}
              mode={mode}
              onModeChange={setMode}
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
        </>
      )}
    </Page>
  )
}
