import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { validateSyncEvent } from "@/lib/schema"

// `sync-v1.json` is `sync.json` as it was when the format shipped, and it never changes. Rows like
// these already live on phones, browsers and the server, so the current schema must still accept
// each one and keep every column: a renamed, removed or newly required column fails here even
// after `sync.json` is updated to match. keepwell-api and keepwell-ios run the same file.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Case = { name: string; event: { entity: string; entity_id: string; operation: string; payload: Record<string, any> } }
const v1 = JSON.parse(readFileSync(join(__dirname, "../../src/lib/fixtures/sync-v1.json"), "utf8")) as { version: number; valid: Case[] }

/** Only the server writes these; the schema drops them on purpose. */
const SERVER_COLUMNS = new Set(["user_id", "server_seq", "applied_at"])

describe("sync format v1", () => {
  it("is version 1", () => {
    expect(v1.version).toBe(1)
  })

  it.each(v1.valid.map((c) => [c.name, c] as const))("still reads %s", (_, c) => {
    const result = validateSyncEvent(c.event)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    expect(result.event).toMatchObject({ entity: c.event.entity, entity_id: c.event.entity_id, operation: c.event.operation })
    const row = result.row as Record<string, unknown>
    for (const [column, value] of Object.entries(c.event.payload)) {
      if (SERVER_COLUMNS.has(column)) continue
      expect(row, `${c.event.entity}.${column}`).toHaveProperty([column], value)
    }
  })
})
