import { newID } from "@/lib/platform/uuid"
import { db, recurringRuleToRow, rowToRecurringRule } from "@/lib/db"
import { RecurringRule } from "@/lib/schema"

import type { Draft } from "./accounts"
import { isAlive, softDelete, upsert } from "./shared"

export const recurringRuleRepository = {
  /** Alive rules, the soonest next occurrence first. */
  async list(): Promise<RecurringRule[]> {
    const rows = await db.recurring_rules.orderBy("next_date").filter(isAlive).toArray()
    return rows.map(rowToRecurringRule)
  },

  async save(draft: Draft<RecurringRule>): Promise<RecurringRule> {
    const rule = RecurringRule.parse({ ...draft, id: draft.id ?? newID() })
    await upsert(db.recurring_rules, "recurringRule", recurringRuleToRow(rule))
    return rule
  },

  /** Soft delete. Its pending drafts are deleted by the caller, as on iOS. */
  async remove(id: string): Promise<void> {
    await softDelete(db.recurring_rules, "recurringRule", id)
  },
}
