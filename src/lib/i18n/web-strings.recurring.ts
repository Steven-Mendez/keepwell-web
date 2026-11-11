import type { WebStrings } from "./web-strings"

/**
 * Recurring movements and subscriptions. iOS adds the same feature to its catalogs; until they are
 * copied into strings.json, the web keeps them here, keyed by the English text.
 */
export const WEB_STRINGS_RECURRING: WebStrings = {
  Recurring: { es: "Recurrentes" },
  "Add recurring": { es: "Agregar recurrente" },
  "Subscriptions per month": { es: "Suscripciones al mes" },
  "Bills and other expenses": { es: "Facturas y otros gastos" },
  "Every %lld weeks": {
    en: { one: "Every week", other: "Every %lld weeks" },
    es: { one: "Cada semana", other: "Cada %lld semanas" },
  },
  "Every %lld months": {
    en: { one: "Every month", other: "Every %lld months" },
    es: { one: "Cada mes", other: "Cada %lld meses" },
  },
  "Every %lld years": {
    en: { one: "Every year", other: "Every %lld years" },
    es: { one: "Cada año", other: "Cada %lld años" },
  },
  "unit.week": { en: { one: "week", other: "weeks" }, es: { one: "semana", other: "semanas" } },
  "unit.month": { en: { one: "month", other: "months" }, es: { one: "mes", other: "meses" } },
  "unit.year": { en: { one: "year", other: "years" }, es: { one: "año", other: "años" } },
  Every: { es: "Cada" },
  Today: { es: "Hoy" },
  Tomorrow: { es: "Mañana" },
  Paused: { es: "En pausa" },
  Ended: { es: "Terminado" },
  "No recurring movements yet": { es: "Aún no hay recurrentes" },
  "Add rent, your salary or a subscription once. On each date it appears as a draft for you to confirm.": {
    es: "Agrega una vez el alquiler, tu salario o una suscripción. En cada fecha aparece como borrador para que lo confirmes.",
  },
  Name: { es: "Nombre" },
  Repeats: { es: "Se repite" },
  Starts: { es: "Empieza" },
  Ends: { es: "Termina" },
  "Ends on a date": { es: "Termina en una fecha" },
  Subscription: { es: "Suscripción" },
  "Shows it under Subscriptions and in the monthly total.": {
    es: "Aparece en Suscripciones y en el total mensual.",
  },
  "Record automatically": { es: "Registrar automáticamente" },
  "Off: it waits as a draft for you to confirm": {
    es: "Apagado: espera como borrador hasta que lo confirmes",
  },
  "Next dates": { es: "Próximas fechas" },
  "Movements it created": { es: "Movimientos que generó" },
  "None yet.": { es: "Ninguno todavía." },
  "Delete this recurring movement?": { es: "¿Eliminar este movimiento recurrente?" },
  "Its pending drafts are deleted too. Movements already confirmed stay.": {
    es: "También se eliminan sus borradores pendientes. Los movimientos ya confirmados se quedan.",
  },
  "Give it a name.": { es: "Ponle un nombre." },
  "Repeat every 1 to 99.": { es: "Repite cada 1 a 99." },
  "The end can't be before the start.": { es: "El final no puede ser antes del inicio." },
  "We couldn't save the change. Try again.": { es: "No pudimos guardar el cambio. Intenta de nuevo." },
  "The next ones wait as drafts on their date for you to confirm.": {
    es: "Los siguientes esperan como borradores en su fecha para que los confirmes.",
  },
}
