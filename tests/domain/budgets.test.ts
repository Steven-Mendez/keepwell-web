// Monthly budgets per category: the statuses the summary and home read, saving one, and keeping it
// through IndexedDB.
import "fake-indexeddb/auto"

import { describe, expect, it } from "vitest"

import { DomainError, InMemoryStore, budgetStatuses, dec, saveCategory, type CategoryTotal } from "@/lib/domain"
import { categoryRepository, settingsRepository } from "@/lib/repositories"
import { DEFAULT_SETTINGS, type TransactionCategory } from "@/lib/schema"

const expense = (id: string, budget?: string, currency = "NIO"): TransactionCategory => ({
  id,
  name: id,
  kind: "expense",
  isRenamed: false,
  ...(budget === undefined ? {} : { monthlyBudget: { amount: budget, currency } }),
})

function summary(totals: Record<string, string>, currency = "NIO") {
  const categories: CategoryTotal[] = Object.entries(totals).map(([categoryId, amount]) => ({
    categoryId,
    amount: dec(amount),
    share: dec(0),
  }))
  return { currency, categories }
}

describe("Budget statuses", () => {
  it("warns from 80% and marks 100% as exceeded", () => {
    const statuses = budgetStatuses(summary({ a: "79.99", b: "80", c: "100", d: "150" }), [
      expense("a", "100"),
      expense("b", "100"),
      expense("c", "100"),
      expense("d", "100"),
    ])
    expect(statuses.map((s) => [s.categoryId, s.level])).toEqual([
      ["d", "exceeded"],
      ["c", "exceeded"],
      ["b", "nearLimit"],
      ["a", "onTrack"],
    ])
    expect(statuses[0]!.ratio.toString()).toBe("1.5")
  })

  it("lists a budget with nothing spent, and skips unbudgeted, income and other-currency budgets", () => {
    const income: TransactionCategory = { ...expense("salary", "500"), kind: "income" }
    const statuses = budgetStatuses(summary({ salary: "900", plain: "50" }), [
      expense("idle", "200"),
      expense("plain"),
      expense("dollars", "10", "USD"),
      income,
    ])
    expect(statuses).toHaveLength(1)
    expect(statuses[0]).toMatchObject({ categoryId: "idle", level: "onTrack" })
    expect(statuses[0]!.spent.isZero()).toBe(true)
  })
})

describe("Saving a budget", () => {
  it("keeps it on expense categories and drops it on income", async () => {
    const store = new InMemoryStore()
    const boat = await saveCategory(store, { name: "Boat", kind: "expense", monthlyBudget: { amount: "1500.50", currency: "NIO" } })
    expect(boat.monthlyBudget).toEqual({ amount: "1500.5", currency: "NIO" })
    const tips = await saveCategory(store, { name: "Tips", kind: "income", monthlyBudget: { amount: "10", currency: "NIO" } })
    expect(tips.monthlyBudget).toBeUndefined()
    const cleared = await saveCategory(store, { id: boat.id, name: "Boat", kind: "expense" })
    expect(cleared.monthlyBudget).toBeUndefined()
  })

  it("refuses zero", async () => {
    const error = await saveCategory(new InMemoryStore(), {
      name: "Boat",
      kind: "expense",
      monthlyBudget: { amount: "0", currency: "NIO" },
    }).catch((thrown: unknown) => thrown)
    expect(error).toBeInstanceOf(DomainError)
    expect((error as DomainError).code).toBe("invalidAmount")
  })
})

describe("Budgets through IndexedDB", () => {
  it("stores the budget, and restoring defaults clears it", async () => {
    await settingsRepository.save({ ...DEFAULT_SETTINGS, currencies: { principal: "NIO", rate: "1" }, hasCompletedOnboarding: true })
    await categoryRepository.ensureDefaults()
    const groceries = (await categoryRepository.list()).find((c) => c.id === "groceries")!
    await categoryRepository.save({ ...groceries, monthlyBudget: { amount: "8000", currency: "NIO" } })
    expect((await categoryRepository.list()).find((c) => c.id === "groceries")?.monthlyBudget).toEqual({
      amount: "8000",
      currency: "NIO",
    })

    await categoryRepository.restoreDefaults()
    expect((await categoryRepository.list()).find((c) => c.id === "groceries")?.monthlyBudget).toBeUndefined()
  })
})
