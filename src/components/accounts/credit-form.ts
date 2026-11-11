import { ZERO, type CreditCardDraft } from "@/lib/domain"
import { parseAmount } from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"
import type { CardColor, CardNetwork, DebtMode } from "@/lib/schema"

// The add-credit-card form's values and checks, apart from its markup in add-account-dialog.tsx.

export type CreditFormValues = {
  bank: string
  lastFour: string
  network: CardNetwork
  color: CardColor
  debtMode: DebtMode
  principalDebt: string
  secondDebt: string
  limit: string
  cutoff: string
  due: string
}

export type CreditFormErrors = {
  /** Required: no text, as iOS only keeps Add disabled until there are 4 digits. */
  lastFour?: boolean
  principalDebt?: string
  secondDebt?: string
  limit?: string
  form?: string
}

/** A blank form as iOS starts it: a Mastercard, debts at 0.00, dual with a second currency. */
export function initialCreditForm(
  second: string | undefined
): CreditFormValues {
  return {
    bank: "",
    lastFour: "",
    network: "mastercard",
    color: "azul",
    debtMode: second ? "dual" : "principal",
    principalDebt: "0.00",
    secondDebt: "0.00",
    limit: "",
    cutoff: "",
    due: "",
  }
}

/** The last four digits are required: exactly 4 (iOS `isLastFourValid`). */
export const hasLastFour = (form: Pick<CreditFormValues, "lastFour">) =>
  /^\d{4}$/.test(form.lastFour)

/** The sentence under "Card added" for a credit card (iOS `AddCardViewModel.summary`). */
export function creditAddedSummary(
  t: Translator,
  form: CreditFormValues,
  currencies: { principal: string; second?: string | undefined },
  reminderDays: number
): string {
  const first = currencies.principal
  const other = currencies.second ?? first
  const mode = currencies.second ? form.debtMode : "principal"
  const debt =
    mode === "dual"
      ? t.in("addcard", "Debt in %@ and %@", first, other)
      : t.in("addcard", "Debt in %@", mode === "second" ? other : first)
  const cutoff = Number(form.cutoff)
  const due = Number(form.due)
  // The cycle is optional: one sentence per combination of days set, as iOS AddCardViewModel.
  const cycle =
    form.cutoff && form.due
      ? t.in("addcard", "%@ · cutoff day %lld · due day %lld.", debt, cutoff, due)
      : form.cutoff
        ? t.in("addcard", "%@ · cutoff day %lld.", debt, cutoff)
        : form.due
          ? t.in("addcard", "%@ · due day %lld.", debt, due)
          : t.in("addcard", "%@.", debt)
  return form.due
    ? `${cycle} ${t.in("addcard", "We'll remind you %lld days before the due date.", reminderDays)}`
    : cycle
}

/** An empty debt is no debt; anything else must parse. */
const debtAmount = (text: string) =>
  text.trim() === "" ? ZERO : parseAmount(text)

/**
 * Checks the form and, when it passes, the draft to save. Errors are per field so each one shows
 * under its own input.
 */
export function validateCreditForm(
  t: Translator,
  form: CreditFormValues
): { errors: CreditFormErrors; draft?: CreditCardDraft } {
  const principalDebt = debtAmount(form.principalDebt)
  const secondDebt =
    form.debtMode === "dual" ? debtAmount(form.secondDebt) : ZERO
  const limit = form.limit.trim() === "" ? undefined : parseAmount(form.limit)
  const errors: CreditFormErrors = {}
  if (!hasLastFour(form)) errors.lastFour = true
  if (!principalDebt)
    errors.principalDebt = t.in("addcard", "Check the balance.")
  if (!secondDebt) errors.secondDebt = t.in("addcard", "Check the balance.")
  if (form.limit.trim() !== "" && (!limit || limit.lte(0)))
    errors.limit = t.in("creditcard", "Check the credit limit.")
  if (Object.keys(errors).length > 0 || !principalDebt || !secondDebt)
    return { errors }
  return {
    errors,
    draft: {
      bank: form.bank,
      lastFour: form.lastFour,
      network: form.network,
      color: form.color,
      debtMode: form.debtMode,
      principalDebt,
      secondDebt,
      ...(limit ? { limit } : {}),
      ...(form.cutoff ? { cutoffDay: Number(form.cutoff) } : {}),
      ...(form.due ? { dueDay: Number(form.due) } : {}),
    },
  }
}
