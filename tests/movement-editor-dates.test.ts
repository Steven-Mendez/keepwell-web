import { describe, expect, it } from "vitest"

import { withDay } from "@/components/movement-editor/editor-state"

describe("withDay", () => {
  it("keeps the time of day when the day changes, as iOS's date-only picker", () => {
    expect(withDay("2026-11-11T08:45", "2026-12-01")).toBe("2026-12-01T08:45")
  })
  it("ignores a cleared or partial date input", () => {
    expect(withDay("2026-11-11T08:45", "")).toBe("2026-11-11T08:45")
  })
})
