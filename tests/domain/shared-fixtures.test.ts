import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { ENTITY_SCHEMAS, type EntityFixtures, type FixtureEntity } from "@/lib/fixtures"

const fixtures = JSON.parse(
  readFileSync(join(__dirname, "../../src/lib/fixtures/entities.json"), "utf8")
) as EntityFixtures

describe("shared entity fixtures", () => {
  it("covers every sync entity", () => {
    expect(Object.keys(fixtures.entities).sort()).toEqual(Object.keys(ENTITY_SCHEMAS).sort())
  })

  for (const entity of Object.keys(ENTITY_SCHEMAS) as FixtureEntity[]) {
    const schema = ENTITY_SCHEMAS[entity]
    const { valid, invalid } = fixtures.entities[entity]

    it.each(valid.map((c) => [c.name, c] as const))(`${entity} accepts %s`, (_, c) => {
      expect(schema.safeParse(c.value).success).toBe(true)
    })

    it.each(invalid.map((c) => [c.name, c] as const))(`${entity} rejects %s`, (_, c) => {
      expect(schema.safeParse(c.value).success).toBe(false)
    })
  }
})
