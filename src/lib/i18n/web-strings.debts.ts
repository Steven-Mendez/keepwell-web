import type { WebStrings } from "./web-strings"

/**
 * Debts texts only the web shows. iOS reminds an installment ahead of its day as a notification and
 * never lists it afterwards; the web keeps it on Home until it's paid, so it needs the late wording.
 */
export const WEB_STRINGS_DEBTS: WebStrings = {
  "%@: installment overdue": { es: "%@: cuota atrasada" },
}
