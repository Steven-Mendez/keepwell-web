// Ports of keepwell-ios DomainTests: Balances, Conversion, MonthlySummary, NetWorth, BillingCycle,
// Subscriptions, Settings, Money and Entities.
import { describe, expect, it } from "vitest"

import {
  DomainError,
  addMonths,
  addMoney,
  amountIn,
  averageMonthlyTotal,
  balanceOf,
  bankRate,
  billingCycle,
  cardExpiry,
  checkAmounts,
  checkDayOfMonth,
  checkLastFour,
  compareExpiry,
  convert,
  currencySettings,
  exchangeRate,
  expiryReminderDay,
  inSecondCurrency,
  makeCard,
  makeCreditTerms,
  monthlySummary,
  monthlyTotals,
  netWorth,
  nextOccurrence,
  normalizedCurrency,
  plannedSummary,
  principalAmount,
  rounded,
  roundedHalfUp,
  savings,
  savingsRate,
  secondAmount,
  settingsRate,
  singleRate,
  startOfDay,
  subscriptionsCharged,
  subtractMoney,
  swappedCurrencies,
  yearMonth,
  type Money,
} from "@/lib/domain"
import type { Account } from "@/lib/schema"
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from "@/lib/schema"

import { d, date, single, transaction, usdNio } from "./fixtures"

const m = (amount: string | number, currency: string): Money => ({ amount: d(amount), currency })
const plain = (list: Money[]) => list.map((value) => `${value.amount.toFixed()} ${value.currency}`)
const cents = (value: ReturnType<typeof d>) => rounded(value, 2).toFixed(2)

function expectDomainError(work: () => unknown, code: DomainError["code"]) {
  expect(work).toThrow(DomainError)
  try {
    work()
  } catch (error) {
    expect((error as DomainError).code).toBe(code)
  }
}

describe("Account balances (rules 1, 3, 4, 5)", () => {
  const opening = date(2026, 9, 1).toISOString()
  const deposit = (amount: string, currency = "USD"): Account => ({
    id: crypto.randomUUID(),
    name: "Savings",
    kind: "deposit",
    openingBalances: [{ amount, currency }],
    openingDate: opening,
  })

  it("expenses subtract and income adds", () => {
    const account = deposit("100")
    const result = balanceOf(account, [
      transaction({ kind: "expense", amount: "30", account: account.id }),
      transaction({ kind: "income", amount: "12.5", account: account.id }),
    ])
    expect(plain(result)).toEqual(["82.5 USD"])
  })

  it("planned movements do not count", () => {
    const account = deposit("100")
    expect(plain(balanceOf(account, [transaction({ amount: "3500", currency: "NIO", account: account.id, status: "planned" })]))).toEqual(["100 USD"])
  })

  it("confirming a planned movement makes it count", () => {
    const account = deposit("100")
    const planned = transaction({ amount: "40", account: account.id, status: "planned" })
    expect(plain(balanceOf(account, [{ ...planned, status: "confirmed" }]))).toEqual(["60 USD"])
  })

  it("movements before the opening date are already in the opening balance", () => {
    const account = deposit("100")
    expect(plain(balanceOf(account, [transaction({ amount: "40", account: account.id, date: date(2026, 8, 31) })]))).toEqual(["100 USD"])
  })

  it("ignores other accounts' movements", () => {
    expect(plain(balanceOf(deposit("100"), [transaction({ amount: "40" })]))).toEqual(["100 USD"])
  })

  it("a second-currency purchase on a principal account uses the real debit", () => {
    const account = deposit("100")
    const dinner = transaction({ amount: "879", currency: "NIO", account: account.id, actualDebited: "24.28" })
    expect(plain(balanceOf(account, [dinner]))).toEqual(["75.72 USD"])
  })

  it("an ATM withdrawal moves the second currency into cash and the real debit out of the bank", () => {
    const bank = deposit("100")
    const cash = deposit("0", "NIO")
    const withdrawal = transaction({ kind: "transfer", amount: "1200", currency: "NIO", account: bank.id, destination: cash.id, actualDebited: "33.15" })
    expect(plain(balanceOf(bank, [withdrawal]))).toEqual(["66.85 USD"])
    expect(plain(balanceOf(cash, [withdrawal]))).toEqual(["1200 NIO"])
  })

  it("transfers are neither expense nor income but move money", () => {
    const from = deposit("500")
    const to = deposit("0")
    const move = transaction({ kind: "transfer", amount: "200", account: from.id, destination: to.id })
    expect(plain(balanceOf(from, [move]))).toEqual(["300 USD"])
    expect(plain(balanceOf(to, [move]))).toEqual(["200 USD"])
  })

  it("a dual credit card books each purchase in its currency", () => {
    const card: Account = {
      id: crypto.randomUUID(),
      name: "Mastercard",
      kind: "credit",
      openingBalances: [
        { amount: "0", currency: "USD" },
        { amount: "0", currency: "NIO" },
      ],
      openingDate: opening,
    }
    const result = balanceOf(card, [
      transaction({ amount: "6.49", currency: "USD", account: card.id }),
      transaction({ amount: "190", currency: "NIO", account: card.id }),
      transaction({ amount: "10.30", currency: "USD", account: card.id }),
      transaction({ amount: "7.02", currency: "NIO", account: card.id }),
    ])
    expect(plain(result)).toEqual(["-16.79 USD", "-197.02 NIO"])
  })

  it("pays the second-currency debt from a principal account", () => {
    const bank = deposit("100")
    const card: Account = {
      id: crypto.randomUUID(),
      name: "Mastercard",
      kind: "credit",
      openingBalances: [
        { amount: "0", currency: "USD" },
        { amount: "-500", currency: "NIO" },
      ],
      openingDate: opening,
    }
    const payment = transaction({ kind: "transfer", amount: "500", currency: "NIO", account: bank.id, destination: card.id, actualDebited: "13.70" })
    expect(plain(balanceOf(card, [payment]))).toEqual(["0 USD", "0 NIO"])
    expect(plain(balanceOf(bank, [payment]))).toEqual(["86.3 USD"])
  })

  it("a single-currency credit card converts everything to its currency", () => {
    const card: Account = { id: crypto.randomUUID(), name: "Visa", kind: "credit", openingBalances: [{ amount: "-941.3", currency: "NIO" }], openingDate: opening }
    const result = balanceOf(card, [transaction({ amount: "10", currency: "USD", account: card.id })])
    expect(cents(result[0]!.amount)).toBe("-1307.54")
  })
})

