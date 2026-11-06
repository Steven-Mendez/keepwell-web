// The backup file through the real IndexedDB store (fake-indexeddb): a version 1 file restores, and
// what it exports again is version 2 with the recurring rules and the movements they produced.
import "fake-indexeddb/auto"

import { describe, expect, it } from "vitest"

import { materializeRecurring } from "@/lib/domain"
import { backupRepository, categoryRepository, ledgerStore, recurringRuleRepository, syncOutboxRepository } from "@/lib/repositories"
import { DEFAULT_SETTINGS, type BackupFile } from "@/lib/schema"

import { IDs, date, sampleData } from "./fixtures"

const audit = { createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z" }

function v1File(): string {
  const sample = sampleData()
  return JSON.stringify({
    schemaVersion: 1,
    exportedAt: audit.updatedAt,
    settings: { ...DEFAULT_SETTINGS, currencies: sample.settings.currencies, updatedAt: audit.updatedAt },
    accounts: sample.accounts.map((account) => ({ ...account, ...audit })),
    cards: sample.cards.map((card) => ({ ...card, ...audit })),
    categories: [],
    transactions: sample.transactions.map((transaction) => ({ ...transaction, ...audit })),
  })
}

describe("Backup through IndexedDB", () => {
  it("restores a version 1 file and exports the current version with rules and recurringId", async () => {
    const summary = await backupRepository.import(v1File())
    expect(summary.accounts).toBe(5)
    // The app seeds the shipped categories on launch; the file listed none.
    await categoryRepository.ensureDefaults()
    expect(await recurringRuleRepository.list()).toEqual([])

    const rule = await recurringRuleRepository.save({
      id: "00000000-0000-0000-0000-00000000e001",
      name: "Streaming",
      kind: "expense",
      categoryId: "subscriptions",
      amount: "197.02",
      currency: "NIO",
      accountId: IDs.mastercard,
      cardId: IDs.mastercardHolder,
      frequency: "monthly",
      interval: 1,
      startDate: date(2026, 9, 2, 9).toISOString(),
      nextDate: date(2026, 10, 2, 9).toISOString(),
      isSubscription: true,
      autoConfirm: false,
      isPaused: false,
    })
    const pending = await syncOutboxRepository.pending(1000)
    expect(pending.some((event) => event.entity === "recurringRule" && event.entity_id === rule.id && event.operation === "create")).toBe(true)

    const created = await materializeRecurring(ledgerStore, date(2026, 10, 3))
    expect(created).toHaveLength(1)

    const exported = JSON.parse(await backupRepository.export()) as BackupFile
    expect(exported.schemaVersion).toBe(4)
    expect(exported.recurringRules).toHaveLength(1)
    expect(exported.recurringRules[0]).toMatchObject({ id: rule.id, nextDate: date(2026, 11, 2, 9).toISOString() })
    const produced = exported.transactions.find((transaction) => transaction.recurringId === rule.id)
    expect(produced).toMatchObject({ status: "planned", description: "Streaming", amount: "197.02" })
    if (process.env.KEEPWELL_PRINT_EXAMPLE) console.log(JSON.stringify({ rule: exported.recurringRules[0], transaction: produced }, null, 2))

    // And the exported file restores as it was.
    await backupRepository.import(JSON.stringify(exported))
    expect((await recurringRuleRepository.list()).map((saved) => saved.id)).toEqual([rule.id])
    expect((await ledgerStore.fetchTransactions()).filter((transaction) => transaction.recurringId === rule.id)).toHaveLength(1)
  })
})
