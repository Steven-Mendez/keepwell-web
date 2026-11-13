// A closed account is never a new movement's default method, even though its closing transfer is
// the newest movement (and so the "last used" source).
import { describe, expect, it } from "vitest"

import type { EditorRequest } from "@/components/app/app-actions"
import {
  editorTypes,
  initialFields,
} from "@/components/movement-editor/editor-state"
import {
  closeAccount,
  closingPlan,
  getTransactionContext,
  lastUsedSource,
  pickerContext,
} from "@/lib/domain"

import { IDs, referenceDate, sampleStore } from "./domain/fixtures"

// After every movement of the sample, drafts included, so the closing transfer is the newest.
const later = new Date(referenceDate.getTime() + 365 * 86_400_000)

async function contextAfterClosing(accountId: string) {
  const store = sampleStore()
  const context = await getTransactionContext(store)
  const plan = closingPlan(
    {
      ...context,
      recurringRules: await store.fetchRecurringRules(),
      timeZone: context.zone,
    },
    accountId
  )
  // "Move and close": the balance goes to the first account that can take it.
  await closeAccount(store, accountId, { transferTo: plan.destinations[0]!.id }, later)
  return pickerContext(await getTransactionContext(store))
}

describe("the editor's default method", () => {
  it("skips a closed cash account that was used last", async () => {
    const context = await contextAfterClosing(IDs.cash)
    expect(lastUsedSource(context)).toEqual({ type: "account", id: IDs.cash })
    for (const request of [
      { mode: "create" },
      { mode: "create", type: "expense" },
      { mode: "create", type: "income" },
      // The short "add a subscription" form and the rule editor start the same way.
      { mode: "create", type: "expense", categoryId: "subscriptions" },
    ] as EditorRequest[]) {
      const { fields } = initialFields(
        request,
        context,
        editorTypes(context, undefined)
      )
      expect(fields.source).toBeDefined()
      expect(fields.source).not.toEqual({ type: "account", id: IDs.cash })
    }
  })

  it("skips the cards of a closed bank account that was used last", async () => {
    const context = await contextAfterClosing(IDs.savings)
    const { fields } = initialFields(
      { mode: "create" } as EditorRequest,
      context,
      editorTypes(context, undefined)
    )
    const closedCards = [IDs.savingsDebit, IDs.savingsTransfer]
    expect(
      fields.source?.type === "card" && closedCards.includes(fields.source.id)
    ).toBe(false)
    expect(
      fields.source?.type === "account" && fields.source.id === IDs.savings
    ).toBe(false)
  })
})
