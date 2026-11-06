// The end-of-month balance forecast and subscription price increases. The forecast fixture and its
// expected numbers are shared with keepwell-ios DomainTests/BalanceForecastTests.swift, and the price
// increases with PriceIncreaseTests.swift, so both platforms compute the same thing.
import { describe, expect, it } from "vitest"

import {
  SUBSCRIPTIONS_CATEGORY_ID,
  balanceForecast,
  cardAmountDue,
  dayKey,
  forecastPlannedExpenses,
  forecastPlannedIncome,
  forecastTotal,
  priceIncreases,
  statementCutoff,
} from "@/lib/domain"
import type { Account, AccountKind, CurrencySettings, RecurringFrequency, RecurringRule, Transaction, TransactionKind } from "@/lib/schema"

import { date, transaction } from "./fixtures"

describe("Balance forecast", () => {
  // Today is Nov 6 2026 (30 days, 24 left), in America/Managua like the iOS fixture.
  const now = date(2026, 11, 6)
  const rate = { principal: "USD", second: "NIO", rate: "36.5" }
  const settings: CurrencySettings = { principal: "USD", second: "NIO", rate: "36.5" }
  const IDs = { bank: crypto.randomUUID(), wallet: crypto.randomUUID(), visa: crypto.randomUUID(), mastercard: crypto.randomUUID(), diners: crypto.randomUUID() }

  const account = (id: string, kind: AccountKind, opening: string, currency: string, terms: { cutoff?: number; due?: number } = {}): Account => ({
    id,
    name: kind,
    kind,
    openingBalances: [{ amount: opening, currency }],
    openingDate: date(2026, 7, 1, 0).toISOString(),
    ...(kind === "credit"
      ? { creditTerms: { debtMode: "principal" as const, ...(terms.cutoff ? { cutoffDay: terms.cutoff } : {}), ...(terms.due ? { dueDay: terms.due } : {}) } }
      : {}),
  })

  const movement = (
    kind: TransactionKind,
    amount: string,
    on: Date,
    options: { currency?: string; from?: string; to?: string; planned?: boolean; rule?: string } = {},
  ): Transaction => ({
    ...transaction({
      kind,
      amount,
      date: on,
      currency: options.currency ?? "USD",
      account: options.from ?? IDs.bank,
      ...(options.to ? { destination: options.to } : {}),
      status: options.planned ? "planned" : "confirmed",
      rate,
    }),
    ...(options.rule ? { recurringId: options.rule } : {}),
  })

  const rule = (
    kind: TransactionKind,
    amount: string,
    start: Date,
    next: Date,
    options: { currency?: string; from?: string; frequency?: RecurringFrequency; end?: Date; paused?: boolean } = {},
  ): RecurringRule => ({
    id: crypto.randomUUID(),
    name: "Rule",
    kind,
    ...(kind === "transfer" ? { destinationAccountId: IDs.wallet } : { categoryId: "other-expense" }),
    amount,
    currency: options.currency ?? "USD",
    accountId: options.from ?? IDs.bank,
    frequency: options.frequency ?? "monthly",
    interval: 1,
    startDate: start.toISOString(),
    nextDate: next.toISOString(),
    ...(options.end ? { endDate: options.end.toISOString() } : {}),
    isSubscription: false,
    autoConfirm: false,
    isPaused: options.paused ?? false,
  })

  const accounts = [
    account(IDs.bank, "deposit", "5000", "USD"),
    account(IDs.wallet, "cash", "3650", "NIO"),
    account(IDs.visa, "credit", "0", "USD", { cutoff: 20, due: 10 }),
    account(IDs.mastercard, "credit", "0", "USD", { cutoff: 25, due: 3 }),
    account(IDs.diners, "credit", "0", "USD"),
  ]
  const transactions = [
    // History: July is outside the three complete months; rule charges and cards don't count.
    movement("expense", "1000", date(2026, 7, 15)),
    movement("expense", "300", date(2026, 8, 10)),
    movement("expense", "580", date(2026, 9, 10)),
    movement("expense", "730", date(2026, 9, 12), { currency: "NIO", from: IDs.wallet }),
    movement("expense", "900", date(2026, 10, 10)),
    movement("expense", "50", date(2026, 10, 1), { rule: crypto.randomUUID() }),
    movement("expense", "400", date(2026, 10, 5), { from: IDs.visa }),
    movement("expense", "100", date(2026, 10, 25), { from: IDs.visa }),
    movement("expense", "200", date(2026, 10, 26), { from: IDs.mastercard }),
    movement("expense", "60", date(2026, 10, 8), { from: IDs.diners }),
    movement("income", "2000", date(2026, 10, 30)),
    movement("transfer", "150", date(2026, 11, 2), { to: IDs.visa }),
    movement("expense", "70", date(2026, 11, 3)),
    // Drafts: only today through Nov 30, on bank and cash, and not transfers.
    movement("expense", "120", date(2026, 11, 20), { planned: true }),
    movement("expense", "1825", date(2026, 11, 25), { currency: "NIO", from: IDs.wallet, planned: true }),
    movement("income", "300", date(2026, 11, 15), { planned: true }),
    movement("expense", "999", date(2026, 12, 2), { planned: true }),
    movement("expense", "77", date(2026, 11, 1), { planned: true }),
    movement("expense", "40", date(2026, 11, 18), { from: IDs.visa, planned: true }),
    movement("transfer", "100", date(2026, 11, 21), { to: IDs.wallet, planned: true }),
  ]
  const rules = [
    rule("expense", "500", date(2026, 1, 28), date(2026, 11, 28)),
    rule("expense", "10", date(2026, 10, 2), date(2026, 11, 13), { frequency: "weekly" }),
    rule("income", "200", date(2026, 6, 30), date(2026, 11, 30)),
    rule("expense", "365", date(2026, 1, 9), date(2026, 11, 9), { currency: "NIO", from: IDs.wallet }),
    rule("expense", "15", date(2026, 1, 12), date(2026, 11, 12), { from: IDs.visa }),
    rule("expense", "1000", date(2026, 1, 20), date(2026, 11, 20), { paused: true }),
    rule("expense", "1000", date(2026, 1, 8), date(2026, 11, 8), { end: date(2026, 10, 31) }),
    rule("transfer", "100", date(2026, 1, 15), date(2026, 11, 15)),
  ]

  it("forecasts the shared fixture", () => {
    const forecast = balanceForecast(accounts, transactions, rules, settings, now)
    expect(forecast.currency).toBe("USD")
    expect(forecast.availableToday.toString()).toBe("4030")
    expect(forecast.draftIncome.toString()).toBe("300")
    expect(forecast.draftExpenses.toString()).toBe("170")
    expect(forecast.recurringIncome.toString()).toBe("200")
    expect(forecast.recurringExpenses.toString()).toBe("540")
    expect(forecastPlannedIncome(forecast).toString()).toBe("500")
    expect(forecastPlannedExpenses(forecast).toString()).toBe("710")
    expect(forecast.cardPayments.toString()).toBe("250")
    expect(forecast.usualSpending.toString()).toBe("480")
    expect(forecastTotal(forecast).toString()).toBe("3090")
  })

  it("the statement is what closed less what was paid since", () => {
    const due = date(2026, 11, 10, 0)
    expect(cardAmountDue(due, accounts[2]!, transactions, settings).toString()).toBe("250")
    // Without a cutoff day the whole debt is due.
    expect(cardAmountDue(due, accounts[4]!, transactions, settings).toString()).toBe("60")
  })

  it("the statement cutoff is the last one before the due day", () => {
    expect(dayKey(statementCutoff(date(2026, 11, 10), 20))).toBe("2026-10-20")
    expect(dayKey(statementCutoff(date(2026, 11, 25), 5))).toBe("2026-11-05")
  })

  it("usual spending averages only months with spending", () => {
    const forecast = balanceForecast([account(IDs.bank, "deposit", "0", "USD")], [movement("expense", "600", date(2026, 10, 10))], [], settings, now)
    expect(forecast.usualSpending.toString()).toBe("480")
    expect(forecastTotal(forecast).toString()).toBe("-1080")
  })
})

