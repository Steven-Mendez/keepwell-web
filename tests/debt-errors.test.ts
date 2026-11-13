// The debt editor outlines the field a save failed on: a due date before the debt's date marks the
// due date, not the amount.
import { describe, expect, it } from "vitest"

import { debtError } from "@/components/debts/debt-dialogs"
import { DomainError } from "@/lib/domain"
import { makeTranslator } from "@/lib/i18n"

const t = makeTranslator("en")

describe("a debt that can't be saved", () => {
  it("points at the field the error is about", () => {
    expect(debtError(t, DomainError.invalidDueDate())).toEqual({ message: "The due date can't be before the debt's date.", field: "dueDate" })
    expect(debtError(t, DomainError.invalidAmount()).field).toBe("amount")
    expect(debtError(t, DomainError.missingName()).field).toBe("person")
    expect(debtError(t, new Error("disk")).field).toBeUndefined()
  })
})
