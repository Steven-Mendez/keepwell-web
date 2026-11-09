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
  lastFour?: string
  principalDebt?: string
  secondDebt?: string
  limit?: string
  form?: string
}

/** A blank form; with a second currency the debt starts as dual. */
export function initialCreditForm(
  second: string | undefined
): CreditFormValues {
  return {
    bank: "",
    lastFour: "",
    network: "visa",
    color: "azul",
    debtMode: second ? "dual" : "principal",
    principalDebt: "",
    secondDebt: "",
    limit: "",
    cutoff: "",
    due: "",
  }
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
  if (form.lastFour.length !== 4)
    errors.lastFour = t.in(
      "onboarding",
      "Enter all 4 digits or leave it empty."
    )
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
