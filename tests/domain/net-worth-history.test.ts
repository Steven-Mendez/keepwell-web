// Net worth month by month. The fixture and its expected numbers are shared with keepwell-ios
// DomainTests/NetWorthHistoryTests.swift, so both platforms draw the same line.
import { describe, expect, it } from "vitest"

import { monthKey, netWorthChange, netWorthHistory } from "@/lib/domain"
import type { Account, AccountKind, CurrencySettings, ExchangeRate, Transaction, TransactionKind } from "@/lib/schema"

import { date, transaction } from "./fixtures"

describe("Net worth history", () => {
  // Today is Nov 6 2026, in America/Managua like the iOS fixture; 36.5 NIO per USD, and October's
  // last confirmed movement was recorded at 36 NIO per USD.
  const now = date(2026, 11, 6)
  const rate = { principal: "USD", second: "NIO", rate: "36.5" }
  const settings: CurrencySettings = { principal: "USD", second: "NIO", rate: "36.5" }
  const IDs = { bank: crypto.randomUUID(), visa: crypto.randomUUID(), wallet: crypto.randomUUID() }

  const account = (id: string, kind: AccountKind, opening: string, currency: string, opened: Date): Account => ({
    id,
    name: kind,
    kind,
    openingBalances: [{ amount: opening, currency }],
    openingDate: opened.toISOString(),
    ...(kind === "credit" ? { creditTerms: { debtMode: "principal" as const } } : {}),
  })

  const movement = (
    kind: TransactionKind,
    amount: string,
    on: Date,
    options: { currency?: string; from?: string; to?: string; planned?: boolean; rate?: ExchangeRate } = {},
  ): Transaction =>
    transaction({
      kind,
      amount,
      date: on,
      currency: options.currency ?? "USD",
      account: options.from ?? IDs.bank,
      ...(options.to ? { destination: options.to } : {}),
      status: options.planned ? "planned" : "confirmed",
      rate: options.rate ?? rate,
    })
  const usdNio = (value: string): ExchangeRate => ({ principal: "USD", second: "NIO", rate: value })

  const accounts = [
    account(IDs.bank, "deposit", "1000", "USD", date(2026, 7, 15, 0)),
    account(IDs.visa, "credit", "-200", "USD", date(2026, 9, 1, 0)),
    account(IDs.wallet, "cash", "3650", "NIO", date(2026, 10, 10, 0)),
  ]
  const transactions = [
    // Before the bank's opening day: already part of its opening balance.
    movement("expense", "50", date(2026, 7, 10)),
    movement("income", "500", date(2026, 7, 20)),
    movement("expense", "300", date(2026, 8, 5)),
    movement("expense", "120", date(2026, 9, 3), { from: IDs.visa }),
    // The last hour of September still belongs to September.
    movement("expense", "80", date(2026, 9, 30, 23)),
    movement("transfer", "100", date(2026, 10, 1, 0), { to: IDs.visa }),
    // October's rate: its last confirmed movement's. The planned one after it doesn't count.
    movement("expense", "365", date(2026, 10, 12), { currency: "NIO", from: IDs.wallet, rate: usdNio("36") }),
    movement("expense", "1000", date(2026, 10, 20), { planned: true, rate: usdNio("40") }),
    movement("expense", "100", date(2026, 11, 2), { currency: "NIO", from: IDs.wallet }),
    movement("income", "200", date(2026, 11, 3)),
    // Later today counts; later this month doesn't yet. A single-currency rate is skipped, so
    // November takes November 3's.
    movement("expense", "10", date(2026, 11, 6, 20), { rate: { principal: "USD", second: "USD", rate: "1" } }),
    movement("expense", "50", date(2026, 11, 20), { rate: usdNio("40") }),
  ]

  it("values each month end at its rate", () => {
    const points = netWorthHistory(accounts, transactions, settings, now)
    // Months before July, when the first account opened, are left out.
    expect(points.map((point) => monthKey(point.month))).toEqual(["2026-07", "2026-08", "2026-09", "2026-10", "2026-11"])
    expect(points.every((point) => point.total.currency === "USD")).toBe(true)
    expect(points.map((point) => point.total.amount.toDecimalPlaces(2).toFixed(2))).toEqual(["1500.00", "1200.00", "800.00", "891.25", "1077.26"])
    expect(netWorthChange(points)?.toDecimalPlaces(2).toFixed(2)).toBe("-422.74")
  })

  it("keeps the last twelve months", () => {
    const points = netWorthHistory([account(IDs.bank, "deposit", "100", "USD", date(2024, 3, 1, 0))], [], settings, now)
    expect(points).toHaveLength(12)
    expect(monthKey(points[0]!.month)).toBe("2025-12")
    expect(monthKey(points.at(-1)!.month)).toBe("2026-11")
    expect(points.every((point) => point.total.amount.eq(100))).toBe(true)
    expect(netWorthChange(points)?.toNumber()).toBe(0)
    expect(netWorthChange(points.slice(0, 1))).toBeUndefined()
  })

  it("falls back to today's rate without movements", () => {
    const points = netWorthHistory([account(IDs.wallet, "cash", "3650", "NIO", date(2026, 10, 1, 0))], [], settings, now)
    expect(points.map((point) => point.total.amount.toFixed(2))).toEqual(["100.00", "100.00"])
  })

  it("has no months without accounts", () => {
    expect(netWorthHistory([], [], settings, now)).toEqual([])
  })
})
