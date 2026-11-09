import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { legacyRepaymentId, loanPaymentId, occurrenceId, uuidV5, validateSyncEvent } from "@/lib/schema"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Case = { name: string } & Record<string, any>
const read = (name: string) => JSON.parse(readFileSync(join(__dirname, "../../src/lib/fixtures", name), "utf8")) as Record<string, Case[]>

describe("shared id vectors", () => {
  const ids = read("ids.json")
  it.each(ids.uuidV5!.map((c) => [c.name, c] as const))("uuidV5(%s)", (_, c) => {
    expect(uuidV5(c.name, c.namespace)).toBe(c.id)
  })
  it("occurrence, loan payment and legacy repayment ids", () => {
    for (const c of ids.occurrences!) expect(occurrenceId(c.rule, c.index)).toBe(c.id)
    for (const c of ids.loanPayments!) expect(loanPaymentId(c.loanId, c.number)).toBe(c.id)
    for (const c of ids.legacyRepayments!) expect(legacyRepaymentId(c.debtId, c.index, c.date, c.amount)).toBe(c.id)
  })
})

describe("shared sync events", () => {
  const sync = read("sync.json")
  it.each(sync.valid!.map((c) => [c.name, c] as const))("accepts %s", (_, c) => {
    const result = validateSyncEvent(c.event)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (result.ok) {
      expect(result.row).not.toHaveProperty("user_id")
      expect(result.row).not.toHaveProperty("server_seq")
    }
  })
  it.each(sync.invalid!.map((c) => [c.name, c] as const))("rejects %s", (_, c) => {
    expect(validateSyncEvent(c.event).ok).toBe(false)
  })
})

describe("shared wire columns", () => {
  it("matches schema/sync.ts", async () => {
    const { SYNC_WIRE } = await import("@/lib/schema")
    const columns = JSON.parse(readFileSync(join(__dirname, "../../src/lib/fixtures/wire-columns.json"), "utf8")).entities as Record<string, Record<string, unknown>>
    for (const [entity, wire] of Object.entries(SYNC_WIRE)) {
      expect(Object.keys(columns[entity]!).sort(), entity).toEqual(Object.keys(wire.shape).sort())
    }
  })
})
