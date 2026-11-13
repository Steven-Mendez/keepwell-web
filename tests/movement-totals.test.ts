import { describe, expect, it } from "vitest"

import { movementTotals } from "@/components/transactions/movement-totals"

import { single, transaction } from "./domain/fixtures"

describe("Movements totals strip after the main currency changes", () => {
  it("converts with each stored rate and leaves out what it can't, as the monthly summary", () => {
    const totals = movementTotals(
      [
        transaction({ amount: "100" }),
        transaction({ amount: "250", currency: "NIO" }),
        transaction({
          kind: "income",
          amount: "9",
          currency: "EUR",
          rate: single("EUR"),
          category: "salary",
        }),
      ],
      "EUR"
    )
    expect(totals.moneyOut.toFixed()).toBe("0")
    expect(totals.moneyIn.toFixed()).toBe("9")
    expect(totals.excluded).toEqual([
      { currency: "NIO", count: 1 },
      { currency: "USD", count: 1 },
    ])
  })

  it("matches the summary when the stored rate reaches the main currency", () => {
    const totals = movementTotals(
      [
        transaction({ amount: "100" }),
        transaction({ amount: "250", currency: "NIO" }),
      ],
      "NIO"
    )
    expect(totals.moneyOut.toFixed(2)).toBe("3912.43")
    expect(totals.excluded).toEqual([])
  })
})
