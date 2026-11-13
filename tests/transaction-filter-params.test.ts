import { describe, expect, it } from "vitest"

import {
  NO_FILTERS,
  amountChipLabel,
  readFilterParams,
  writeFilterParams,
  type ListFilters,
} from "@/components/transactions/filter-params"
import { dec } from "@/lib/domain"

const roundTrip = (filters: ListFilters) =>
  readFilterParams(new URLSearchParams(writeFilterParams(new URLSearchParams(), filters).toString()))

describe("transaction list filters in the URL", () => {
  it("round-trips min, max, origin and rule with the kind and account", () => {
    const filters: ListFilters = {
      filter: "expense",
      scope: { kind: "account", id: "a1" },
      amount: { min: dec("100"), max: dec("500.5") },
      origin: { kind: "subscriptions" },
    }
    const read = roundTrip(filters)
    expect(read.filter).toBe("expense")
    expect(read.scope).toEqual({ kind: "account", id: "a1" })
    expect(read.amount.min?.toFixed()).toBe("100")
    expect(read.amount.max?.toFixed()).toBe("500.5")
    expect(read.origin).toEqual({ kind: "subscriptions" })
    expect(roundTrip({ ...NO_FILTERS, origin: { kind: "rule", id: "r1" } }).origin).toEqual({ kind: "rule", id: "r1" })
    expect(writeFilterParams(new URLSearchParams(), { ...NO_FILTERS, amount: { min: dec(100) }, origin: { kind: "rule", id: "r1" } }).toString()).toBe("min=100&rule=r1")
  })

  it("writes nothing for the defaults and keeps other parameters", () => {
    expect(writeFilterParams(new URLSearchParams("id=x&min=5&origin=subscriptions"), NO_FILTERS).toString()).toBe("id=x")
  })

  it("reads a bad or missing value as no filter", () => {
    const read = readFilterParams(new URLSearchParams("min=abc&max=-3&origin=other&filter=nope"))
    expect(read.amount).toEqual({})
    expect(read.origin).toEqual({ kind: "any" })
    expect(read.filter).toBe("all")
  })

  it("labels the active amount chip", () => {
    expect(amountChipLabel({ min: dec(100) }, "NIO")).toBe("≥ C$100")
    expect(amountChipLabel({ max: dec("500.5") }, "NIO")).toBe("≤ C$500.50")
    expect(amountChipLabel({ min: dec(100), max: dec(500) }, "NIO")).toBe("C$100 – 500")
    expect(amountChipLabel({}, "NIO")).toBeUndefined()
  })
})
