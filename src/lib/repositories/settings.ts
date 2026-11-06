import { db, rowToSettings, settingsToRow, SETTINGS_ID } from "@/lib/db"
import { Settings, nowIso } from "@/lib/schema"

import { enqueue } from "./shared"

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
      const row = settingsToRow(settings, nowIso())
      await db.settings.put(row)
      await enqueue("settings", SETTINGS_ID, existing ? "update" : "create", row, row.updated_at)
    })
    return settings
  },
}
