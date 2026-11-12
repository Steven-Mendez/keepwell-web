import {
  categorizationRuleToRow,
  db,
  rowToCategorizationRule,
  type CategorizationRuleRow,
} from "@/lib/db"
import { CategorizationRule } from "@/lib/schema"

import { NotFoundError, enqueue, isAlive, stampAfter } from "./shared"

async function nextSortIndex(): Promise<number> {
  const last = await db.categorization_rules.orderBy("sort_index").last()
  return last ? last.sort_index + 1 : 0
}

async function write(row: CategorizationRuleRow, operation: "create" | "update" | "delete") {
  await db.categorization_rules.put(row)
  await enqueue("categorizationRule", row.id, operation, row, row.updated_at)
}

const tables = () => [db.categorization_rules, db.sync_outbox]

/** Two offline devices can give rules the same `sort_index`; the `id` breaks the tie the same way everywhere. */
function byPlace(a: CategorizationRuleRow, b: CategorizationRuleRow): number {
  return a.sort_index - b.sort_index || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

export const categorizationRuleRepository = {
  /** Alive rules in the person's order, which decides the one that wins. */
  async list(): Promise<CategorizationRule[]> {
    const rows = await db.categorization_rules.filter(isAlive).toArray()
    return rows.sort(byPlace).map(rowToCategorizationRule)
  },

  /** A new id goes after the existing ones; an existing one keeps its place. */
  async save(input: CategorizationRule): Promise<CategorizationRule> {
    const rule = CategorizationRule.parse(input)
    await db.transaction("rw", tables(), async () => {
      const existing = await db.categorization_rules.get(rule.id)
      const now = stampAfter(existing?.updated_at)
      const sortIndex = existing?.sort_index ?? (await nextSortIndex())
      await write(
        { ...categorizationRuleToRow(rule, sortIndex), created_at: existing?.created_at ?? now, updated_at: now, deleted_at: null },
        existing ? "update" : "create",
      )
    })
    return rule
  },

  /** Leaves a tombstone; a missing or deleted rule throws, like iOS `.notFound`. */
  async remove(id: string): Promise<void> {
    await db.transaction("rw", tables(), async () => {
      const existing = await db.categorization_rules.get(id)
      if (!existing || !isAlive(existing)) throw new NotFoundError(id)
      const now = stampAfter(existing.updated_at)
      await write({ ...existing, updated_at: now, deleted_at: now }, "delete")
    })
  },

  /** Stores this order; ids it leaves out keep their relative order after the listed ones. */
  async reorder(ids: readonly string[]): Promise<void> {
    await db.transaction("rw", tables(), async () => {
      const rank = new Map<string, number>()
      ids.forEach((id, index) => {
        if (!rank.has(id)) rank.set(id, index)
      })
      const rows = await db.categorization_rules.orderBy("sort_index").toArray()
      const listed = rows.filter((row) => rank.has(row.id)).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
      const ordered = [...listed, ...rows.filter((row) => !rank.has(row.id))]
      for (const [index, row] of ordered.entries()) {
        if (row.sort_index !== index) await write({ ...row, sort_index: index, updated_at: stampAfter(row.updated_at) }, "update")
      }
    })
  },
}
