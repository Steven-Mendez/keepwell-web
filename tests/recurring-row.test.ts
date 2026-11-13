// How a Recurring row reads while a draft it made waits: today's "to confirm", older ones overdue.
import { describe, expect, it } from "vitest"

import { pendingDraftText } from "@/components/recurring/recurring-format"
import type { PendingRuleDraft } from "@/lib/domain"
import { makeTranslator } from "@/lib/i18n"

import { date, transaction } from "./domain/fixtures"

const now = date(2026, 11, 12, 15)
const pending = (day: Date, daysOverdue: number): PendingRuleDraft => ({
  transaction: transaction({ amount: "5.99", status: "planned", date: day }),
  daysOverdue,
})

describe("Recurring row with a pending draft", () => {
  it("today's draft waits to be confirmed, with its date", () => {
    expect(pendingDraftText(makeTranslator("en"), pending(date(2026, 11, 12), 0), now)).toBe("To confirm · Nov 12")
    expect(pendingDraftText(makeTranslator("es"), pending(date(2026, 11, 12), 0), now)).toBe("Por confirmar · 12 nov")
  })

  it("an older one is overdue by days, with plurals", () => {
    expect(pendingDraftText(makeTranslator("en"), pending(date(2026, 11, 11), 1), now)).toBe("Overdue · 1 day")
    expect(pendingDraftText(makeTranslator("en"), pending(date(2026, 11, 9), 3), now)).toBe("Overdue · 3 days")
    expect(pendingDraftText(makeTranslator("es"), pending(date(2026, 11, 11), 1), now)).toBe("Atrasado · 1 día")
    expect(pendingDraftText(makeTranslator("es"), pending(date(2026, 11, 9), 3), now)).toBe("Atrasado · 3 días")
  })
})
