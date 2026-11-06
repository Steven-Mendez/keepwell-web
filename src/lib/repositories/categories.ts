import { db, categoryToRow, rowToCategory, type CategoryRow } from "@/lib/db"
import {
  DEFAULT_CATEGORIES,
  TransactionCategory,
  isFallbackCategory,
  nowIso,
  orderedCategories,
  shippedCategory,
} from "@/lib/schema"

import { enqueue, isAlive } from "./shared"

/** "Other" and "Other income" receive a deleted category's movements, so they stay (iOS rule). */
export class FallbackCategoryError extends Error {
  override readonly name = "FallbackCategoryError"
}

async function nextSortIndex(): Promise<number> {
  const last = await db.categories.orderBy("sort_index").last()
  return last ? last.sort_index + 1 : 0
}

async function write(row: CategoryRow, operation: "create" | "update" | "delete") {
  await db.categories.put(row)
  await enqueue("category", row.id, operation, row, row.updated_at)
}

export const categoryRepository = {
  /** Alive categories in the person's order, the catch-all "Other" last per kind. */
  async list(): Promise<TransactionCategory[]> {
    const rows = await db.categories.orderBy("sort_index").filter(isAlive).toArray()
    return orderedCategories(rows.map(rowToCategory))
  },

  /**
   * Adds the shipped defaults that are missing: on first launch and when a newer version ships more.
   * A tombstone counts as present, so a deleted default stays deleted. Kept apart from `list` so
   * reads stay read-only (and usable in `useLiveQuery`).
   */
  async ensureDefaults(): Promise<void> {
    await db.transaction("rw", db.categories, db.sync_outbox, async () => {
      const present = new Set(await db.categories.toCollection().primaryKeys())
      const missing = DEFAULT_CATEGORIES.filter((category) => !present.has(category.id))
      let next = await nextSortIndex()
      const now = nowIso()
      for (const category of missing) {
        await write({ ...categoryToRow(category, next++), created_at: now, updated_at: now, deleted_at: null }, "create")
      }
    })
  },

  /** A new id goes after the existing ones; an existing one keeps its place. Saving a deleted one restores it. */
  async save(input: TransactionCategory): Promise<TransactionCategory> {
    const category = TransactionCategory.parse(input)
    await db.transaction("rw", db.categories, db.sync_outbox, async () => {
      const existing = await db.categories.get(category.id)
      const now = nowIso()
      const sortIndex = existing?.sort_index ?? (await nextSortIndex())
      await write(
        { ...categoryToRow(category, sortIndex), created_at: existing?.created_at ?? now, updated_at: now, deleted_at: null },
        existing ? "update" : "create",
      )
    })
    return category
  },

  /** Leaves a tombstone, also for a default never seeded, so `ensureDefaults` won't bring it back. */
  async remove(id: string): Promise<void> {
    if (isFallbackCategory(id)) throw new FallbackCategoryError(`Category ${id} can't be deleted`)
    await db.transaction("rw", db.categories, db.sync_outbox, async () => {
      const existing = await db.categories.get(id)
      const now = nowIso()
      if (existing) {
        if (!isAlive(existing)) return
        await write({ ...existing, updated_at: now, deleted_at: now }, "delete")
        return
      }
      // A missing created category has nothing to delete; the same delete may already have synced.
      const shipped = shippedCategory(id)
      if (!shipped) return
      await write({ ...categoryToRow(shipped, await nextSortIndex()), created_at: now, updated_at: now, deleted_at: now }, "delete")
    })
  },

  /** Stores this order; ids it leaves out keep their relative order after the listed ones. */
  async reorder(ids: readonly string[]): Promise<void> {
    await db.transaction("rw", db.categories, db.sync_outbox, async () => {
      const rank = new Map<string, number>()
      ids.forEach((id, index) => {
        if (!rank.has(id)) rank.set(id, index)
      })
      const rows = await db.categories.orderBy("sort_index").toArray()
      const listed = rows.filter((row) => rank.has(row.id)).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
      const now = nowIso()
      const ordered = [...listed, ...rows.filter((row) => !rank.has(row.id))]
      for (const [index, row] of ordered.entries()) {
        if (row.sort_index !== index) await write({ ...row, sort_index: index, updated_at: now }, "update")
      }
    })
  },

  /** Every default back as shipped (name, icon, color, order), deleted ones included; created ones follow. */
  async restoreDefaults(): Promise<void> {
    await db.transaction("rw", db.categories, db.sync_outbox, async () => {
      const rows = await db.categories.orderBy("sort_index").toArray()
      const byId = new Map(rows.map((row) => [row.id, row]))
      const now = nowIso()
      for (const [index, category] of DEFAULT_CATEGORIES.entries()) {
        const existing = byId.get(category.id)
        await write(
          { ...categoryToRow(category, index), created_at: existing?.created_at ?? now, updated_at: now, deleted_at: null },
          existing ? "update" : "create",
        )
      }
      const created = rows.filter((row) => !shippedCategory(row.id))
      for (const [offset, row] of created.entries()) {
        const sortIndex = DEFAULT_CATEGORIES.length + offset
        if (row.sort_index !== sortIndex) await write({ ...row, sort_index: sortIndex, updated_at: now }, "update")
      }
    })
  },
}
