/** Where the browser stands on keeping this site's IndexedDB under storage pressure. */
export type StoragePersistence = "persisted" | "best-effort" | "unsupported"

/**
 * Asks the browser never to evict IndexedDB, which holds the person's only local copy until sync
 * exists. Browsers may grant it silently (Chrome for installed or engaged sites, Firefox after a
 * prompt, Safari for home-screen apps), so it's asked on every launch until granted.
 */
export async function requestPersistentStorage(): Promise<StoragePersistence> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return "unsupported"
  if (await navigator.storage.persisted()) return "persisted"
  return (await navigator.storage.persist()) ? "persisted" : "best-effort"
}
