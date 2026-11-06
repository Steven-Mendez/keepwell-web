import {
  Decimal,
  ZERO,
  formatAmountInput,
  parseAmount,
  type OnboardingAccountDraft,
} from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import type { CardNetwork, DebtMode } from "@/lib/schema"

/** What the account sheet holds while the person types: text fields stay text until saved. */
export interface AccountFormValues {
  bank: string
  name: string
  currency: string
  balanceText: string
  secondText: string
  lastFour: string
  network: CardNetwork
  debtMode: DebtMode
}

/** The parsed amounts and which fields would block saving. */
export interface AccountFormCheck {
  balance: Decimal | undefined
  secondBalance: Decimal | undefined
  lastFourInvalid: boolean
  balanceInvalid: boolean
  secondInvalid: boolean
}

/** A saved amount back as input text; zero shows as empty so the placeholder reads instead. */
export function amountText(value: Decimal): string {
  return value.isZero()
    ? ""
    : (formatAmountInput(value.toFixed()) ?? value.toFixed())
}

/** Empty amounts count as zero, like iOS; anything else must parse. */
function parseOptionalAmount(text: string): Decimal | undefined {
  return text.trim() === "" ? ZERO : parseAmount(text)
}

export function checkAccountForm(
  kind: OnboardingAccountDraft["kind"],
  values: AccountFormValues
): AccountFormCheck {
  const balance = parseOptionalAmount(values.balanceText)
  const secondBalance = parseOptionalAmount(values.secondText)
  return {
    balance,
    secondBalance,
    lastFourInvalid:
      values.lastFour !== "" && !/^[0-9]{4}$/.test(values.lastFour),
    balanceInvalid: balance === undefined,
    secondInvalid:
      kind === "credit" &&
      values.debtMode === "dual" &&
      secondBalance === undefined,
  }
}

/** The currency a credit card's debt is entered in: the second only when it charges only in that one. */
export function debtCurrencyFor(
  debtMode: DebtMode,
  principal: string,
  second: string | undefined
): string {
  return debtMode === "second" && second ? second : principal
}

/** The name an account gets when the person leaves it empty (the network for cards, as iOS does). */
function defaultAccountName(
  t: Translator,
  kind: OnboardingAccountDraft["kind"],
  network: CardNetwork
): string {
  if (kind !== "credit")
    return t.in("onboarding", kind === "cash" ? "Cash" : "Savings")
  return (
    {
      visa: "Visa",
      mastercard: "Mastercard",
      amex: "Amex",
      other: t.in("onboarding", "Credit card"),
    } as const
  )[network]
}

/** The draft the sheet saves; only the fields that apply to the kind are set. */
export function savedAccountDraft({
  t,
  draft,
  values,
  balance,
  secondBalance,
  principal,
  second,
}: {
  t: Translator
  draft: OnboardingAccountDraft
  values: AccountFormValues
  balance: Decimal
  secondBalance: Decimal | undefined
  principal: string
  second: string | undefined
}): OnboardingAccountDraft {
  const { bank, name, currency, lastFour, network, debtMode } = values
  const trimmedBank = bank.trim()
  const isCredit = draft.kind === "credit"
  return {
    id: draft.id,
    kind: draft.kind,
    name: name.trim() || defaultAccountName(t, draft.kind, network),
    ...(trimmedBank ? { bank: trimmedBank } : {}),
    currency: isCredit
      ? debtCurrencyFor(debtMode, principal, second)
      : currency,
    balance,
    secondBalance: secondBalance ?? ZERO,
    ...(lastFour ? { lastFour } : {}),
    ...(draft.kind === "cash" ? {} : { network }),
    ...(isCredit ? { debtMode: second ? debtMode : "principal" } : {}),
  }
}
