import { describe, expect, it } from "vitest"

import {
  DomainError,
  draftFrom,
  importedLineIds,
  importedTransactionId,
  importTransactions,
  matchIncoming,
  saveCategorizationRule,
  saveTransaction,
  type IncomingLine,
} from "@/lib/domain"
import type { Transaction } from "@/lib/schema"

import { date, IDs, sampleStore, transaction, ZONE } from "./fixtures"

const ACCOUNT = IDs.savings
const OTHER = IDs.payroll

const line = (overrides: Partial<IncomingLine> = {}): IncomingLine => ({ day: "2026-10-10", direction: "out", amount: "12.50", currency: "USD", description: "Café", ...overrides })
const spent = (day: number, overrides: Partial<Parameters<typeof transaction>[0]> = {}) => transaction({ amount: "12.50", account: ACCOUNT, date: date(2026, 10, day), ...overrides })
const match = (lines: IncomingLine[], existing: Transaction[]) => matchIncoming(ACCOUNT, lines, existing, { timeZone: ZONE })

describe("matchIncoming", () => {
  it("matches a movement with the same imported id exactly", () => {
    const recorded = { ...spent(1, { amount: "99" }), importedId: "FIT-1" }
    expect(match([line({ importedId: "FIT-1" })], [recorded])).toEqual([{ line: 0, result: "existing", transactionId: recorded.id, by: "imported_id" }])
  })

  it("matches by amount up to 7 calendar days away, not 8", () => {
    const recorded = spent(3)
    expect(match([line({ day: "2026-10-10" })], [recorded])[0]).toMatchObject({ result: "existing", transactionId: recorded.id, by: "amount_date" })
    expect(match([line({ day: "2026-09-26" })], [recorded])[0]).toMatchObject({ result: "existing", by: "amount_date" })
    expect(match([line({ day: "2026-10-11" })], [recorded])[0]).toMatchObject({ result: "new" })
  })

  it("only matches the same direction, currency and account", () => {
    expect(match([line({ direction: "in" })], [spent(10)])[0]!.result).toBe("new")
    expect(match([line({ currency: "NIO" })], [spent(10)])[0]!.result).toBe("new")
    expect(match([line()], [spent(10, { account: OTHER })])[0]!.result).toBe("new")
    const income = spent(10, { kind: "income", category: "other-income" })
    expect(match([line({ direction: "in" })], [income])[0]).toMatchObject({ result: "existing", transactionId: income.id })
  })

  it("gives one movement to one line: two equal lines against one movement are one existing and one new", () => {
    const recorded = spent(10)
    const results = match([line(), line()], [recorded])
    expect(results.map((result) => result.result)).toEqual(["existing", "new"])
  })

  it("takes the closest movement in days, then the oldest", () => {
    const far = spent(7)
    const near = spent(11)
    expect(match([line()], [far, near])[0]).toMatchObject({ transactionId: near.id })
    const before = spent(9)
    const after = spent(11)
    expect(match([line()], [after, before])[0]).toMatchObject({ transactionId: before.id })
  })

  it("doesn't match by amount a movement that already has another imported id", () => {
    const recorded = { ...spent(10), importedId: "FIT-OTHER" }
    expect(match([line({ importedId: "FIT-1" })], [recorded])[0]!.result).toBe("new")
    expect(match([line()], [recorded])[0]!.result).toBe("new")
  })

  it("skips both legs of a transfer, one in each account's statement", () => {
    const transfer = transaction({ kind: "transfer", amount: "100", account: ACCOUNT, destination: OTHER, date: date(2026, 10, 10) })
    expect(match([line({ amount: "100" })], [transfer])).toEqual([{ line: 0, result: "skipped", reason: "transfer_leg", transactionId: transfer.id }])
    const arriving = matchIncoming(OTHER, [line({ amount: "100", direction: "in" })], [transfer], { timeZone: ZONE })
    expect(arriving).toEqual([{ line: 0, result: "skipped", reason: "transfer_leg", transactionId: transfer.id }])
    // The other direction isn't a leg: it is a new movement.
    expect(match([line({ amount: "100", direction: "in" })], [transfer])[0]!.result).toBe("new")
  })

  it("matches what the bank actually charged in the principal currency", () => {
    const recorded = spent(10, { amount: "500", currency: "NIO", actualDebited: "13.70" })
    expect(match([line({ amount: "13.70", currency: "USD" })], [recorded])[0]).toMatchObject({ result: "existing", transactionId: recorded.id })
    expect(match([line({ amount: "500", currency: "NIO" })], [recorded])[0]).toMatchObject({ result: "existing", transactionId: recorded.id })
  })

  it("matches a draft too", () => {
    const draft = spent(10, { status: "planned" })
    expect(match([line()], [draft])[0]).toMatchObject({ result: "existing", transactionId: draft.id, by: "amount_date" })
  })

  it("skips a line whose id repeats in the call", () => {
    const results = match([line({ importedId: "FIT-1" }), line({ importedId: "FIT-1", amount: "3" })], [])
    expect(results[1]).toEqual({ line: 1, result: "skipped", reason: "repeated_in_file" })
  })

  it("gives lines without a bank id the same ids every time, and equal lines different ones", () => {
    const lines = [line(), line(), line({ amount: "12.5" }), line({ day: "2026-10-11" })]
    const ids = importedLineIds(ACCOUNT, lines)
    expect(ids).toEqual(importedLineIds(ACCOUNT, lines))
    expect(new Set(ids).size).toBe(4)
    expect(ids[0]).toMatch(/^kw1:/)
    // "12.5" is the same amount as "12.50": alone in a call it is the first of its day, like line 0.
    expect(importedLineIds(ACCOUNT, [line({ amount: "12.5" })])).toEqual([ids[0]])
  })

  it("reads the movement's day in the person's zone (Managua at the edge of a day)", () => {
    // 21:00 in Managua on 2 October is already 3 October in UTC.
    const recorded = spent(2, { date: new Date(Date.UTC(2026, 9, 3, 3)) })
    expect(match([line({ day: "2026-10-09" })], [recorded])[0]!.result).toBe("existing")
    expect(match([line({ day: "2026-10-10" })], [recorded])[0]!.result).toBe("new")
    expect(matchIncoming(ACCOUNT, [line({ day: "2026-10-10" })], [recorded], { timeZone: "UTC" })[0]!.result).toBe("existing")
  })

  it("refuses a day that doesn't exist", () => {
    expect(() => match([line({ day: "2026-02-30" })], [])).toThrow(DomainError)
  })

  it("leaves deleted movements out because they aren't passed, and a lone transfer-looking line is new", () => {
    expect(match([line({ amount: "100" })], [])[0]!.result).toBe("new")
  })
})

