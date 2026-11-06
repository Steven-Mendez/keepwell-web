import { db, type SyncOutboxRow } from "@/lib/db"

/** Read side of the outbox, for the future sync engine and for showing pending changes. */
export const syncOutboxRepository = {
  async pendingCount(): Promise<number> {
    return db.sync_outbox.count()
  },

  /** Oldest first, the order a sync engine must push them in. */
  async pending(limit = 100): Promise<SyncOutboxRow[]> {
    return db.sync_outbox.orderBy("created_at").limit(limit).toArray()
  },
}