describe("Currency conversion (rule 2)", () => {
  it("a second-currency amount converts with the stored rate", () => {
    const lunch = transaction({ amount: "250", currency: "NIO" })
    expect(cents(principalAmount(lunch))).toBe("6.83")
    expect(secondAmount(lunch).toFixed()).toBe("250")
  })

  it("a principal amount converts to the second", () => {
    const tool = transaction({ amount: "200", currency: "USD" })
    expect(principalAmount(tool).toFixed()).toBe("200")
    expect(cents(secondAmount(tool))).toBe("7324.86")
  })

  it("the actual debit wins for the principal and drives the bank rate", () => {
    const dinner = transaction({ amount: "879", currency: "NIO", actualDebited: "24.28" })
    expect(principalAmount(dinner).toFixed()).toBe("24.28")
    expect(secondAmount(dinner).toFixed()).toBe("879")
    expect(cents(bankRate(dinner)!)).toBe("36.20")
  })

  it("an actual debit on a principal purchase feeds the second amount", () => {
    const purchase = transaction({ amount: "20", currency: "USD", actualDebited: "20.42" })
    expect(principalAmount(purchase).toFixed()).toBe("20.42")
    expect(cents(secondAmount(purchase))).toBe("747.87")
    expect(bankRate(purchase)).toBeUndefined()
  })

  it("changing the settings rate never rewrites history", () => {
    const old = transaction({ amount: "366.243", currency: "NIO" })
    exchangeRate("USD", "NIO", 40)
    expect(principalAmount(old).toFixed()).toBe("10")
  })

  it("single-currency mode is identity", () => {
    const movement = transaction({ amount: "12.5", rate: single("USD") })
    expect(principalAmount(movement).toFixed()).toBe("12.5")
    expect(secondAmount(movement).toFixed()).toBe("12.5")
  })

  it("amountIn picks the requested currency", () => {
    const withdrawal = transaction({ kind: "transfer", amount: "1200", currency: "NIO", actualDebited: "33.15" })
    expect(amountIn(withdrawal, "USD").toFixed()).toBe("33.15")
    expect(amountIn(withdrawal, "NIO").toFixed()).toBe("1200")
  })
})

