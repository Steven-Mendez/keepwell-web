// Notifications (ADR 0012 in keepwell-api): ids per occurrence, the inbox with read and deleted
// state, and how each one reads.
import "fake-indexeddb/auto"

import { beforeEach, describe, expect, it } from "vitest"

import { buildInbox } from "@/components/notifications/notifications"
import { db } from "@/lib/db"
import { ledgerNotifications, loadLedger, notificationDay } from "@/lib/domain"
import { makeTranslator } from "@/lib/i18n"
import { notificationStateRepository } from "@/lib/repositories"
import type { RecurringRule } from "@/lib/schema"

import { IDs, referenceDate, sampleStore, ZONE } from "./domain/fixtures"

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

describe("ledgerNotifications", () => {
  it("names each card payment by its due day, so next month's is a new notification", async () => {
    const ledger = await loadLedger(sampleStore())
    // The sample's Visa is due on the 15th.
    const november = ledgerNotifications(ledger, new Date(2026, 10, 13, 12)).find((n) => n.kind === "payment")
    const december = ledgerNotifications(ledger, new Date(2026, 11, 13, 12)).find((n) => n.kind === "payment")
    expect(november?.id).toBe(`payment:${IDs.visa}:2026-11-15`)
    expect(december?.id).toBe(`payment:${IDs.visa}:2026-12-15`)
  })

  it("gives the same ids on any hour of the same day", async () => {
    const ledger = await loadLedger(sampleStore())
    const ids = (now: Date) => ledgerNotifications(ledger, now).map((n) => n.id).sort()
    expect(ids(new Date(2026, 10, 13, 0, 5))).toEqual(ids(new Date(2026, 10, 13, 23, 55)))
  })

  it("lists assistant proposals that are still paused, and only those", async () => {
    const ledger = await loadLedger(sampleStore())
    const withRules = {
      ...ledger,
      recurringRules: [proposal(), proposal({ id: "rule-2", isPaused: false }), proposal({ id: "rule-3", source: "app" })],
    }
    const proposals = ledgerNotifications(withRules, new Date(2026, 9, 25, 12)).filter((n) => n.kind === "proposal")
    expect(proposals.map((n) => n.id)).toEqual(["proposal:rule-1"])
  })

  it("reminds the day before a recurring expense recorded as a draft, and not one recorded on its own or an income", async () => {
    const ledger = await loadLedger(sampleStore())
    const now = new Date(2026, 10, 12, 12)
    const due = new Date(2026, 10, 13, 9).toISOString()
    const rule = (id: string, overrides: Partial<RecurringRule>) =>
      proposal({ id, name: "Rent", source: "app", isPaused: false, startDate: due, nextDate: due, ...overrides })
    const withRules = {
      ...ledger,
      recurringRules: [
        rule("rent", {}),
        rule("auto", { autoConfirm: true }),
        rule("salary", { kind: "income" }),
        rule("gym", { isSubscription: true }),
        rule("later", { startDate: new Date(2026, 10, 14, 9).toISOString(), nextDate: new Date(2026, 10, 14, 9).toISOString() }),
      ],
    }
    const found = ledgerNotifications(withRules, now).filter((n) => n.kind === "bill" || n.kind === "renewal")
    expect(found.map((n) => n.id).sort()).toEqual(["bill:rent:2026-11-13", "renewal:gym:2026-11-13"])
    const bill = found.find((n) => n.kind === "bill")
    // A target every installed app already decodes, so an older app still opens a pushed bill.
    expect(bill?.target).toEqual({ screen: "recurring" })
    expect(bill?.date).toEqual(new Date(2026, 10, 12))

    const inbox = buildInbox(t, withRules, [], now, false)
    const entry = inbox.entries.find((candidate) => candidate.notification.kind === "bill")
    expect(entry?.title).toBe("Rent is due tomorrow")
    expect(buildInbox(makeTranslator("es"), withRules, [], now, false).entries.find((candidate) => candidate.notification.kind === "bill")?.title).toBe(
      "Rent vence mañana"
    )
  })

  it("reads the day back from an id, for pruning", () => {
    expect(notificationDay("bill:x:2026-11-13", ZONE)).toEqual(new Date(2026, 10, 13))
    expect(notificationDay("payment:x:2026-11-15", ZONE)).toEqual(new Date(2026, 10, 15))
    expect(notificationDay("expiry:x:2026-11", ZONE)).toEqual(new Date(2026, 10, 1))
    expect(notificationDay("budget:groceries:2026-11:near", ZONE)).toEqual(new Date(2026, 10, 1))
    expect(notificationDay("installment:x:3", ZONE)).toBeUndefined()
  })
})

describe("Inbox", () => {
  beforeEach(async () => {
    await db.notification_states.clear()
    await db.sync_outbox.clear()
  })

  it("leaves drafts to Home and says a payment is due today on its due day", async () => {
    const ledger = await loadLedger(sampleStore())
    const inbox = buildInbox(t, ledger, [], new Date(2026, 10, 15, 12), false)
    expect(inbox.entries.some((entry) => entry.notification.kind === "planned")).toBe(false)
    expect(inbox.entries.find((entry) => entry.notification.kind === "payment")?.title).toMatch(/: due today$/)
    expect(inbox.unread).toBe(inbox.entries.length)
  })

  it("marks read, unread, deletes and restores, and every change goes to the outbox", async () => {
    const ledger = await loadLedger(sampleStore())
    const now = new Date(2026, 10, 13, 12)
    const id = `payment:${IDs.visa}:2026-11-15`
    const inbox = async () => buildInbox(t, ledger, await notificationStateRepository.list(), now, false)

    await notificationStateRepository.markRead([id])
    expect((await inbox()).entries.find((entry) => entry.notification.id === id)?.read).toBe(true)

    await notificationStateRepository.markUnread([id])
    expect((await inbox()).entries.find((entry) => entry.notification.id === id)?.read).toBe(false)

    await notificationStateRepository.dismiss([id])
    expect((await inbox()).entries.some((entry) => entry.notification.id === id)).toBe(false)

    await notificationStateRepository.restore([id])
    const restored = (await inbox()).entries.find((entry) => entry.notification.id === id)
    expect(restored?.read).toBe(true)

    const events = await db.sync_outbox.orderBy("created_at").toArray()
    expect(events.map((event) => [event.entity, event.operation])).toEqual([
      ["notificationState", "create"],
      ["notificationState", "update"],
      ["notificationState", "update"],
      ["notificationState", "update"],
    ])
  })

  it("doesn't write when nothing changes", async () => {
    await notificationStateRepository.markRead(["price:x"])
    await notificationStateRepository.markRead(["price:x"])
    expect(await db.sync_outbox.count()).toBe(1)
  })

  it("tombstones state rows whose day is long past", async () => {
    await notificationStateRepository.markRead(["payment:a:2026-01-15", "payment:a:2026-11-15", "price:x"])
    await notificationStateRepository.prune(new Date(2026, 10, 20))
    expect((await notificationStateRepository.list()).map((state) => state.id).sort()).toEqual(["payment:a:2026-11-15", "price:x"])
  })
})
