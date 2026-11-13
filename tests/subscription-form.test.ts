// "New subscription": the rule editor's short form saves the same rule as the full one.
import { describe, expect, it } from "vitest"

import {
  deriveForm,
  editorTypes,
  initialFields,
  type EditorFields,
} from "@/components/movement-editor/editor-state"
import {
  SUBSCRIPTION_PERIODS,
  periodOf,
  periodSchedule,
  recurringDraft,
  ruleIsSubscription,
} from "@/components/recurring/rule-draft"
import type { EditorRequest } from "@/components/app/app-actions"
import {
  SUBSCRIPTIONS_CATEGORY_ID,
  getTransactionContext,
  saveRecurringRule,
} from "@/lib/domain"
import { makeTranslator } from "@/lib/i18n"

import { date, sampleStore } from "./domain/fixtures"

const t = makeTranslator("en")
const TODAY = date(2026, 11, 12)

/** What the editor would save after the person types `patch` into a form opened with `request`. */
async function savedRule(
  request: EditorRequest,
  patch: Partial<EditorFields>,
  choices: {
    period: (typeof SUBSCRIPTION_PERIODS)[number]
    subscriptionChoice?: boolean
  }
) {
  const store = sampleStore()
  const context = await getTransactionContext(store)
  const initial = initialFields(
    request,
    context,
    editorTypes(context, undefined)
  )
  const fields = { ...initial.fields, ...patch }
  const form = deriveForm(t, context, request, fields, initial.date)
  const draft = recurringDraft(form.draft, {
    ...periodSchedule(choices.period),
    isSubscription: ruleIsSubscription(
      form.kind,
      fields.categoryId,
      choices.subscriptionChoice
    ),
    autoConfirm: false,
  })
  const { id: _id, ...rule } = await saveRecurringRule(store, draft, TODAY)
  return rule
}

describe("New subscription", () => {
  it("offers four periods, each an ordinary schedule", () => {
    expect(SUBSCRIPTION_PERIODS.map(periodSchedule)).toEqual([
      { frequency: "monthly", interval: 1 },
      { frequency: "monthly", interval: 3 },
      { frequency: "monthly", interval: 6 },
      { frequency: "yearly", interval: 1 },
    ])
    expect(periodOf("monthly", 6)).toBe("halfYearly")
    expect(periodOf("monthly", 2)).toBeUndefined()
    expect(periodOf("weekly", 1)).toBeUndefined()
  })

  it("saves with four fields the same rule the full editor saves with those values", async () => {
    const typed = {
      description: "Music",
      amountText: "9.99",
      dateText: "2026-11-05T09:00",
    }
    const short = await savedRule(
      {
        mode: "create",
        type: "expense",
        categoryId: SUBSCRIPTIONS_CATEGORY_ID,
      },
      typed,
      { period: "quarterly", subscriptionChoice: true }
    )
    const full = await savedRule(
      { mode: "create" },
      { ...typed, type: "expense", categoryId: SUBSCRIPTIONS_CATEGORY_ID },
      { period: "quarterly" }
    )
    expect(short).toEqual(full)
    expect(short).toMatchObject({
      kind: "expense",
      categoryId: SUBSCRIPTIONS_CATEGORY_ID,
      isSubscription: true,
      frequency: "monthly",
      interval: 3,
    })
    // A billing day already past: the first charge is a period after it.
    expect(new Date(short.nextDate)).toEqual(date(2027, 2, 5, 9))
  })
})
