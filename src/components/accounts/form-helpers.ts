import { DomainError } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import type { CardNetwork } from "@/lib/schema"

// Values and texts the account forms share, apart from the components in form-parts.tsx.

export const NETWORKS: readonly CardNetwork[] = [
  "visa",
  "mastercard",
  "amex",
  "other",
]

/** Keeps only digits, at most four. */
export const digitsOnly = (text: string) => text.replace(/\D/g, "").slice(0, 4)

/** iOS texts for the domain failures a form can hit. */
export function domainErrorText(
  t: Translator,
  error: unknown,
  fallback: string
): string {
  if (error instanceof DomainError) {
    switch (error.code) {
      case "invalidLastFour":
        return t.in("onboarding", "Enter all 4 digits or leave it empty.")
      case "missingName":
        return t.in("accounts", "Write a name for the account.")
      case "invalidAmount":
        return t.in("addcard", "Check the balance.")
      case "invalidExpiry":
        return t.in("sharedpresentation", "Choose both the month and the year.")
      default:
        return fallback
    }
  }
  return fallback
}
