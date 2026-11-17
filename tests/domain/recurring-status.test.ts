// Whether a recurring rule is paid, what paid it and when it's next due: the Recurring rows and the
// rule's detail read this, and so does the MCP.
import { describe, expect, it } from "vitest"

import { linkPayment, materializeRecurring, paymentCandidates, recurringMonthProgress, ruleHistory, ruleStatus, unlinkPayment } from "@/lib/domain"
import { DEFAULT_SETTINGS, type RecurringRule, type Transaction } from "@/lib/schema"

import { IDs, ZONE, date, sampleStore, transaction } from "./fixtures"

const RULE_ID = "00000000-0000-0000-0000-00000000e030"
const OTHER_RULE_ID = "00000000-0000-0000-0000-00000000f030"

/** Created today (16 Nov) to start on 1 Dec, as a rule proposed from the MCP is. */
const music: RecurringRule = {
  id: RULE_ID,
  name: "Apple Music",
  kind: "expense",
  categoryId: "subscriptions",
  amount: "6.49",
  currency: "USD",
  accountId: IDs.savings,
  cardId: IDs.savingsDebit,
  frequency: "monthly",
  interval: 1,
  startDate: date(2026, 12, 1, 9).toISOString(),
  nextDate: date(2026, 12, 1, 9).toISOString(),
  isSubscription: true,
  autoConfirm: false,
  isPaused: false,
}

const TODAY = date(2026, 11, 16)

function payment(options: Partial<Parameters<typeof transaction>[0]> & { recurringId?: string | null } = {}): Transaction {
  const { recurringId, ...rest } = options
  const made = transaction({ amount: "6.49", account: IDs.savings, card: IDs.savingsDebit, category: "subscriptions", description: "APPLE.COM/BILL Apple Music", date: date(2026, 11, 1), ...rest })
  return recurringId === null ? made : { ...made, recurringId: recurringId ?? RULE_ID }
}

function storeWith(rules: RecurringRule[], transactions: Transaction[]) {
  const store = sampleStore()
  store.settings = { ...DEFAULT_SETTINGS, currencies: { principal: "USD", second: "NIO", rate: "36.6243" }, hasCompletedOnboarding: true }
  store.recurringRules = rules
  store.transactions = transactions
  return store
}

describe("ruleStatus", () => {
  it("a rule with nothing linked is upcoming, with the days left to its next date", () => {
    const status = ruleStatus(music, [], TODAY, ZONE)
    expect(status.state).toBe("upcoming")
    expect(status.nextDate?.toISOString()).toBe(music.nextDate)
    expect(status.daysUntilNext).toBe(15)
    expect(status.lastPayment).toBeUndefined()
  })

  it("a rule that hasn't started is paid once the cycle before its start has a linked payment", () => {
    const paid = payment()
    const status = ruleStatus(music, [paid], TODAY, ZONE)
    expect(status.state).toBe("paid")
    expect(status.payment?.id).toBe(paid.id)
    expect(status.cycleDate.toISOString()).toBe(date(2026, 11, 1, 9).toISOString())
    expect(status.daysUntilNext).toBe(15)
  })

  it("a payment of an earlier cycle doesn't pay this one, but stays as the last payment", () => {
    const old = payment({ date: date(2026, 10, 1) })
    const status = ruleStatus(music, [old], TODAY, ZONE)
    expect(status.state).toBe("upcoming")
    expect(status.lastPayment?.id).toBe(old.id)
  })

  it("a payment made up to two days early pays the cycle; one made for the next cycle doesn't", () => {
    expect(ruleStatus(music, [payment({ date: date(2026, 10, 30) })], TODAY, ZONE).state).toBe("paid")
    expect(ruleStatus(music, [payment({ date: date(2026, 10, 29) })], TODAY, ZONE).state).toBe("upcoming")
    // Paid on 29 Nov for the 1 Dec occurrence: it pays the next cycle, not November's.
    expect(ruleStatus(music, [payment({ date: date(2026, 11, 29) })], date(2026, 11, 30), ZONE).state).toBe("upcoming")
  })

  it("a draft from today waits to be confirmed; from before, it's overdue, the oldest first", () => {
    const rule = { ...music, startDate: date(2026, 10, 16, 9).toISOString(), nextDate: date(2026, 12, 16, 9).toISOString() }
    const todays = payment({ status: "planned", date: date(2026, 11, 16, 9) })
    expect(ruleStatus(rule, [todays], TODAY, ZONE)).toMatchObject({ state: "toConfirm", daysOverdue: 0 })
    const older = payment({ status: "planned", date: date(2026, 10, 16, 9) })
    const status = ruleStatus(rule, [todays, older], TODAY, ZONE)
    expect(status).toMatchObject({ state: "overdue", daysOverdue: 31 })
    expect(status.draft?.id).toBe(older.id)
  })

  it("a draft for a later day isn't due yet", () => {
    expect(ruleStatus(music, [payment({ status: "planned", date: date(2026, 12, 1, 9) })], TODAY, ZONE).state).toBe("upcoming")
  })

  it("paused and ended rules say so, even when paid", () => {
    expect(ruleStatus({ ...music, isPaused: true }, [payment()], TODAY, ZONE).state).toBe("paused")
    const ended = ruleStatus({ ...music, startDate: date(2026, 9, 1, 9).toISOString(), endDate: date(2026, 11, 15).toISOString() }, [payment()], TODAY, ZONE)
    expect(ended.state).toBe("ended")
    expect(ended.nextDate).toBeUndefined()
  })

  it("a quarterly rule is paid by the charge three months before its next date", () => {
    const mobbin: RecurringRule = { ...music, name: "Mobbin", amount: "22.5", interval: 3, startDate: date(2027, 1, 31, 9).toISOString(), nextDate: date(2027, 1, 31, 9).toISOString() }
    const status = ruleStatus(mobbin, [payment({ amount: "22.5", date: date(2026, 10, 31) })], TODAY, ZONE)
    expect(status.state).toBe("paid")
    expect(status.cycleDate.toISOString()).toBe(date(2026, 10, 31, 9).toISOString())
  })

  it("only this rule's movements count", () => {
    expect(ruleStatus(music, [payment({ recurringId: OTHER_RULE_ID }), payment({ recurringId: null })], TODAY, ZONE).state).toBe("upcoming")
  })
})

