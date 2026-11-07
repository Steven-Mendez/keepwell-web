// Ports of keepwell-ios CoreTests (AmountInput, CurrencyFormatter) and the Settings/Summary domain:
// CSV export/import, cash flow, category breakdown and spending pace.
import { describe, expect, it } from "vitest"

import {
  categoryBreakdown,
  cashFlowOutcome,
  escapeCsvField,
  exportCsv,
  formatAmount,
  formatAmountInput,
  formatNumber,
  importCsv,
  paceComparisonDay,
  pacePreviousBySameDay,
  paceSpentSoFar,
  parseAmount,
  parseCsvRows,
  signedAmount,
  spendingPace,
  summaryReport,
} from "@/lib/domain"
import { DEFAULT_CATEGORIES } from "@/lib/schema"

import { IDs, d, date, referenceDate, sampleData, sampleStore, transaction } from "./fixtures"

describe("Amount input", () => {
  it.each([
    ["1234.5", "1234.5"],
    ["1234,5", "1234.5"],
    ["1,234.50", "1234.5"],
    ["36.6243", "36.6243"],
    [" 879 ", "879"],
    [".5", "0.5"],
    ["10.", "10"],
    ["8,000", "8000"],
    ["1,250,000", "1250000"],
    ["12,50", "12.5"],
  ])("accepts %s", (text, expected) => {
    expect(parseAmount(text)?.toFixed()).toBe(expected)
  })

  it.each(["", "abc", "12abc", "-1", "1.2.3", "1,2,3", "1e5"])("rejects %j", (text) => {
    expect(parseAmount(text)).toBeUndefined()
  })

  it.each([
    ["10000", "10,000.00"],
    ["1234,5", "1,234.50"],
    ["0.5", "0.50"],
    ["8,000", "8,000.00"],
  ])("formats %s as %s", (text, expected) => {
    expect(formatAmountInput(text)).toBe(expected)
  })

  it("formatted text parses back to the same amount, and invalid text is left alone", () => {
    expect(parseAmount(formatAmountInput("1250000.5")!)?.toFixed()).toBe("1250000.5")
    expect(formatAmountInput("")).toBeUndefined()
    expect(formatAmountInput("12abc")).toBeUndefined()
  })
})

describe("Currency formatter", () => {
  it("formats like the design", () => {
    expect(formatAmount("11157.4625", "USD")).toBe("$11,157.46")
    expect(formatAmount("8420", "NIO")).toBe("C$8,420.00")
    expect(formatAmount("-941.3", "NIO")).toBe("−C$941.30")
    expect(formatAmount("408634.25", "NIO", { fractionDigits: 0 })).toBe("C$408,634")
  })

  it("keeps precision beyond double range", () => {
    expect(formatAmount("12345678901234567.89", "USD")).toBe("$12,345,678,901,234,567.89")
  })

  it("rounds half up", () => {
    expect(formatAmount("378.355", "USD")).toBe("$378.36")
    expect(formatAmount("0.004", "USD", { sign: "always" })).toBe("+$0.00")
  })

  it("signed strings show direction", () => {
    expect(signedAmount("3.02", "USD")).toBe("+$3.02")
    expect(signedAmount("-250", "NIO")).toBe("−C$250.00")
    expect(formatAmount("-250", "NIO", { sign: "never" })).toBe("C$250.00")
  })

  it("unknown currencies use their code; plain numbers", () => {
    expect(formatAmount("5", "chf")).toBe("CHF 5.00")
    expect(formatNumber("9443.6")).toBe("9,443.60")
    expect(formatNumber("36.6243", 4)).toBe("36.6243")
  })
})

