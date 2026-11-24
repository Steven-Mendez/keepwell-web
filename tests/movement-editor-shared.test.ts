// Editing a shared split in the editor keeps its public link working.
import { describe, expect, it } from "vitest"

import type { EditorRequest } from "@/components/app/app-actions"
import { deriveForm, editorTypes, initialFields } from "@/components/movement-editor/editor-state"
import { getTransactionContext, saveTransaction, shareSplit, splitTransaction } from "@/lib/domain"
import { makeTranslator } from "@/lib/i18n"

import { d, sampleStore } from "./domain/fixtures"

const t = makeTranslator("en")

describe("a shared split in the editor", () => {
  it("keeps its share token when the person changes its description", async () => {
    const store = sampleStore()
    const lunch = store.transactions.find((movement) => movement.description === "Lunch")!
    await splitTransaction(store, lunch.id, [{ person: "Ana", amount: d(10) }])
    const shared = await shareSplit(store, lunch.id)

    const context = await getTransactionContext(store)
    const request = { mode: "edit", transaction: shared } as EditorRequest
    const initial = initialFields(request, context, editorTypes(context, shared))
    const form = deriveForm(t, context, request, { ...initial.fields, description: "Almuerzo" }, initial.date)
    await saveTransaction(store, form.draft)

    expect(store.transactions.find((movement) => movement.id === lunch.id)).toMatchObject({ description: "Almuerzo", shareToken: shared.shareToken })
  })
})
