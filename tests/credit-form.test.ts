import { describe, expect, it } from "vitest"

import {
  creditAddedSummary,
  initialCreditForm,
  validateCreditForm,
} from "@/components/accounts/credit-form"
import { makeTranslator } from "@/lib/i18n/translate"

const t = makeTranslator("en")

describe("credit card form", () => {
  it("starts like iOS: Mastercard, debts at 0.00", () => {
    const form = initialCreditForm("NIO")
    expect(form).toMatchObject({
      network: "mastercard",
      principalDebt: "0.00",
      secondDebt: "0.00",
      debtMode: "dual",
    })
  })

  it("requires exactly four digits", () => {
    const form = initialCreditForm(undefined)
    expect(validateCreditForm(t, form).errors.lastFour).toBe(true)
    expect(validateCreditForm(t, { ...form, lastFour: "123" }).draft).toBeUndefined()
    expect(validateCreditForm(t, { ...form, lastFour: "1234" }).draft).toBeDefined()
  })

  it("summarizes the card like iOS", () => {
    const form = { ...initialCreditForm("NIO"), lastFour: "1234", cutoff: "28", due: "15" }
    expect(creditAddedSummary(t, form, { principal: "USD", second: "NIO" }, 3)).toBe(
      "Debt in USD and NIO · cutoff day 28 · due day 15. We'll remind you 3 days before the due date."
    )
    expect(creditAddedSummary(t, { ...form, cutoff: "", due: "" }, { principal: "USD" }, 3)).toBe(
      "Debt in USD."
    )
  })
})