describe("ruleHistory", () => {
  it("lists every linked movement latest first, with this year's total and the price change", () => {
    const transactions = [payment({ amount: "5.99", date: date(2025, 12, 1) }), payment({ amount: "5.99", date: date(2026, 10, 1) }), payment({ date: date(2026, 11, 1) }), payment({ status: "planned", date: date(2026, 12, 1) })]
    const history = ruleHistory(music, transactions, TODAY, ZONE)
    expect(history.payments.map((tx) => tx.id)).toEqual([transactions[3]!.id, transactions[2]!.id, transactions[1]!.id, transactions[0]!.id])
    expect(history.paidCount).toBe(3)
    expect(history.paidThisYear.amount.toString()).toBe("12.48")
    expect(history.priceChange?.from.amount.toString()).toBe("5.99")
    expect(history.priceChange?.to.amount.toString()).toBe("6.49")
  })

  it("has no price change while the amount stays", () => {
    expect(ruleHistory(music, [payment(), payment({ date: date(2026, 10, 1) })], TODAY, ZONE).priceChange).toBeUndefined()
  })
})

describe("paymentCandidates", () => {
  it("offers unlinked confirmed movements of the rule's kind and currency that match by amount or by name", () => {
    const byAmount = payment({ recurringId: null, description: "Compra", date: date(2026, 10, 1) })
    const byName = payment({ recurringId: null, amount: "10.99", description: "apple music familiar" })
    const candidates = paymentCandidates(music, [
      byAmount,
      byName,
      payment({ recurringId: null, amount: "50", description: "Supermercado" }),
      payment({ recurringId: null, currency: "NIO" }),
      payment({ recurringId: null, status: "planned" }),
      payment({ recurringId: OTHER_RULE_ID }),
      payment(),
    ])
    expect(candidates.map((tx) => tx.id)).toEqual([byName.id, byAmount.id])
  })

  it("puts the movement that names the rule first, then the closest amount, then the latest", () => {
    const grok: RecurringRule = { ...music, name: "Grok", amount: "15" }
    const dinner = payment({ recurringId: null, amount: "15.82", description: "KFC", date: date(2026, 11, 8) })
    const pizza = payment({ recurringId: null, amount: "13.99", description: "Pizza", date: date(2026, 11, 7) })
    const named = payment({ recurringId: null, amount: "15", description: "Grok", date: date(2026, 11, 4) })
    const exact = payment({ recurringId: null, amount: "15", description: "Pago", date: date(2026, 10, 4) })
    const candidates = paymentCandidates(grok, [dinner, pizza, named, exact])
    expect(candidates.map((tx) => tx.description)).toEqual(["Grok", "Pago", "KFC", "Pizza"])
  })
})

