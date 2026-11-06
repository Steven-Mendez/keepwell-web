import { db, rowToSavingsGoal, savingsGoalToRow } from "@/lib/db"
import { SavingsGoal } from "@/lib/schema"

import { isAlive, softDelete, upsert } from "./shared"

export const savingsGoalRepository = {
  /** Alive goals, in no particular order: screens sort them with `orderedGoals`. */
  async list(): Promise<SavingsGoal[]> {
    const rows = await db.savings_goals.filter(isAlive).toArray()
    return rows.map(rowToSavingsGoal)
  },

  async save(input: SavingsGoal): Promise<SavingsGoal> {
    const goal = SavingsGoal.parse(input)
    await upsert(db.savings_goals, "savingsGoal", savingsGoalToRow(goal))
    return goal
  },

  async remove(id: string): Promise<void> {
    await softDelete(db.savings_goals, "savingsGoal", id)
  },
}