describe("Monthly summary (rule 7)", () => {
  const october = yearMonth(2026, 10)!
  const summary = (list: Parameters<typeof monthlySummary>[1]) => monthlySummary(october, list, "USD")

  it("totals income, expense, savings and rate", () => {
    const result = summary([transaction({ kind: "income", amount: "2452.24", category: "salary" }), transaction({ amount: "709.58", category: "tools" })])
    expect(result.income.toFixed()).toBe("2452.24")
    expect(result.expense.toFixed()).toBe("709.58")
    expect(savings(result).toFixed()).toBe("1742.66")
    expect(rounded(savingsRate(result)!.times(100), 0).toFixed()).toBe("71")
  })

  it("no income means no savings rate", () => {
    expect(savingsRate(summary([transaction({ amount: "10" })]))).toBeUndefined()
  })

  it("overspending gives negative savings", () => {
    const result = summary([transaction({ kind: "income", amount: "100", category: "salary" }), transaction({ amount: "150" })])
    expect(savings(result).toFixed()).toBe("-50")
    expect(savingsRate(result)!.toFixed()).toBe("-0.5")
  })

  it("excludes planned movements, transfers and other months", () => {
    const result = summary([
      transaction({ amount: "3500", currency: "NIO", status: "planned" }),
      transaction({ kind: "transfer", amount: "1200", currency: "NIO", actualDebited: "33.15" }),
      transaction({ amount: "40", date: date(2026, 9, 30) }),
      transaction({ amount: "5", category: "education" }),
    ])
    expect(result.expense.toFixed()).toBe("5")
    expect(result.income.toFixed()).toBe("0")
  })

  it("converts second-currency spending with each stored rate", () => {
    expect(summary([transaction({ amount: "879", currency: "NIO", actualDebited: "24.28" })]).expense.toFixed()).toBe("24.28")
  })

  it("sorts categories with shares", () => {
    const result = summary([transaction({ amount: "25", category: "restaurants" }), transaction({ amount: "75", category: "tools" })])
    expect(result.categories.map((entry) => entry.categoryId)).toEqual(["tools", "restaurants"])
    expect(result.categories.map((entry) => entry.share.toFixed())).toEqual(["0.75", "0.25"])
  })

  it("the average counts only months with spending", () => {
    const average = averageMonthlyTotal("expense", [
      transaction({ amount: "47.13", date: date(2026, 9, 10) }),
      transaction({ amount: "709.58", date: date(2026, 10, 10) }),
      transaction({ kind: "income", amount: "3.02", date: date(2026, 8, 10) }),
    ])
    expect(cents(average!)).toBe("378.36")
    expect(averageMonthlyTotal("expense", [])).toBeUndefined()
  })

  it("the monthly series fills empty months, oldest first", () => {
    const series = monthlyTotals("expense", october, 6, [transaction({ amount: "47.13", date: date(2026, 9, 10) })])
    expect(series.map((entry) => entry.month.month)).toEqual([5, 6, 7, 8, 9, 10])
    expect(series.map((entry) => entry.total.toFixed())).toEqual(["0", "0", "0", "0", "47.13", "0"])
  })

  it("year-month wraps across years", () => {
    const january = yearMonth(2026, 1)!
    expect(addMonths(january, -1)).toEqual({ year: 2025, month: 12 })
    expect(addMonths(january, -13)).toEqual({ year: 2024, month: 12 })
    expect(addMonths(january, 12)).toEqual({ year: 2027, month: 1 })
    expect(yearMonth(2026, 13)).toBeUndefined()
  })

  it("the planned summary totals both currencies", () => {
    const planned = plannedSummary([
      transaction({ amount: "3500", currency: "NIO", status: "planned" }),
      transaction({ amount: "2000", currency: "NIO", status: "planned" }),
      transaction({ amount: "1300", currency: "NIO", status: "planned" }),
      transaction({ amount: "700", currency: "NIO", status: "planned" }),
      transaction({ amount: "1", currency: "NIO" }),
    ])
    expect(planned.count).toBe(4)
    expect(planned.secondTotal.toFixed()).toBe("7500")
    expect(cents(planned.principalTotal)).toBe("204.78")
  })
})

describe("Net worth (rule 6)", () => {
  it("sums balances converted to the principal", () => {
    const settings = currencySettings("USD", "NIO", "36.6243")
    const total = netWorth([m("9306.78", "USD"), m("1668.65", "USD"), m(8420, "NIO"), m("-941.30", "NIO"), m("-16.79", "USD"), m("-197.02", "NIO")], settings)
    expect(total.currency).toBe("USD")
    expect(cents(total.amount)).toBe("11157.46")
    expect(rounded(inSecondCurrency(total, settings)!.amount, 0).toFixed()).toBe("408634")
  })

  it("a currency the settings don't convert is left out", () => {
    expect(netWorth([m(1, "EUR"), m(5, "USD")], currencySettings("USD", "NIO", 36))).toEqual(m(5, "USD"))
  })

  it("a single currency has no second total", () => {
    expect(inSecondCurrency(m(5, "USD"), currencySettings())).toBeUndefined()
  })
})

