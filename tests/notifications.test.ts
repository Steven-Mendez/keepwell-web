// The bell's and the Notifications page's content: reminders that apply now plus Claude's proposals,
// never the drafts (Home keeps those).
import { describe, expect, it } from "vitest"

import { buildNotifications, proposedRules } from "@/components/notifications/notifications"
import { loadLedger } from "@/lib/domain"
import { makeTranslator } from "@/lib/i18n"
import type { RecurringRule } from "@/lib/schema"

import { IDs, referenceDate, sampleStore } from "./domain/fixtures"

const t = makeTranslator("en")

const proposal = (overrides: Partial<RecurringRule> = {}): RecurringRule =>
  ({
    id: "rule-1",
    name: "Gym",
    kind: "expense",
    amount: "30",
    currency: "USD",
    frequency: "monthly",
    interval: 1,
    startDate: referenceDate.toISOString(),
    nextDate: referenceDate.toISOString(),
    autoConfirm: false,
    accountId: IDs.savings,
    isPaused: true,
    isSubscription: false,
    source: "mcp",
    ...overrides,
  }) as RecurringRule

describe("Notifications", () => {
  it("leaves drafts out and keeps what applies now", async () => {
    const store = sampleStore()
    const ledger = await loadLedger(store)
    // The sample has drafts due on the 24th and later; on the 25th they are due today.
    const due = new Date(2026, 9, 25, 12)
    const result = buildNotifications(t, ledger, due, false)
    expect(result.reminders.some((reminder) => reminder.id.startsWith("planned-"))).toBe(false)
    expect(result.proposed).toEqual([])
    expect(result.count).toBe(result.reminders.length)
  })

  it("says a card payment is due today on its due day instead of in 0 days", async () => {
    const ledger = await loadLedger(sampleStore())
    // The sample's card is due on the 15th.
    const payment = (now: Date) =>
      buildNotifications(t, ledger, now, false).reminders.find((reminder) => reminder.id.startsWith("payment-"))
    expect(payment(new Date(2026, 10, 15, 12))?.title).toMatch(/: due today$/)
    expect(payment(new Date(2026, 10, 13, 12))?.title).toMatch(/: payment in 2 days$/)
  })

  it("counts proposals made through MCP that are still paused", async () => {
    const store = sampleStore()
    const ledger = await loadLedger(store)
    const withRules = {
      ...ledger,
      recurringRules: [proposal(), proposal({ id: "rule-2", isPaused: false }), proposal({ id: "rule-3", source: "app" })],
    }
    expect(proposedRules(withRules).map((rule) => rule.id)).toEqual(["rule-1"])
    const result = buildNotifications(t, withRules, new Date(2026, 9, 25, 12), false)
    expect(result.count).toBe(result.reminders.length + 1)
  })
})
