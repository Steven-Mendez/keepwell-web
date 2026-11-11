import { describe, expect, it } from "vitest"

import { relativeTime } from "@/lib/presentation/relative-time"

const now = new Date("2026-11-11T12:00:00Z")

describe("relativeTime", () => {
  it("names the distance like iOS's named relative style", () => {
    expect(relativeTime("2026-11-11T11:58:00Z", now, "en")).toBe("2 minutes ago")
    expect(relativeTime("2026-11-10T12:00:00Z", now, "en")).toBe("yesterday")
    expect(relativeTime("2026-11-11T12:00:00Z", now, "en")).toBe("now")
    expect(relativeTime("2026-11-11T09:00:00Z", now, "es")).toBe("hace 3 horas")
  })
})
