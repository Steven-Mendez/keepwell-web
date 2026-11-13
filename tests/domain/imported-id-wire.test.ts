// A movement's `imported_id` on the wire (T28): sent, read back, and a row from before the column
// reads as a movement that wasn't imported.
import { describe, expect, it } from "vitest"

import { rowToTransaction, transactionToRow } from "@/lib/db"
import { SYNC_WIRE } from "@/lib/schema"

import { transaction } from "./fixtures"

describe("imported_id on the wire", () => {
  const at = "2026-11-01T18:00:00.000Z"
  const audit = { created_at: at, updated_at: at, deleted_at: null }
  const movement = transaction({ amount: "12.50" })

  it("sends it, null when the movement wasn't imported, and reads it back", () => {
    expect(transactionToRow(movement)).toHaveProperty("imported_id", null)
    const row = { ...transactionToRow({ ...movement, importedId: "FIT-1" }), ...audit }
    expect(SYNC_WIRE.transaction.parse(row).imported_id).toBe("FIT-1")
    expect(rowToTransaction(row).importedId).toBe("FIT-1")
    expect(rowToTransaction({ ...transactionToRow(movement), ...audit })).not.toHaveProperty("importedId")
  })

  it("reads a row from before the column as a movement that wasn't imported", () => {
    const { imported_id: _, ...older } = { ...transactionToRow(movement), ...audit }
    expect(SYNC_WIRE.transaction.safeParse(older).success).toBe(true)
    expect(rowToTransaction(older)).not.toHaveProperty("importedId")
  })
})