describe("importTransactions", () => {
  const statement = (): IncomingLine[] => [
    line({ day: "2026-10-01", amount: "4.25", description: "Café" }),
    line({ day: "2026-10-01", amount: "4.25", description: "Café" }),
    line({ day: "2026-10-02", amount: "250", direction: "in", description: "Pago" }),
  ]

  it("saves nothing on a dry run", async () => {
    const store = sampleStore()
    const before = (await store.fetchTransactions()).length
    const outcome = await importTransactions(store, { accountId: ACCOUNT, lines: statement(), dryRun: true })
    expect(outcome.counts).toEqual({ new: 3, existing: 0, skipped: 0 })
    expect((await store.fetchTransactions()).length).toBe(before)
  })

  it("saves new lines confirmed, in Other, at noon of their day, and the same file twice gives no new ones", async () => {
    const store = sampleStore()
    const before = (await store.fetchTransactions()).length
    const first = await importTransactions(store, { accountId: ACCOUNT, lines: statement(), dryRun: false })
    expect(first.counts.new).toBe(3)
    const all = await store.fetchTransactions()
    expect(all.length).toBe(before + 3)
    const ids = importedLineIds(ACCOUNT, statement())
    const income = all.find((candidate) => candidate.id === importedTransactionId(ACCOUNT, ids[2]!))!
    expect(income).toMatchObject({ kind: "income", categoryId: "other-income", status: "confirmed", importedId: ids[2], accountId: ACCOUNT, description: "Pago" })
    expect(new Date(income.date).getTime()).toBe(date(2026, 10, 2).getTime())

    const again = await importTransactions(store, { accountId: ACCOUNT, lines: statement(), dryRun: false })
    expect(again.counts).toEqual({ new: 0, existing: 3, skipped: 0 })
    expect((await store.fetchTransactions()).length).toBe(before + 3)
  })

  it("gives a movement matched by amount and date the line's id and changes nothing else", async () => {
    const store = sampleStore()
    const saved = await saveTransaction(store, { ...draftFrom(spent(5, { category: "groceries", description: "Súper de la semana" })), note: "con Ana", tags: ["casa"] })
    const outcome = await importTransactions(store, { accountId: ACCOUNT, lines: [line({ day: "2026-10-06", description: "POS SUPERMERCADO 0042", importedId: "FIT-9" })], dryRun: false })
    expect(outcome.lines[0]).toMatchObject({ result: "existing", by: "amount_date", transactionId: saved.transaction.id })
    const after = (await store.fetchTransactions()).find((candidate) => candidate.id === saved.transaction.id)
    expect(after).toEqual({ ...saved.transaction, importedId: "FIT-9" })
  })

  it("leaves a matched draft pending", async () => {
    const store = sampleStore()
    const saved = await saveTransaction(store, { ...draftFrom(spent(10)), isDraft: true })
    await importTransactions(store, { accountId: ACCOUNT, lines: [line()], dryRun: false })
    expect((await store.fetchTransactions()).find((candidate) => candidate.id === saved.transaction.id)!.status).toBe("planned")
  })

  it("uses the line's category and a card of the account", async () => {
    const store = sampleStore()
    const outcome = await importTransactions(store, { accountId: ACCOUNT, cardId: IDs.savingsDebit, lines: [{ ...line({ amount: "7.77" }), categoryId: "groceries", note: "pan" }], dryRun: false })
    const created = (await store.fetchTransactions()).find((candidate) => candidate.importedId === (outcome.lines[0] as { importedId: string }).importedId)!
    expect(created).toMatchObject({ categoryId: "groceries", cardId: IDs.savingsDebit, note: "pan" })
  })

  it("refuses the whole import when one new line is invalid, before saving anything", async () => {
    const store = sampleStore()
    const before = (await store.fetchTransactions()).length
    await expect(importTransactions(store, { accountId: ACCOUNT, lines: [line({ amount: "1.11" }), { ...line({ amount: "2.22" }), categoryId: "salary" }], dryRun: false })).rejects.toThrow(DomainError)
    await expect(importTransactions(store, { accountId: ACCOUNT, cardId: IDs.payrollDebit, lines: [line()], dryRun: true })).rejects.toThrow(DomainError)
    expect((await store.fetchTransactions()).length).toBe(before)
  })

  it("passes a line headed for Other through the categorization rules, and keeps the line's own category", async () => {
    const store = sampleStore()
    await saveCategorizationRule(store, { match: "uber", categoryId: "transport", kind: "expense" })
    const outcome = await importTransactions(
      store,
      { accountId: ACCOUNT, lines: [line({ amount: "6.10", description: "UBER TRIP 123" }), { ...line({ amount: "6.20", description: "UBER TRIP 456" }), categoryId: "groceries" }], dryRun: false },
    )
    const saved = await store.fetchTransactions()
    const byLine = (index: number) => saved.find((candidate) => candidate.importedId === (outcome.lines[index] as { importedId: string }).importedId)!
    expect(byLine(0).categoryId).toBe("transport")
    expect(byLine(1).categoryId).toBe("groceries")
  })

  it("keeps the imported id when the movement is edited", async () => {
    const store = sampleStore()
    const outcome = await importTransactions(store, { accountId: ACCOUNT, lines: [line({ amount: "8.88", importedId: "FIT-E" })], dryRun: false })
    const id = importedTransactionId(ACCOUNT, (outcome.lines[0] as { importedId: string }).importedId)
    const created = (await store.fetchTransactions()).find((candidate) => candidate.id === id)!
    await saveTransaction(store, { ...draftFrom(created), description: "Panadería", categoryId: "groceries" })
    expect((await store.fetchTransactions()).find((candidate) => candidate.id === id)).toMatchObject({ description: "Panadería", importedId: "FIT-E" })
  })
})
