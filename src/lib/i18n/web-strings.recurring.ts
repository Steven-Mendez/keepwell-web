import type { WebStrings } from "./web-strings"

/**
 * Recurring text that iOS keeps in other places (navigation title, the "Repeat" choice of a new
 * movement, the home reminders). Everything on the Recurring screen and rule editor comes from the
 * iOS `recurring` catalog.
 */
export const WEB_STRINGS_RECURRING: WebStrings = {
  Recurring: { es: "Recurrentes" },
  Repeat: { es: "Repetir" },
  "The next ones wait as drafts on their date for you to confirm.": {
    es: "Los siguientes esperan como borradores en su fecha para que los confirmes.",
  },
  Upcoming: { es: "Próximos" },
  "%@ renews tomorrow": { es: "%@ se renueva mañana" },
  "%@ on %@": { es: "%1$@ con %2$@" },
}
