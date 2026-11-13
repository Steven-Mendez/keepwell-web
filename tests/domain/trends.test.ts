import { describe, expect, it } from "vitest"

import { activityRange, comparisonShift, lastMonths, monthRange, rangeLength, trendReport, yearToDate, yearTotals } from "@/lib/domain"

import { d, date, single, transaction, ZONE } from "./fixtures"

const usd = single("USD")
const expense = (amount: string, when: Date, category = "food") => transaction({ amount, date: when, category, rate: usd })
const income = (amount: string, when: Date) => transaction({ kind: "income", amount, date: when, category: "salary", rate: usd })

describe("Trends", () => {
  it("builds ranges in either order and counts their months", () => {
    const range = monthRange({ year: 2026, month: 8 }, { year: 2026, month: 3 })
    expect(range.start).toEqual({ year: 2026, month: 3 })
    expect(rangeLength(range)).toBe(6)
    expect(rangeLength(lastMonths(12, date(2026, 11, 5), ZONE))).toBe(12)
    expect(yearToDate(date(2026, 11, 5), ZONE)).toEqual({ start: { year: 2026, month: 1 }, end: { year: 2026, month: 11 } })
  })

  it("compares up to a year with the same months a year earlier, and longer spans with the stretch before", () => {
    expect(comparisonShift(monthRange({ year: 2026, month: 3 }, { year: 2026, month: 5 }))).toBe(12)
    expect(comparisonShift(monthRange({ year: 2025, month: 1 }, { year: 2026, month: 6 }))).toBe(18)
  })

  it("adds up the period, finds its best and worst months and the running savings", () => {
    const now = date(2026, 12, 31)
    const report = trendReport(
      [income("1000", date(2026, 1, 10)), expense("400", date(2026, 1, 12)), income("1000", date(2026, 2, 10)), expense("1300", date(2026, 2, 12)), expense("100", date(2026, 3, 2))],
      "USD",
      monthRange({ year: 2026, month: 1 }, { year: 2026, month: 4 }),
      ZONE, now,
    )
    expect(report.months).toHaveLength(4)
    expect(report.cashFlow.income.eq(2000)).toBe(true)
    expect(report.cashFlow.expense.eq(1800)).toBe(true)
    expect(report.bestMonth?.month).toEqual({ year: 2026, month: 1 })
    expect(report.worstMonth?.month).toEqual({ year: 2026, month: 2 })
    expect(report.cumulativeSavings.map((value) => value.toNumber())).toEqual([600, 300, 200, 200])
    expect(report.averageExpense?.eq(600)).toBe(true)
    expect(report.hasComparison).toBe(false)
    expect(report.biggestIncrease).toBeUndefined()
  })

  it("ranks categories and says which grew and which dropped against last year", () => {
    const report = trendReport(
      [
        expense("300", date(2026, 3, 5), "food"),
        expense("50", date(2026, 3, 6), "transport"),
        expense("100", date(2025, 3, 5), "food"),
        expense("200", date(2025, 3, 6), "transport"),
        expense("80", date(2025, 3, 7), "gym"),
      ],
      "USD",
      monthRange({ year: 2026, month: 3 }, { year: 2026, month: 3 }),
      ZONE, date(2026, 12, 1),
    )
    expect(report.hasComparison).toBe(true)
    expect(report.expenseCategories.map((entry) => entry.categoryId)).toEqual(["food", "transport", "gym"])
    expect(report.expenseCategories[0]?.changeRate?.eq(2)).toBe(true)
    expect(report.biggestIncrease?.categoryId).toBe("food")
    expect(report.biggestDecrease?.categoryId).toBe("transport")
    // The ring only holds what was spent in this period.
    expect(report.expenseBreakdown.entries).toHaveLength(2)
    expect(report.categoryTrends[0]?.amounts.map((value) => value.toNumber())).toEqual([300])
  })

  it("stops at the running month and compares it with last year only up to the same day", () => {
    const now = date(2026, 11, 5)
    const report = trendReport(
      [expense("10", date(2026, 11, 3)), expense("20", date(2025, 11, 4)), expense("999", date(2025, 11, 20))],
      "USD",
      monthRange({ year: 2026, month: 10 }, { year: 2027, month: 2 }),
      ZONE, now,
    )
    expect(report.range.end).toEqual({ year: 2026, month: 11 })
    expect(report.isRunning).toBe(true)
    expect(report.comparisonMonths.at(-1)?.expense.eq(20)).toBe(true)
  })

  it("ignores planned movements and transfers", () => {
    const report = trendReport(
      [transaction({ amount: "500", date: date(2026, 5, 1), status: "planned", rate: usd }), transaction({ kind: "transfer", amount: "70", date: date(2026, 5, 2), rate: usd })],
      "USD",
      monthRange({ year: 2026, month: 5 }, { year: 2026, month: 5 }),
      ZONE, date(2026, 12, 1),
    )
    expect(report.cashFlow.expense.isZero()).toBe(true)
    expect(report.bestMonth).toBeUndefined()
  })

  it("totals every year from the first movement", () => {
    const now = date(2026, 11, 5)
    const transactions = [income("100", date(2024, 6, 1)), expense("40", date(2026, 2, 1))]
    expect(activityRange(transactions, now, ZONE)?.start).toEqual({ year: 2024, month: 6 })
    const years = yearTotals(transactions, "USD", ZONE, now)
    expect(years.map((year) => year.year)).toEqual([2024, 2025, 2026])
    expect(years[0]?.cashFlow.income.eq(d(100))).toBe(true)
    expect(years.at(-1)?.isRunning).toBe(true)
  })
})
