// Savings goals: progress and the monthly amount, the use cases, and the goal through IndexedDB.
import "fake-indexeddb/auto"

import { describe, expect, it } from "vitest"

import {
  DomainError,
  InMemoryStore,
  addToSavingsGoal,
  orderedGoals,
  saveSavingsGoal,
  savingsGoalProgress,
  withdrawFromSavingsGoal,
} from "@/lib/domain"
import { savingsGoalRepository, settingsRepository } from "@/lib/repositories"
import { DEFAULT_SETTINGS, type SavingsGoal } from "@/lib/schema"

const NOV_2026 = new Date(2026, 10, 6, 12)

function goal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: "00000000-0000-0000-0000-00000000a001",
    name: "Trip",
    target: { amount: "15000", currency: "NIO" },
    saved: "0",
    targetMonth: { month: 12, year: 2026 },
    ...overrides,
  }
}

async function expectDomainError(work: () => Promise<unknown>, code: DomainError["code"]) {
  const error = await work().then(
    () => undefined,
    (thrown: unknown) => thrown,
  )
  expect(error).toBeInstanceOf(DomainError)
  expect((error as DomainError).code).toBe(code)
}

describe("Savings goal progress", () => {
  it("splits what's left over the months to the target month, both counted", () => {
    const progress = savingsGoalProgress(goal(), NOV_2026)
    expect(progress.monthsLeft).toBe(2)
    expect(progress.monthlyAmount?.toString()).toBe("7500")
    expect(progress.isOverdue).toBe(false)
  })

  it("rounds the monthly amount up to the cent", () => {
    const progress = savingsGoalProgress(goal({ target: { amount: "100", currency: "NIO" }, targetMonth: { month: 1, year: 2027 } }), NOV_2026)
    expect(progress.monthsLeft).toBe(3)
    expect(progress.monthlyAmount?.toString()).toBe("33.34")
  })

  it("asks for everything left in the target month itself", () => {
    const progress = savingsGoalProgress(goal({ saved: "14000", targetMonth: { month: 11, year: 2026 } }), NOV_2026)
    expect(progress.monthsLeft).toBe(1)
    expect(progress.monthlyAmount?.toString()).toBe("1000")
  })

  it("is overdue once the month passed with money to go, and has no monthly amount", () => {
    const progress = savingsGoalProgress(goal({ saved: "100", targetMonth: { month: 10, year: 2026 } }), NOV_2026)
    expect(progress.isOverdue).toBe(true)
    expect(progress.monthlyAmount).toBeUndefined()
    expect(progress.remaining.toString()).toBe("14900")
  })

  it("is reached at the target, with nothing left even past it", () => {
    const progress = savingsGoalProgress(goal({ saved: "16000", targetMonth: { month: 10, year: 2026 } }), NOV_2026)
    expect(progress.isReached).toBe(true)
    expect(progress.isOverdue).toBe(false)
    expect(progress.remaining.isZero()).toBe(true)
    expect(progress.monthlyAmount).toBeUndefined()
    expect(progress.fraction.gt(1)).toBe(true)
  })

  it("has no monthly amount without a date", () => {
    const { targetMonth: _, ...undated } = goal()
    expect(savingsGoalProgress(undated, NOV_2026).monthlyAmount).toBeUndefined()
  })

  it("orders open goals by deadline, undated after, reached last", () => {
    const { targetMonth: _, ...undated } = goal({ id: "u", name: "Emergency" })
    const ordered = orderedGoals(
      [
        goal({ id: "done", name: "Bike", saved: "15000" }),
        undated,
        goal({ id: "later", name: "Car", targetMonth: { month: 6, year: 2027 } }),
        goal({ id: "soon", name: "Trip" }),
      ],
      NOV_2026,
    )
    expect(ordered.map((g) => g.id)).toEqual(["soon", "later", "u", "done"])
  })
})

describe("Savings goal use cases", () => {
  const settings = { ...DEFAULT_SETTINGS, currencies: { principal: "NIO", second: "USD", rate: "36.6" } }

  it("creates with nothing saved, in one of the person's currencies", async () => {
    const store = new InMemoryStore({ settings })
    const created = await saveSavingsGoal(store, { name: "  Trip ", targetAmount: "15000", currency: "NIO", targetMonth: { month: 12, year: 2026 } })
    expect(created).toMatchObject({ name: "Trip", saved: "0", target: { amount: "15000", currency: "NIO" } })
    await expectDomainError(() => saveSavingsGoal(store, { name: "Euro", targetAmount: "10", currency: "EUR" }), "invalidCurrency")
    await expectDomainError(() => saveSavingsGoal(store, { name: " ", targetAmount: "10", currency: "NIO" }), "missingName")
    await expectDomainError(() => saveSavingsGoal(store, { name: "Zero", targetAmount: "0", currency: "NIO" }), "invalidAmount")
  })

  it("editing keeps what's saved and the currency, and can drop the date", async () => {
    const store = new InMemoryStore({ settings })
    const created = await saveSavingsGoal(store, { name: "Trip", targetAmount: "15000", currency: "NIO", targetMonth: { month: 12, year: 2026 } })
    await addToSavingsGoal(store, created.id, "2500.50")
    const edited = await saveSavingsGoal(store, { id: created.id, name: "Big trip", targetAmount: "20000", currency: "USD" })
    expect(edited).toMatchObject({ name: "Big trip", saved: "2500.5", target: { amount: "20000", currency: "NIO" } })
    expect(edited.targetMonth).toBeUndefined()
  })

  it("adds and withdraws, never below zero", async () => {
    const store = new InMemoryStore({ settings, savingsGoals: [goal()] })
    await addToSavingsGoal(store, goal().id, "100")
    expect((await withdrawFromSavingsGoal(store, goal().id, "40")).saved).toBe("60")
    await expectDomainError(() => withdrawFromSavingsGoal(store, goal().id, "60.01"), "invalidAmount")
    await expectDomainError(() => addToSavingsGoal(store, goal().id, "0"), "invalidAmount")
    await expectDomainError(() => addToSavingsGoal(store, "missing", "1"), "notFound")
  })
})

describe("Savings goals through IndexedDB", () => {
  it("stores goals and hides a deleted one", async () => {
    await settingsRepository.save({ ...DEFAULT_SETTINGS, currencies: { principal: "NIO", rate: "1" }, hasCompletedOnboarding: true })
    await savingsGoalRepository.save(goal({ saved: "2500.5", icon: "airplane", color: "blue" }))
    const { targetMonth: _, ...undated } = goal({ id: "00000000-0000-0000-0000-00000000a002", name: "Emergency" })
    await savingsGoalRepository.save(undated)
    await savingsGoalRepository.remove(undated.id)

    const goals = await savingsGoalRepository.list()
    expect(goals.map((g) => g.name)).toEqual(["Trip"])
    expect(goals[0]).toMatchObject({ saved: "2500.5", targetMonth: { month: 12, year: 2026 }, icon: "airplane" })
  })
})
