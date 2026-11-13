// Deleting a movement with "Undo": the tombstone waits for the notice to run out.
import "fake-indexeddb/auto"

import { Dexie } from "dexie"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import { DeferredDeletions, transactionRepository, type DeletionStorage } from "@/lib/repositories"
import type { Transaction } from "@/lib/schema"

const movement: Transaction = {
  id: "33333333-3333-4333-8333-333333333333",
  date: "2026-11-01T18:00:00.000Z",
  status: "confirmed",
  description: "Groceries",
  kind: "expense",
  amount: "42.50",
  currency: "USD",
  accountId: "44444444-4444-4444-8444-444444444444",
  exchangeRate: { principal: "USD", second: "NIO", rate: "36.6243" },
  isShared: false,
}

function memoryStorage(initial: string | null = null): DeletionStorage & { value: string | null } {
  const storage = {
    value: initial,
    read: () => storage.value,
    write: (value: string | null) => void (storage.value = value),
  }
  return storage
}

const deletions = (storage = memoryStorage()) =>
  new DeferredDeletions({ remove: (id) => transactionRepository.remove(id), storage, delayMs: 5000 })

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
  db.close()
  await Dexie.delete("keepwell")
  await db.open()
  await transactionRepository.save(movement)
  await db.sync_outbox.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("Deferred deletions", () => {
  it("deleting and undoing leaves the movement intact and writes no sync event", async () => {
    const queue = deletions()
    queue.schedule(movement.id)
    expect(queue.pending().has(movement.id)).toBe(true)
    await vi.advanceTimersByTimeAsync(4000)
    expect(queue.undo(movement.id)).toBe(true)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(queue.pending().size).toBe(0)
    expect(await transactionRepository.list()).toEqual([movement])
    expect(await db.sync_outbox.count()).toBe(0)
  })

  it("writes the tombstone when the notice runs out, and then it can't be undone", async () => {
    const queue = deletions()
    queue.schedule(movement.id)
    await vi.advanceTimersByTimeAsync(5000)
    expect(await transactionRepository.list()).toEqual([])
    expect((await db.sync_outbox.toArray()).map((event) => [event.entity, event.operation])).toEqual([["transaction", "delete"]])
    expect(queue.pending().size).toBe(0)
    expect(queue.undo(movement.id)).toBe(false)
  })

  it("finishes a deletion a closed tab left waiting", async () => {
    const storage = memoryStorage()
    deletions(storage).schedule(movement.id)
    expect(storage.value).toContain(movement.id)
    // The tab closes before the timer fires: a new start finds it overdue and deletes it now.
    vi.clearAllTimers()
    vi.setSystemTime(Date.now() + 60_000)
    const reopened = deletions(storage)
    reopened.resume()
    expect(reopened.pending().has(movement.id)).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(await transactionRepository.list()).toEqual([])
    expect(storage.value).toBeNull()
  })

  it("flush deletes everything waiting at once", async () => {
    const queue = deletions()
    queue.schedule(movement.id)
    await queue.flush()
    expect(await transactionRepository.list()).toEqual([])
    expect(queue.pending().size).toBe(0)
  })

  it("waits for the notice to close, however long it stays open, when scheduled until released", async () => {
    const queue = deletions()
    // The pointer rests on the notice: its countdown pauses, so no timer may delete behind it.
    queue.schedule(movement.id, { untilReleased: true })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(await transactionRepository.list()).toEqual([movement])
    expect(queue.undo(movement.id)).toBe(true)
    // Undo closes the notice, which releases a deletion that no longer exists.
    await queue.release(movement.id)
    expect(await transactionRepository.list()).toEqual([movement])
    expect(await db.sync_outbox.count()).toBe(0)
  })

  it("deletes when the notice closes on its own", async () => {
    const queue = deletions()
    queue.schedule(movement.id, { untilReleased: true })
    await vi.advanceTimersByTimeAsync(5000)
    await queue.release(movement.id)
    expect(await transactionRepository.list()).toEqual([])
    expect(queue.pending().size).toBe(0)
    expect(queue.undo(movement.id)).toBe(false)
  })

  it("keeps waiting for the notice when another tab's deletions arrive", async () => {
    const queue = deletions()
    queue.schedule(movement.id, { untilReleased: true })
    vi.setSystemTime(Date.now() + 60_000)
    queue.resume()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await transactionRepository.list()).toEqual([movement])
    expect(queue.undo(movement.id)).toBe(true)
  })

  it("still finishes a deletion held by a notice when the tab closes first", async () => {
    const storage = memoryStorage()
    deletions(storage).schedule(movement.id, { untilReleased: true })
    vi.clearAllTimers()
    vi.setSystemTime(Date.now() + 60_000)
    const reopened = deletions(storage)
    reopened.resume()
    await vi.advanceTimersByTimeAsync(0)
    expect(await transactionRepository.list()).toEqual([])
  })

  it("flush deletes held deletions too, as the page goes away", async () => {
    const queue = deletions()
    queue.schedule(movement.id, { untilReleased: true })
    await queue.flush()
    expect(await transactionRepository.list()).toEqual([])
  })

  it("forgets a deletion of a movement already gone elsewhere", async () => {
    const queue = deletions()
    queue.schedule(movement.id)
    await transactionRepository.remove(movement.id)
    await vi.advanceTimersByTimeAsync(5000)
    await vi.waitFor(() => expect(queue.pending().size).toBe(0))
  })
})
