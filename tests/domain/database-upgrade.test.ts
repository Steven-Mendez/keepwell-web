// A browser that already has the version 1 database keeps its movements when the app opens version 2:
// rows gain `recurring_id: null` and the `recurring_rules` table starts empty.
import "fake-indexeddb/auto"

import { Dexie } from "dexie"
import { describe, expect, it } from "vitest"

import { KeepwellDatabase } from "@/lib/db/database"
import { loanPaymentId } from "@/lib/schema/id"

describe("IndexedDB upgrade from version 1", () => {
  it("keeps every movement and adds an empty recurring_rules table", async () => {
    const v1 = new Dexie("keepwell")
    v1.version(1).stores({
      accounts: "id, kind, created_at, updated_at, deleted_at",
      cards: "id, account_id, created_at, updated_at, deleted_at",
      categories: "id, kind, sort_index, updated_at, deleted_at",
      transactions: "id, date, account_id, card_id, category_id, [account_id+date], updated_at, deleted_at",
      settings: "id",
      sync_outbox: "id, created_at, entity, entity_id",
    })
    await v1.table("categories").add({ id: "groceries", name: "Groceries", kind: "expense", sort_index: 0, deleted_at: null })
    await v1.table("transactions").add({ id: "t1", date: "2026-10-01T12:00:00.000Z", account_id: "a1", amount: "10", deleted_at: null })
    v1.close()

    const upgraded = new KeepwellDatabase()
    await upgraded.open()
    expect(upgraded.verno).toBe(7)
    const row = await upgraded.transactions.get("t1")
    expect(row?.amount).toBe("10")
    expect(row?.recurring_id).toBeNull()
    expect(await upgraded.recurring_rules.count()).toBe(0)
    // Version 3: categories start without a monthly budget.
    // Version 4: an empty savings_goals table.
    expect(await upgraded.savings_goals.count()).toBe(0)
    // Version 5: empty loans, personal_debts and categorization_rules tables, movements without tags.
    expect(await upgraded.loans.count()).toBe(0)
    expect(await upgraded.personal_debts.count()).toBe(0)
    expect(await upgraded.categorization_rules.count()).toBe(0)
    expect(row?.tags).toEqual([])
    const category = await upgraded.categories.get("groceries")
    expect(category?.budget_amount).toBeNull()
    expect(category?.budget_currency).toBeNull()
    upgraded.close()
  })
})

describe("IndexedDB upgrade from version 4", () => {
  it("keeps savings goals, adds empty loans, personal_debts and categorization_rules tables, and empty tags", async () => {
    await Dexie.delete("keepwell")
    const v4 = new Dexie("keepwell")
    v4.version(4).stores({
      accounts: "id, kind, created_at, updated_at, deleted_at",
      cards: "id, account_id, created_at, updated_at, deleted_at",
      categories: "id, kind, sort_index, updated_at, deleted_at",
      transactions: "id, date, account_id, card_id, category_id, recurring_id, [account_id+date], updated_at, deleted_at",
      recurring_rules: "id, account_id, next_date, updated_at, deleted_at",
      savings_goals: "id, updated_at, deleted_at",
      settings: "id",
      sync_outbox: "id, created_at, entity, entity_id",
    })
    await v4.table("savings_goals").add({ id: "g1", name: "Trip", target_amount: "15000", saved: "10", deleted_at: null })
    await v4.table("transactions").add({ id: "t1", date: "2026-10-01T12:00:00.000Z", account_id: "a1", amount: "10", recurring_id: null, deleted_at: null })
    await v4.table("recurring_rules").add({ id: "r1", name: "Gym", account_id: "a1", next_date: "2026-11-01T12:00:00.000Z", deleted_at: null })
    v4.close()

    const upgraded = new KeepwellDatabase()
    await upgraded.open()
    expect(upgraded.verno).toBe(7)
    expect((await upgraded.savings_goals.get("g1"))?.saved).toBe("10")
    expect(await upgraded.loans.count()).toBe(0)
    expect(await upgraded.personal_debts.count()).toBe(0)
    expect(await upgraded.categorization_rules.count()).toBe(0)
    expect((await upgraded.transactions.get("t1"))?.tags).toEqual([])
    expect((await upgraded.recurring_rules.get("r1"))?.tags).toEqual([])
    await upgraded.categorization_rules.add({
      id: "c1",
      match: "Uber",
      category_id: "transport",
      kind: "expense",
      tags: [],
      sort_index: 0,
      created_at: "2026-11-01T18:00:00.000Z",
      updated_at: "2026-11-01T18:00:00.000Z",
      deleted_at: null,
    })
    expect(await upgraded.categorization_rules.orderBy("sort_index").count()).toBe(1)
    await upgraded.personal_debts.add({
      id: "d1",
      person: "Juan",
      direction: "theyOweMe",
      amount: "500",
      currency: "NIO",
      date: "2026-11-01T18:00:00.000Z",
      note: null,
      settled_at: null,
      transaction_id: "t1",
      created_at: "2026-11-01T18:00:00.000Z",
      updated_at: "2026-11-01T18:00:00.000Z",
      deleted_at: null,
    })
    expect(await upgraded.personal_debts.where("transaction_id").equals("t1").count()).toBe(1)
    upgraded.close()
  })
})