describe("Billing cycle", () => {
  it("runs from the day after the cutoff through the cutoff", () => {
    const cycle = billingCycle(date(2026, 10, 2), 28)
    expect(cycle.start).toEqual(startOfDay(date(2026, 9, 29)))
    expect(cycle.end).toEqual(startOfDay(date(2026, 10, 29)))
  })

  it("a date after the cutoff belongs to the next cycle", () => {
    const cycle = billingCycle(date(2026, 10, 29), 28)
    expect(cycle.start).toEqual(startOfDay(date(2026, 10, 29)))
    expect(cycle.end).toEqual(startOfDay(date(2026, 11, 29)))
  })

  it("the cutoff day clamps to short months", () => {
    const cycle = billingCycle(date(2026, 2, 20), 31)
    expect(cycle.start).toEqual(startOfDay(date(2026, 2, 1)))
    expect(cycle.end).toEqual(startOfDay(date(2026, 3, 1)))
  })

  it("no cutoff means the calendar month", () => {
    expect(billingCycle(date(2026, 10, 15), undefined).start).toEqual(startOfDay(date(2026, 10, 1)))
  })

  it("the next occurrence rolls to the next month", () => {
    expect(nextOccurrence(15, date(2026, 10, 15))).toEqual(startOfDay(date(2026, 10, 15)))
    expect(nextOccurrence(15, date(2026, 10, 16))).toEqual(startOfDay(date(2026, 11, 15)))
  })
})

describe("Subscriptions", () => {
  const card = crypto.randomUUID()
  const charge = (description: string, day: string, options: { category?: string; card?: string; status?: "confirmed" | "planned" } = {}) => {
    const [y, mo, da] = day.split("-").map(Number) as [number, number, number]
    return transaction({ description, amount: "10", date: date(y, mo, da), category: options.category ?? "tools", card: options.card ?? card, rate: single("USD"), ...(options.status ? { status: options.status } : {}) })
  }

  it("repeated monthly charges and the subscriptions category count", () => {
    const found = subscriptionsCharged(card, [
      charge("OpenAI", "2026-09-30"),
      charge("openai ", "2026-10-20"),
      charge("Apple Music", "2026-10-01", { category: "subscriptions" }),
      charge("Amazon Digital", "2026-10-28"),
      charge("Higgsfield", "2026-10-10"),
      charge("Higgsfield", "2026-10-11"),
    ])
    expect(found).toEqual(["openai ", "Apple Music"])
  })

  it("other cards and planned charges don't count", () => {
    expect(
      subscriptionsCharged(card, [
        charge("Netflix", "2026-09-05", { category: "subscriptions", card: crypto.randomUUID() }),
        charge("Spotify", "2026-11-05", { category: "subscriptions", status: "planned" }),
      ]),
    ).toEqual([])
  })
})

describe("Settings", () => {
  it("defaults to USD with rate one", () => {
    const settings = currencySettings()
    expect(settings).toEqual({ principal: "USD", rate: "1" })
    expect(settingsRate(settings)).toEqual(singleRate("USD"))
  })

  it("a second currency's rate is stored on new transactions", () => {
    expect(settingsRate(currencySettings("USD", "NIO", "36.6243"))).toEqual(usdNio)
  })

  it("rejects a non-positive rate", () => {
    expectDomainError(() => currencySettings("USD", "NIO", 0), "invalidExchangeRate")
  })

  it("a second equal to the principal means single currency", () => {
    expect(currencySettings("USD", "USD", 5)).toEqual({ principal: "USD", rate: "1" })
  })

  it("app settings defaults match the design", () => {
    expect(DEFAULT_SETTINGS.unlockMethod).toBe("biometrics")
    expect(DEFAULT_SETTINGS.relockAfterSeconds).toBe(60)
    expect(DEFAULT_SETTINGS.hidesAmountsInAppSwitcher).toBe(true)
    expect(DEFAULT_SETTINGS.isICloudBackupEnabled).toBe(true)
    expect(DEFAULT_SETTINGS.paymentReminderDaysBefore).toBe(3)
  })

  it("swapping makes the second currency main and turns the rate around", () => {
    const swapped = swappedCurrencies(currencySettings("USD", "NIO", "36.6243"))!
    expect(swapped.principal).toBe("NIO")
    expect(swapped.second).toBe("USD")
    expect(rounded(d(swapped.rate), 6).toFixed()).toBe("0.027304")
    const back = swappedCurrencies(swapped)!
    expect(back.principal).toBe("USD")
    expect(rounded(d(back.rate), 6).toFixed()).toBe("36.6243")
  })

  it("a single currency has nothing to swap", () => {
    expect(swappedCurrencies(currencySettings("USD"))).toBeUndefined()
  })

  it("past movements convert the same after swapping", () => {
    const lunch = transaction({ amount: "250", currency: "NIO", actualDebited: "6.83", category: "restaurants" })
    expect(amountIn(lunch, "USD").toFixed()).toBe("6.83")
    expect(amountIn(lunch, "NIO").toFixed()).toBe("250")
  })
})

