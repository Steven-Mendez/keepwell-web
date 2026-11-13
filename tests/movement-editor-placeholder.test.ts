// An expense or income without a category is saved in "Other", so its description placeholder (what
// gets stored when the description is left empty) says so instead of "Transfer".
import { describe, expect, it } from "vitest"

import { descriptionPlaceholder } from "@/components/movement-editor/editor-model"
import { makeTranslator } from "@/lib/i18n"

describe("the description placeholder", () => {
  it("reads as the fallback category until one is chosen", () => {
    const en = makeTranslator("en")
    const es = makeTranslator("es")
    expect(descriptionPlaceholder(en, "expense", undefined)).toBe("Other")
    expect(descriptionPlaceholder(en, "income", undefined)).toBe("Other income")
    expect(descriptionPlaceholder(es, "expense", undefined)).not.toBe("Transferencia")
    expect(descriptionPlaceholder(en, "expense", "Groceries")).toBe("Groceries")
    expect(descriptionPlaceholder(en, "transfer", undefined)).toBe("Transfer")
  })
})
