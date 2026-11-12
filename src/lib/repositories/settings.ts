import { db, rowToSettings, settingsToRow, SETTINGS_ID } from "@/lib/db"
import { Settings } from "@/lib/schema"

import { LOCAL_SETTINGS_COLUMNS } from "@/lib/db"

import { enqueue, stampAfter } from "./shared"

export const settingsRepository = {
  /** `undefined` before onboarding saves the first settings. */
  async load(): Promise<Settings | undefined> {
    const row = await db.settings.get(SETTINGS_ID)
    return row ? rowToSettings(row) : undefined
  },

  async save(input: Settings): Promise<Settings> {
    const settings = Settings.parse(input)
    await db.transaction("rw", db.settings, db.sync_outbox, async () => {
      const existing = await db.settings.get(SETTINGS_ID)
      const now = stampAfter(existing?.updated_at)
      const row = settingsToRow(settings, now, existing?.created_at ?? now)
      // A change to this device's own preferences (unlock, relock, hiding amounts) doesn't sync.
      const synced = (r: typeof row) => Object.entries(r).filter(([key]) => !["created_at", "updated_at", ...LOCAL_SETTINGS_COLUMNS].includes(key)).map(([k, v]) => `${k}=${String(v)}`).join("|")
      const syncedChanged = !existing || synced(existing) !== synced(row)
      await db.settings.put(syncedChanged ? row : { ...row, updated_at: existing.updated_at })
      if (syncedChanged) await enqueue("settings", SETTINGS_ID, existing ? "update" : "create", row, now)
    })
    return settings
  },
}
