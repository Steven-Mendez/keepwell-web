import { describe, expect, it } from "vitest"

import { movementReference, rowMenuActions } from "@/components/transactions/row-menu-model"

describe("Row menu", () => {
  it("offers Split on expenses only and Confirm on drafts only, like iOS", () => {
    expect(rowMenuActions({ kind: "expense", status: "confirmed", tags: [] }).map((a) => a.kind)).toEqual(["split", "delete"])
    expect(rowMenuActions({ kind: "income", status: "planned", tags: [] }).map((a) => a.kind)).toEqual(["confirm", "delete"])
    expect(rowMenuActions({ kind: "transfer", status: "confirmed" }).map((a) => a.kind)).toEqual(["delete"])
  })

  it("lists a Show action per tag first", () => {
    expect(rowMenuActions({ kind: "expense", status: "planned", tags: ["boda", "viaje"] }).map((a) => a.kind)).toEqual(["showTag", "showTag", "split", "confirm", "delete"])
  })

  it("writes the reference like iOS", () => {
    expect(movementReference("a1b2c3d4-0000-4000-8000-000000000000")).toBe("KW-A1B2C3D4")
  })
})
