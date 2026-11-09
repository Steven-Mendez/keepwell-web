import { db } from "@/lib/db"
import { newID } from "@/lib/schema/id"

const KEY = "client_id"

/**
 * This installation's identity for sync, created on first use and kept in IndexedDB next to the
 * outbox. The server tags each change with it so a pull skips this browser's own changes. If the
 * browser loses it (site data cleared), a new one is made and the sync engine asks for a snapshot;
 * the server never needs to know it was the same browser.
 */
export async function getClientId(): Promise<string> {
  return db.transaction("rw", db.meta, async () => {
    const existing = await db.meta.get(KEY)
    if (existing) return existing.value
    const id = newID()
    await db.meta.put({ key: KEY, value: id })
    return id
  })
}
