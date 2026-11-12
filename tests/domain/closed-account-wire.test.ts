// A closed account's `closed_at` on the wire (T25): always sent, read back, and a row from an app
// older (or newer) than the column applies without failing.
import "fake-indexeddb/auto"

import { Dexie } from "dexie"
import { beforeEach, describe, expect, it } from "vitest"

import { accountToRow, db, rowToAccount } from "@/lib/db"
import { ledgerStore } from "@/lib/repositories"
import { applyRemote } from "@/lib/repositories/shared"
import { SYNC_WIRE, type Account } from "@/lib/schema"

const account = (overrides: Partial<Account> = {}): Account => ({
  id: "00000000-0000-0000-0000-00000000c105",
  name: "Old savings",
  kind: "deposit",
  openingBalances: [{ amount: "0", currency: "USD" }],
  openingDate: "2026-01-01T12:00:00.000Z",
  ...overrides,
})

describe("closed_at on the wire", () => {
  beforeEach(async () => {
    db.close()
    await Dexie.delete("keepwell")
    await db.open()
  })

  const at = "2026-11-01T18:00:00.000Z"
  const audit = { created_at: at, updated_at: at, deleted_at: null }

  it("always sends closed_at, null while open, so reopening clears it on the other devices", () => {
    expect(accountToRow(account())).toHaveProperty("closed_at", null)
    expect(accountToRow(account({ closedAt: at })).closed_at).toBe(at)
    expect(rowToAccount({ ...accountToRow(account({ closedAt: at })), ...audit }).closedAt).toBe(at)
  })

  it("reads a row from before the column as an open account", () => {
    const { closed_at: _, ...older } = { ...accountToRow(account()), ...audit }
    expect(SYNC_WIRE.account.safeParse(older).success).toBe(true)
    expect(rowToAccount(older)).not.toHaveProperty("closedAt")
  })

  it("applies a pulled row with a column this app doesn't know yet, without failing, and keeps the closing", async () => {
    const row = { ...accountToRow(account({ closedAt: at })), ...audit, a_later_column: "x" }
    const parsed = SYNC_WIRE.account.safeParse(row)
    expect(parsed.success).toBe(true)
    expect(parsed.data).not.toHaveProperty("a_later_column")
    expect(await applyRemote("account", parsed.data as never)).toBe("applied")
    const [loaded] = await ledgerStore.fetchAccounts()
    expect(loaded?.closedAt).toBe(at)
  })
})