describe("linking a payment by hand", () => {
  it("links a movement to the rule without moving its schedule, and unlinks it again", async () => {
    const manual = payment({ recurringId: null })
    const store = storeWith([music], [manual])
    await linkPayment(store, RULE_ID, manual.id)
    expect(store.transactions[0]?.recurringId).toBe(RULE_ID)
    expect(store.recurringRules[0]?.nextDate).toBe(music.nextDate)
    expect(ruleStatus(music, store.transactions, TODAY, ZONE).state).toBe("paid")
    await unlinkPayment(store, manual.id)
    expect(store.transactions[0]?.recurringId).toBeUndefined()
    expect("recurringId" in store.transactions[0]!).toBe(false)
  })

  it("refuses a movement of another kind, or one that doesn't exist", async () => {
    const income = payment({ recurringId: null, kind: "income", category: "salary" })
    const store = storeWith([music], [income])
    await expect(linkPayment(store, RULE_ID, income.id)).rejects.toMatchObject({ code: "unsupportedTransactionKind" })
    await expect(linkPayment(store, RULE_ID, OTHER_RULE_ID)).rejects.toMatchObject({ code: "notFound" })
    await expect(linkPayment(store, OTHER_RULE_ID, income.id)).rejects.toMatchObject({ code: "notFound" })
  })
})

describe("a manual payment that covers an occurrence", () => {
  it("is linked to the rule when the rule moves on, so the rule reads as paid", async () => {
    const rule = { ...music, startDate: date(2026, 10, 16, 9).toISOString(), nextDate: date(2026, 11, 16, 9).toISOString() }
    const manual = payment({ recurringId: null, date: date(2026, 11, 15) })
    const store = storeWith([rule], [manual])
    expect(await materializeRecurring(store, date(2026, 11, 16, 20))).toEqual([])
    expect(store.transactions).toHaveLength(1)
    expect(store.transactions[0]?.recurringId).toBe(RULE_ID)
    const status = ruleStatus(store.recurringRules[0]!, store.transactions, date(2026, 11, 16, 20), ZONE)
    expect(status).toMatchObject({ state: "paid", daysUntilNext: 30 })
  })
})

describe("recurringMonthProgress", () => {
  it("counts the expense rules due this month and the ones already paid, the rest per currency", () => {
    const light: RecurringRule = { ...music, id: OTHER_RULE_ID, name: "Luz", amount: "1200", currency: "NIO", isSubscription: false, startDate: date(2026, 10, 25, 9).toISOString(), nextDate: date(2026, 11, 25, 9).toISOString() }
    const salary: RecurringRule = { ...music, id: "00000000-0000-0000-0000-00000000a030", name: "Salario", kind: "income", categoryId: "salary", startDate: date(2026, 10, 25, 9).toISOString(), nextDate: date(2026, 11, 25, 9).toISOString() }
    const notStarted: RecurringRule = { ...music, id: "00000000-0000-0000-0000-00000000b030", name: "Grok", startDate: date(2026, 12, 4, 9).toISOString(), nextDate: date(2026, 12, 4, 9).toISOString() }
    // Its 5 Nov occurrence passed with no payment and no draft: set up later, so nothing is owed for it.
    const setUpLater: RecurringRule = { ...music, id: "00000000-0000-0000-0000-00000000d030", name: "Gym", amount: "30", startDate: date(2026, 10, 5, 9).toISOString(), nextDate: date(2026, 12, 5, 9).toISOString() }
    // Its 10 Nov occurrence left a draft that still waits.
    const waiting: RecurringRule = { ...music, id: "00000000-0000-0000-0000-00000000e031", name: "Water", amount: "12", startDate: date(2026, 10, 10, 9).toISOString(), nextDate: date(2026, 12, 10, 9).toISOString() }
    const draft = payment({ amount: "12", status: "planned", date: date(2026, 11, 10, 9), recurringId: waiting.id })
    const progress = recurringMonthProgress([music, light, salary, notStarted, setUpLater, waiting, { ...light, id: "00000000-0000-0000-0000-00000000c030", isPaused: true }], [payment(), draft], TODAY, ZONE)
    expect(progress.total).toBe(3)
    expect(progress.paid).toBe(1)
    expect(progress.remaining.map((money) => `${money.amount} ${money.currency}`)).toEqual(["1200 NIO", "12 USD"])
  })
})
