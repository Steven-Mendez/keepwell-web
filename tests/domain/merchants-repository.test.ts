// Merchants in IndexedDB: their own table and outbox events, and the links on movements, recurring
// rules and categorization rules travelling as the wire schema says.
import "fake-indexeddb/auto"

import { Dexie } from "dexie"
import { beforeEach, describe, expect, it } from "vitest"

import { db } from "@/lib/db"
import { deleteMerchant, saveMerchant } from "@/lib/domain"
import { categorizationRuleRepository, ledgerStore, merchantRepository, transactionRepository } from "@/lib/repositories"
import { parseSyncPayload, type Transaction } from "@/lib/schema"

const SUBWAY = "66666666-6666-4666-8666-666666666666"
const UBER_EATS = "77777777-7777-4777-8777-777777777777"

const movement: Transaction = {
  id: "44444444-4444-4444-8444-444444444444",
  date: "2026-11-01T18:00:00.000Z",
  status: "confirmed",
  description: "Subway",
  kind: "expense",
  categoryId: "restaurants",
  amount: "8",
  currency: "USD",
  accountId: "11111111-1111-4111-8111-111111111111",
  exchangeRate: { principal: "USD", second: "USD", rate: "1" },
  isShared: false,
  merchantId: SUBWAY,
  viaMerchantId: UBER_EATS,
}

beforeEach(async () => {
  db.close()
  await Dexie.delete("keepwell")
  await db.open()
})

const outbox = () => db.sync_outbox.orderBy("created_at").toArray()

describe("merchant storage", () => {
  it("saves, lists and deletes a merchant with valid sync events", async () => {
    await merchantRepository.save({ id: SUBWAY, name: "Subway", domain: "subway.com", brandId: "subway", isPlatform: false })
    expect(await merchantRepository.list()).toEqual([{ id: SUBWAY, name: "Subway", domain: "subway.com", brandId: "subway", isPlatform: false }])
    await merchantRepository.remove(SUBWAY)
    expect(await merchantRepository.list()).toEqual([])
    const events = await outbox()
    expect(events.map((e) => [e.entity, e.operation])).toEqual([
      ["merchant", "create"],
      ["merchant", "delete"],
    ])
    for (const event of events) expect(parseSyncPayload(event).success).toBe(true)
    expect(events[0]!.payload).toMatchObject({ domain: "subway.com", brand_id: "subway", default_category_id: null, is_platform: false })
  })

  it("keeps a movement's links, sends them always (null for none) and reads them back", async () => {
    await transactionRepository.save(movement)
    expect((await transactionRepository.list())[0]).toMatchObject({ merchantId: SUBWAY, viaMerchantId: UBER_EATS })
    const { merchantId: _m, viaMerchantId: _v, ...plain } = movement
    await transactionRepository.save(plain)
    const events = await outbox()
    expect(events[0]!.payload).toMatchObject({ merchant_id: SUBWAY, via_merchant_id: UBER_EATS })
    expect(events[1]!.payload).toMatchObject({ merchant_id: null, via_merchant_id: null })
    for (const event of events) expect(parseSyncPayload(event).success).toBe(true)
    expect((await transactionRepository.list())[0]!.merchantId).toBeUndefined()
  })

  it("reads rows from before merchants, which lack the columns", async () => {
    await transactionRepository.save(movement)
    const row = await db.transactions.get(movement.id)
    delete row!.merchant_id
    delete row!.via_merchant_id
    await db.transactions.put(row!)
    expect((await transactionRepository.list())[0]!.merchantId).toBeUndefined()
  })

  it("deleting through the use case unlinks the movements and rules in IndexedDB too", async () => {
    const saved = await saveMerchant(ledgerStore, { name: "Subway", domain: "subway.com" })
    const { viaMerchantId: _via, ...noVia } = movement
    await transactionRepository.save({ ...noVia, merchantId: saved.id })
    await categorizationRuleRepository.save({ id: "55555555-5555-4555-8555-555555555555", match: "Subway", categoryId: "restaurants", kind: "expense", merchantId: saved.id })
    await deleteMerchant(ledgerStore, saved.id)
    expect((await transactionRepository.list())[0]!.merchantId).toBeUndefined()
    expect((await categorizationRuleRepository.list())[0]!.merchantId).toBeUndefined()
    expect(await merchantRepository.list()).toEqual([])
  })
})
