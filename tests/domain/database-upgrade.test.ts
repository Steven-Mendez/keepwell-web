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
    expect(upgraded.verno).toBe(3)
    const row = await upgraded.transactions.get("t1")
    expect(row?.amount).toBe("10")
    expect(row?.recurring_id).toBeNull()
    expect(await upgraded.recurring_rules.count()).toBe(0)
    // Version 3: categories start without a monthly budget.
    const category = await upgraded.categories.get("groceries")
    expect(category?.budget_amount).toBeNull()
    expect(category?.budget_currency).toBeNull()
    upgraded.close()
  })
})
