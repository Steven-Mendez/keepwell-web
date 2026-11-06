// A browser that already has the version 1 database keeps its movements when the app opens version 2:
// rows gain `recurring_id: null` and the `recurring_rules` table starts empty.
import "fake-indexeddb/auto"

import { Dexie } from "dexie"
import { describe, expect, it } from "vitest"

import { KeepwellDatabase } from "@/lib/db/database"

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
    expect(upgraded.verno).toBe(5)
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
    expect(upgraded.verno).toBe(5)
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
      repayments: [],
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
