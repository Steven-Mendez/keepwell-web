// An edit opens with the charge its movement was saved with; changing what it was charged for clears it.
import { describe, expect, it } from "vitest"

import type { EditorRequest } from "@/components/app/app-actions"
import { carriedDebitText, clearingStaleDebit, deriveForm, editorTypes, initialFields } from "@/components/movement-editor/editor-state"
import { getTransactionContext } from "@/lib/domain"
import { makeTranslator } from "@/lib/i18n"

import { sampleStore } from "./domain/fixtures"

const t = makeTranslator("en")

async function editingMovies() {
  const store = sampleStore()
  const movies = (await store.fetchTransactions()).find((transaction) => transaction.description === "Movies")!
  const context = await getTransactionContext(store)
  const request = { mode: "edit", transaction: movies } as EditorRequest
  const initial = initialFields(request, context, editorTypes(context, movies))
  return { movies, context, request, initial, carried: carriedDebitText(movies) }
}

describe("the charge an edited movement opens with", () => {
  it("stays while the amount and currency do", async () => {
    const { context, request, initial, carried } = await editingMovies()
    expect(initial.fields.debitedText).toBe(carried)
    expect(carried).not.toBe("")
    const patch = clearingStaleDebit(initial.fields, { description: "Cinema", amountText: "739.320" }, carried)
    expect(patch).not.toHaveProperty("debitedText")
    const form = deriveForm(t, context, request, { ...initial.fields, ...patch }, initial.date)
    expect(form.draft.actualDebitedPrincipal?.toFixed(2)).toBe("20.42")
  })

  it("clears when the amount changes", async () => {
    const { initial, carried } = await editingMovies()
    expect(clearingStaleDebit(initial.fields, { amountText: "800" }, carried)).toEqual({ amountText: "800", debitedText: "" })
  })

  it("clears when the currency changes", async () => {
    const { initial, carried } = await editingMovies()
    expect(clearingStaleDebit(initial.fields, { currency: "USD" }, carried)).toEqual({ currency: "USD", debitedText: "" })
  })

  it("leaves a charge the person typed", async () => {
    const { initial, carried } = await editingMovies()
    const typed = { ...initial.fields, debitedText: "22.10" }
    expect(clearingStaleDebit(typed, { amountText: "800" }, carried)).toEqual({ amountText: "800" })
    expect(clearingStaleDebit(initial.fields, { amountText: "800", debitedText: "22" }, carried)).toEqual({ amountText: "800", debitedText: "22" })
  })

  it("a new movement or one in the principal currency carries none", async () => {
    const { initial } = await editingMovies()
    expect(clearingStaleDebit(initial.fields, { amountText: "800" }, "")).toEqual({ amountText: "800" })
    const store = sampleStore()
    const designSoftware = (await store.fetchTransactions()).find((transaction) => transaction.description === "Design software")!
    expect(carriedDebitText({ ...designSoftware, actualDebitedPrincipal: "201" })).toBe("")
  })
})
