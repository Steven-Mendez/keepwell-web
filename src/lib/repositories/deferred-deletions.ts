import { transactionRepository } from "./transactions"

/** How long a deleted movement can still be taken back; its tombstone is written after it. */
export const UNDO_WINDOW_MS = 6000

/** Where the waiting deletions are remembered, so one still happens when the tab closes first. */
export interface DeletionStorage {
  read(): string | null
  write(value: string | null): void
}

interface Options {
  /** Writes the tombstone. A movement already gone counts as deleted. */
  remove: (id: string) => Promise<void>
  storage: DeletionStorage
  delayMs?: number
  now?: () => number
}

/**
 * Deletes movements a few seconds late, so "Undo" can take one back without a tombstone or a sync
 * event ever being written. Until then the movement is only hidden (`pending`). Each deletion is
 * kept in `storage` with when it falls due: `resume` finishes the ones a closed tab left behind.
 */
export class DeferredDeletions {
  private readonly due = new Map<string, number>()
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  /** Deletions whose tombstone is being written: too late to undo. */
  private readonly committing = new Set<string>()
  private readonly listeners = new Set<() => void>()
  private snapshot: ReadonlySet<string> = new Set()
  private readonly remove: Options["remove"]
  private readonly storage: DeletionStorage
  private readonly delayMs: number
  private readonly now: () => number

  constructor({ remove, storage, delayMs = UNDO_WINDOW_MS, now = Date.now }: Options) {
    this.remove = remove
    this.storage = storage
    this.delayMs = delayMs
    this.now = now
  }

  /** The movements deleted but still undoable: screens leave them out. */
  pending(): ReadonlySet<string> {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  schedule(id: string): void {
    this.due.set(id, this.now() + this.delayMs)
    this.changed()
    this.arm(id)
  }

  /** Takes a deletion back; `false` when it already happened. */
  undo(id: string): boolean {
    if (!this.due.has(id) || this.committing.has(id)) return false
    this.disarm(id)
    this.due.delete(id)
    this.changed()
    return true
  }

  /**
   * Picks up what storage holds (another tab's deletions, or this tab's before it closed), and
   * arms each one for whatever is left of its window: one already due is deleted now.
   */
  resume(): void {
    this.due.clear()
    for (const [id, due] of this.stored()) this.due.set(id, due)
    for (const id of this.timers.keys()) if (!this.due.has(id)) this.disarm(id)
    this.publish()
    for (const id of this.due.keys()) if (!this.timers.has(id)) this.arm(id)
  }

  /** Deletes every waiting movement now. */
  async flush(): Promise<void> {
    await Promise.all([...this.due.keys()].map((id) => this.commit(id)))
  }

  private async commit(id: string): Promise<void> {
    this.disarm(id)
    if (!this.due.has(id) || this.committing.has(id)) return
    this.committing.add(id)
    try {
      await this.remove(id)
    } catch (error) {
      // Kept for the next start, unless it was already gone (deleted on another device or tab).
      // Dexie rethrows the repository's `NotFoundError` as its own error of the same name.
      if (!(error instanceof Error && error.name === "NotFoundError")) return
    } finally {
      this.committing.delete(id)
    }
    this.due.delete(id)
    this.changed()
  }

  private arm(id: string) {
    this.disarm(id)
    const wait = Math.max(0, (this.due.get(id) ?? 0) - this.now())
    this.timers.set(id, setTimeout(() => void this.commit(id), wait))
  }

  private disarm(id: string) {
    const timer = this.timers.get(id)
    if (timer !== undefined) clearTimeout(timer)
    this.timers.delete(id)
  }

  private stored(): [string, number][] {
    try {
      const parsed: unknown = JSON.parse(this.storage.read() ?? "[]")
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (entry): entry is [string, number] => Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "number"
      )
    } catch {
      return []
    }
  }

  private changed() {
    try {
      this.storage.write(this.due.size > 0 ? JSON.stringify([...this.due]) : null)
    } catch {
      // Without storage the deletion still happens on time; it just can't outlive the tab.
    }
    this.publish()
  }

  private publish() {
    this.snapshot = new Set(this.due.keys())
    for (const listener of this.listeners) listener()
  }
}

const STORAGE_KEY = "keepwell.pendingDeletions"

const localDeletionStorage: DeletionStorage = {
  read: () => {
    try {
      return window.localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  },
  write: (value) => {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, value)
  },
}

let shared: DeferredDeletions | undefined

/**
 * This browser's deferred deletions of movements, started on first use: it finishes what a closed
 * tab left waiting, follows other tabs through `storage` and tries to finish its own when the page
 * goes away (the next start finishes them otherwise).
 */
export function movementDeletions(): DeferredDeletions {
  if (shared) return shared
  const deletions = new DeferredDeletions({ remove: (id) => transactionRepository.remove(id), storage: localDeletionStorage })
  shared = deletions
  if (typeof window !== "undefined") {
    deletions.resume()
    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY) deletions.resume()
    })
    window.addEventListener("pagehide", () => void deletions.flush())
  }
  return deletions
}

export { STORAGE_KEY as PENDING_DELETIONS_KEY }
