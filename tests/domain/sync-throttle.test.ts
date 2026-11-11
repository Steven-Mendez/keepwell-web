import { describe, expect, it } from "vitest"

import { ApiError } from "@/lib/api/client"
import { inBatches, SNAPSHOT_PARALLEL } from "@/lib/sync/engine"
import { withRetry } from "@/lib/sync/transport"

// The API runs on a function with little concurrency: a first sign-in that fetched every entity at
// once went over it and came back 503 ("Service Unavailable"), so the restore failed.
describe("Snapshot downloads stay under the API's concurrency", () => {
  it("runs at most the limit at once and keeps the items' order", async () => {
    let running = 0
    let peak = 0
    const items = Array.from({ length: 11 }, (_, index) => index)
    const results = await inBatches(items, SNAPSHOT_PARALLEL, async (item) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 5 + (item % 3)))
      running--
      return item * 2
    })
    expect(peak).toBe(SNAPSHOT_PARALLEL)
    expect(results).toEqual(items.map((item) => item * 2))
  })

  it("retries a busy API (503, 429) and gives up on anything else", async () => {
    let calls = 0
    const busyTwice = () => {
      calls++
      return calls <= 2
        ? Promise.reject(new ApiError(503, "http_error", "Service Unavailable"))
        : Promise.resolve("ok")
    }
    await expect(withRetry(busyTwice, [0, 0, 0])).resolves.toBe("ok")
    expect(calls).toBe(3)

    let forbidden = 0
    const needsPlan = () => {
      forbidden++
      return Promise.reject(new ApiError(403, "needs_plan", "No"))
    }
    await expect(withRetry(needsPlan, [0, 0, 0])).rejects.toMatchObject({
      status: 403,
    })
    expect(forbidden).toBe(1)

    let always = 0
    const alwaysBusy = () => {
      always++
      return Promise.reject(
        new ApiError(429, "http_error", "Too Many Requests")
      )
    }
    await expect(withRetry(alwaysBusy, [0, 0])).rejects.toMatchObject({
      status: 429,
    })
    expect(always).toBe(3)
  })
})
