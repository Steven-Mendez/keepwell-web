// The split summary: what came back of the others' shares and how many paid.
import { describe, expect, it } from "vitest"

import { splitProgress } from "@/components/debts/split-visuals"
import { dec, ZERO } from "@/lib/domain"

describe("splitProgress", () => {
  it("adds what was repaid, and a share settled by hand counts whole", () => {
    const progress = splitProgress([
      { amount: dec("511.88"), repaid: ZERO, paid: false },
      { amount: dec("247.37"), repaid: dec("100"), paid: false },
      { amount: dec("149.62"), repaid: ZERO, paid: true },
    ])
    expect(progress.total.toFixed()).toBe("908.87")
    expect(progress.collected.toFixed()).toBe("249.62")
    expect(progress.left.toFixed()).toBe("659.25")
    expect([progress.paid, progress.people]).toEqual([1, 3])
  })

  it("leaves nothing to collect once everyone paid", () => {
    const progress = splitProgress([
      { amount: dec("10"), repaid: dec("10"), paid: true },
    ])
    expect(progress.left.isZero()).toBe(true)
  })
})