describe("Money and exchange rate", () => {
  it("adds the same currency and refuses to mix", () => {
    expect(addMoney(m("10.25", "USD"), m("4.75", "USD")).amount.toFixed()).toBe("15")
    expectDomainError(() => addMoney(m(10, "USD"), m(366, "NIO")), "currencyMismatch")
    expect(subtractMoney(m(10, "NIO"), m("12.5", "NIO")).amount.toFixed()).toBe("-2.5")
  })

  it("normalizes currency codes", () => {
    expect(normalizedCurrency(" nio ")).toBe("NIO")
    expectDomainError(() => normalizedCurrency("XYZ1"), "invalidCurrency")
  })

  it("rejects non-positive rates", () => {
    expectDomainError(() => exchangeRate("USD", "NIO", 0), "invalidExchangeRate")
    expectDomainError(() => exchangeRate("USD", "NIO", -1), "invalidExchangeRate")
  })

  it("converts both ways, same currency is identity, others throw", () => {
    expect(cents(convert(m(8420, "NIO"), usdNio, "USD").amount)).toBe("229.90")
    expect(convert(m(100, "USD"), usdNio, "NIO").amount.toFixed()).toBe("3662.43")
    expect(convert(m(5, "USD"), usdNio, "USD").amount.toFixed()).toBe("5")
    expectDomainError(() => convert(m(5, "EUR"), usdNio, "USD"), "currencyMismatch")
  })
})

describe("Entities", () => {
  it("default categories match the handoff", () => {
    expect(DEFAULT_EXPENSE_CATEGORIES).toHaveLength(23)
    expect(DEFAULT_INCOME_CATEGORIES).toHaveLength(9)
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.id)).size).toBe(DEFAULT_CATEGORIES.length)
  })

  it.each([0, 32, -1])("credit terms reject day %i", (day) => {
    expectDomainError(() => makeCreditTerms("dual", undefined, day), "invalidDayOfMonth")
    expectDomainError(() => makeCreditTerms("dual", undefined, undefined, day), "invalidDayOfMonth")
    expectDomainError(() => checkDayOfMonth(day), "invalidDayOfMonth")
  })

  it("credit terms accept the day range", () => {
    expect(makeCreditTerms("dual", undefined, 31, 1).cutoffDay).toBe(31)
  })

  it.each([
    ["0.125", 2, "0.12"],
    ["0.135", 2, "0.14"],
    ["-0.125", 2, "-0.12"],
    ["2.5", 0, "2"],
  ] as const)("rounding %s defaults to banker's", (value, scale, expected) => {
    expect(rounded(d(value), scale).toFixed()).toBe(expected)
  })

  it("rounding half up is still available", () => {
    expect(roundedHalfUp(d("0.125"), 2).toFixed()).toBe("0.13")
  })

  it.each([
    ["0", undefined],
    ["-50", undefined],
    ["10", "0"],
    ["10", "-1"],
  ] as const)("amount %s (debited %s) must be positive", (amount, debited) => {
    expectDomainError(() => checkAmounts(d(amount), debited === undefined ? undefined : d(debited)), "invalidAmount")
  })

  it("positive amounts pass", () => {
    expect(() => checkAmounts(d("0.01"))).not.toThrow()
    expect(() => checkAmounts(d("879"), d("24.28"))).not.toThrow()
  })

  it.each(["123", "12345", "12a4", "١٢٣٤"])("a card rejects last four %s", (value) => {
    expectDomainError(() => checkLastFour(value), "invalidLastFour")
    expectDomainError(() => makeCard({ accountId: crypto.randomUUID(), kind: "debit", lastFour: value }), "invalidLastFour")
  })

  it.each([
    [0, 2028],
    [13, 2028],
    [5, 28],
  ])("expiry %i/%i needs a real month and full year", (month, year) => {
    expectDomainError(() => cardExpiry(month, year), "invalidExpiry")
  })

  it("expiry reminds on the first of its month", () => {
    const day = expiryReminderDay(cardExpiry(5, 2029))
    expect([day.getFullYear(), day.getMonth() + 1, day.getDate()]).toEqual([2029, 5, 1])
    expect(compareExpiry(cardExpiry(2, 2028), cardExpiry(9, 2028))).toBeLessThan(0)
  })
})