describe("CSV", () => {
  it("escapes like RFC 4180 and reads it back", () => {
    expect(escapeCsvField('Lunch, "big"')).toBe('"Lunch, ""big"""')
    expect(parseCsvRows('a,"b, c","d ""e"""\r\n1,"multi\nline",3\n')).toEqual([
      ["a", "b, c", 'd "e"'],
      ["1", "multi\nline", "3"],
    ])
  })

  it("exports every movement with the iOS columns, oldest first", () => {
    const sample = sampleData()
    const csv = exportCsv(sample.transactions, sample.accounts, sample.cards, DEFAULT_CATEGORIES)
    const rows = parseCsvRows(csv)
    expect(rows[0]).toEqual(["date", "status", "type", "description", "category", "amount", "currency", "account", "card_last_four", "destination_account", "debited_principal", "rate", "shared", "note", "tags"])
    expect(rows).toHaveLength(sample.transactions.length + 1)
    const withdrawal = rows.find((row) => row[3] === "Cardless withdrawal")!
    expect(withdrawal).toEqual(["2026-10-04", "confirmed", "transfer", "Cardless withdrawal", "", "1200", "NIO", "Bank One Savings", "", "Wallet", "33.15", "36.6243", "no", "", ""])
    expect(rows[1]?.[0]).toBe("2026-09-08")
  })

  it("importing the exported file twice changes nothing", async () => {
    const store = sampleStore()
    const csv = exportCsv(await store.fetchTransactions(), await store.fetchAccounts(), await store.fetchCards(), await store.fetchCategories())
    const result = await importCsv(store, csv)
    expect(result).toEqual({ imported: 0, skipped: sampleData().transactions.length })
  })

  it("imports new rows into existing accounts and skips unknown ones", async () => {
    const store = sampleStore()
    const csv = ["date,amount,account,category,type,currency,card_last_four", "2026-10-20,12.5,Bank One Savings,Restaurants,expense,usd,1234", "2026-10-20,3,Nowhere,,expense,USD,", "bad,1,Wallet,,expense,NIO,"].join("\n")
    const result = await importCsv(store, csv)
    expect(result).toEqual({ imported: 1, skipped: 2 })
    const added = (await store.fetchTransactions()).find((t) => t.amount === "12.5")!
    expect(added.accountId).toBe(IDs.savings)
    expect(added.cardId).toBe(IDs.savingsDebit)
    expect(added.categoryId).toBe("restaurants")
    expect(added.currency).toBe("USD")
  })
})

describe("Summary", () => {
  it("cash flow says saved, overspent, even or nothing", () => {
    expect(cashFlowOutcome(d(100), d(40))).toEqual({ kind: "saved", amount: d(60) })
    expect(cashFlowOutcome(d(40), d(100))).toEqual({ kind: "overspent", amount: d(60) })
    expect(cashFlowOutcome(d(5), d(5)).kind).toBe("even")
    expect(cashFlowOutcome(d(0), d(0)).kind).toBe("noActivity")
  })

  it("the breakdown folds the long tail into one slice, never a single category", () => {
    const totals = ["a", "b", "c", "d", "e", "f", "g"].map((id, index) => ({ categoryId: id, amount: d(70 - index * 10), share: d(0) }))
    const folded = categoryBreakdown(totals)
    expect(folded.entries).toHaveLength(6)
    expect(folded.entries.at(-1)?.slice).toEqual({ kind: "others", count: 2 })
    expect(categoryBreakdown(totals.slice(0, 6)).entries).toHaveLength(6)
    expect(folded.total.toFixed()).toBe("280")
  })

  it("the pace compares the same day of the previous month", () => {
    const transactions = [
      transaction({ amount: "10", date: date(2026, 10, 2) }),
      transaction({ amount: "5", date: date(2026, 10, 20) }),
      transaction({ amount: "30", date: date(2026, 9, 3) }),
      transaction({ amount: "100", date: date(2026, 9, 25) }),
    ]
    const pace = spendingPace({ year: 2026, month: 10 }, transactions, date(2026, 10, 10))
    expect(paceComparisonDay(pace)).toBe(10)
    expect(paceSpentSoFar(pace).toFixed()).toBe("10")
    expect(pacePreviousBySameDay(pace).toFixed()).toBe("30")
    expect(pace.previous).toHaveLength(30)
  })

  it("the report has six months, oldest first, ending with the current one", () => {
    const report = summaryReport(sampleData().transactions, "USD", referenceDate)
    expect(report.months).toHaveLength(6)
    expect(report.months.at(-1)?.month).toEqual({ year: 2026, month: 10 })
    expect(report.months[0]?.month).toEqual({ year: 2026, month: 5 })
    expect(report.months.at(-1)?.income.toFixed()).toBe("2452.24")
    expect(report.cashFlow.monthsSaved + report.cashFlow.monthsOverspent).toBeGreaterThan(0)
  })
})
