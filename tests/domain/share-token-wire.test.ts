// A split expense's `share_token` on the wire: sent, null once sharing stops, and a row from before
// the column reads as a movement that isn't shared.
import { describe, expect, it } from "vitest"

import { rowToTransaction, transactionToRow } from "@/lib/db"
import { SYNC_WIRE } from "@/lib/schema"

import { transaction } from "./fixtures"

describe("share_token on the wire", () => {
  const at = "2026-11-01T18:00:00.000Z"
  const audit = { created_at: at, updated_at: at, deleted_at: null }
  const movement = transaction({ amount: "12.50" })
  const token = "AbCdEfGhIjKlMnOpQrSt_-"

  it("sends it, null when not shared, and reads it back", () => {
    expect(transactionToRow(movement)).toHaveProperty("share_token", null)
    const row = { ...transactionToRow({ ...movement, shareToken: token }), ...audit }
    expect(SYNC_WIRE.transaction.parse(row).share_token).toBe(token)
    expect(rowToTransaction(row).shareToken).toBe(token)
  })

  it("reads a row from before the column as not shared, and refuses a malformed token", () => {
    const { share_token: _, ...older } = { ...transactionToRow(movement), ...audit }
    expect(SYNC_WIRE.transaction.safeParse(older).success).toBe(true)
    expect(rowToTransaction(older)).not.toHaveProperty("shareToken")
    expect(SYNC_WIRE.transaction.safeParse({ ...older, share_token: "short" }).success).toBe(false)
  })
})