describe("Price increases", () => {
  const now = date(2026, 11, 6)
  const card = crypto.randomUUID()
  const charge = (
    description: string,
    amount: string,
    on: Date,
    options: { currency?: string; category?: string; card?: string; rule?: string; planned?: boolean } = {},
  ): Transaction => ({
    ...transaction({
      description,
      amount,
      date: on,
      currency: options.currency ?? "USD",
      category: options.category ?? "tools",
      card: options.card ?? card,
      status: options.planned ? "planned" : "confirmed",
      rate: { principal: options.currency ?? "USD", second: options.currency ?? "USD", rate: "1" },
    }),
    ...(options.rule ? { recurringId: options.rule } : {}),
  })

  it("finds services whose newest charge costs more", () => {
    const rule = crypto.randomUUID()
    const found = priceIncreases(
      [
        // A rule's charges, whatever their description or card.
        charge("Gym", "30", date(2026, 9, 10), { card: crypto.randomUUID(), rule }),
        charge("Gym club", "35", date(2026, 10, 10), { rule }),
        // Recognized by the card and description: two months.
        charge("Netflix", "9.99", date(2026, 9, 20)),
        charge("netflix ", "12.99", date(2026, 10, 20)),
        // In the Subscriptions category: cheaper now.
        charge("Spotify", "11", date(2026, 9, 1), { category: SUBSCRIPTIONS_CATEGORY_ID }),
        charge("Spotify", "10", date(2026, 10, 1), { category: SUBSCRIPTIONS_CATEGORY_ID }),
        // Currencies differ.
        charge("iCloud", "1", date(2026, 9, 15)),
        charge("iCloud", "40", date(2026, 10, 15), { currency: "NIO" }),
        // Went up, but too long ago.
        charge("Dropbox", "10", date(2026, 8, 1)),
        charge("Dropbox", "12", date(2026, 9, 1)),
        // A draft doesn't count.
        charge("Disney", "8", date(2026, 9, 25)),
        charge("Disney", "8", date(2026, 10, 25)),
        charge("Disney", "11", date(2026, 11, 25), { planned: true }),
        // Same month, one-off purchases on the same card aren't a service.
        charge("Hardware store", "5", date(2026, 10, 10)),
        charge("Hardware store", "50", date(2026, 10, 11)),
      ],
      now,
    )
    expect(found.map((increase) => increase.name)).toEqual(["netflix ", "Gym club"])
    expect(found[0]?.previous.amount.toString()).toBe("9.99")
    expect(found[0]?.current.amount.toString()).toBe("12.99")
    expect(found[1]?.previous.amount.toString()).toBe("30")
  })
})
