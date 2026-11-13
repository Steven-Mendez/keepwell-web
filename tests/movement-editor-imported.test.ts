// T28: editing an imported movement in the editor keeps the statement line it came from.
import { describe, expect, it } from "vitest"

import type { EditorRequest } from "@/components/app/app-actions"
import { deriveForm, editorTypes, initialFields } from "@/components/movement-editor/editor-state"
import { getTransactionContext, importedTransactionId, importTransactions, saveTransaction } from "@/lib/domain"
import { makeTranslator } from "@/lib/i18n"

import { IDs, sampleStore } from "./domain/fixtures"

const t = makeTranslator("en")

describe("an imported movement in the editor", () => {
  it("keeps its importedId when the person changes its description, category and amount", async () => {
    const store = sampleStore()
    await importTransactions(store, {
      accountId: IDs.savings,
      lines: [{ day: "2026-10-08", direction: "out", amount: "9.40", currency: "USD", description: "POS PANADERIA", importedId: "FIT-77" }],
      dryRun: false,
    })
    const id = importedTransactionId(IDs.savings, "FIT-77")
    const imported = (await store.fetchTransactions()).find((transaction) => transaction.id === id)!

    const context = await getTransactionContext(store)
    const request = { mode: "edit", transaction: imported } as EditorRequest
    const initial = initialFields(request, context, editorTypes(context, imported))
    const fields = { ...initial.fields, description: "Panadería", categoryId: "groceries", amountText: "9.45" }
    const form = deriveForm(t, context, request, fields, initial.date)
    await saveTransaction(store, form.draft)

    expect((await store.fetchTransactions()).find((transaction) => transaction.id === id)).toMatchObject({ description: "Panadería", categoryId: "groceries", amount: "9.45", importedId: "FIT-77" })
  })
})