describe("IndexedDB upgrade from version 5 (sync-ready rows)", () => {
  it("moves payments and repayments into their own rows, marks old rows as app-made and rebuilds the outbox", async () => {
    await Dexie.delete("keepwell")
    const v5 = new Dexie("keepwell")
    v5.version(5).stores({
      accounts: "id, kind, created_at, updated_at, deleted_at",
      cards: "id, account_id, created_at, updated_at, deleted_at",
      categories: "id, kind, sort_index, updated_at, deleted_at",
      transactions: "id, date, account_id, card_id, category_id, recurring_id, [account_id+date], updated_at, deleted_at",
      recurring_rules: "id, account_id, next_date, updated_at, deleted_at",
      savings_goals: "id, updated_at, deleted_at",
      loans: "id, updated_at, deleted_at",
      personal_debts: "id, transaction_id, updated_at, deleted_at",
      categorization_rules: "id, sort_index, updated_at, deleted_at",
      settings: "id",
      sync_outbox: "id, created_at, entity, entity_id",
    })
    const at = "2026-11-01T18:00:00.000Z"
    const audit = { created_at: at, updated_at: at, deleted_at: null }
    const loanId = "11111111-1111-4111-8111-111111111111"
    const debtId = "22222222-2222-4222-8222-222222222222"
    await v5.table("loans").add({ id: loanId, name: "Moto", payments: [{ number: 1, paid_at: at, transaction_id: null }, { number: 2, paid_at: at, transaction_id: null }], ...audit })
    await v5.table("personal_debts").add({ id: debtId, person: "Ana", repayments: [{ amount: "20", date: at }], ...audit })
    await v5.table("transactions").add({ id: "t1", amount: "10", tags: [], ...audit })
    await v5.table("settings").add({ id: "settings", principal: "USD", second: null, rate: "1", unlock_method: "passcode", updated_at: at })
    await v5.table("sync_outbox").add({ id: "old", entity: "loan", entity_id: loanId, operation: "create", payload: {}, created_at: at })
    v5.close()

    const upgraded = new KeepwellDatabase()
    await upgraded.open()
    expect(upgraded.verno).toBe(7)
    const payments = await upgraded.loan_payments.where("loan_id").equals(loanId).sortBy("number")
    expect(payments.map((p) => [p.id, p.number])).toEqual([
      [loanPaymentId(loanId, 1), 1],
      [loanPaymentId(loanId, 2), 2],
    ])
    expect((await upgraded.loans.get(loanId)) as unknown).not.toHaveProperty("payments")
    expect(await upgraded.personal_debt_repayments.where("debt_id").equals(debtId).count()).toBe(1)
    expect((await upgraded.transactions.get("t1"))?.source).toBe("app")
    const settings = await upgraded.settings.get("settings")
    expect(settings?.created_at).toBe(at)
    expect(settings?.deleted_at).toBeNull()

    const outbox = await upgraded.sync_outbox.orderBy("created_at").toArray()
    expect(outbox.find((e) => e.id === "old")).toBeUndefined()
    expect(outbox.map((e) => e.entity)).toEqual(["transaction", "loan", "loanPayment", "loanPayment", "personalDebt", "personalDebtRepayment", "settings"])
    const settingsEvent = outbox.find((e) => e.entity === "settings")!
    expect(settingsEvent.payload).not.toHaveProperty("unlock_method")
    upgraded.close()
  })
})
