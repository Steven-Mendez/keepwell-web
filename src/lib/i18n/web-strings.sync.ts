import type { WebStrings } from "./web-strings"

/** Web-only text for the settings sections and the first-sync choice (see web-strings.ts). */
export const WEB_STRINGS_SYNC: WebStrings = {
  // Settings sections (the same names and order as iOS Settings).
  "Profile & preferences": { es: "Perfil y preferencias" },
  Money: { es: "Dinero" },
  "Data & sync": { es: "Datos y sincronización" },
  Security: { es: "Seguridad" },
  About: { es: "Acerca de" },
  Version: { es: "Versión" },
  "Your browser's, unless you choose another one here.": { es: "El de tu navegador, salvo que elijas otro aquí." },
  "Sign in to sync": { es: "Inicia sesión para sincronizar" },
  "Sync this browser with Keepwell for iPhone. Without an account, your data stays only here.": {
    es: "Sincroniza este navegador con Keepwell para iPhone. Sin una cuenta, tus datos se quedan solo aquí.",
  },
  Synced: { es: "Sincronizado" },
  "Sync off": { es: "Sin sincronización" },
  "Sync paused": { es: "Sincronización en pausa" },
  Offline: { es: "Sin conexión" },
  "Couldn't sync": { es: "No se pudo sincronizar" },
  "Every movement, in a file for a spreadsheet.": { es: "Todos tus movimientos, en un archivo para una hoja de cálculo." },
  "Adds movements from a CSV file.": { es: "Agrega movimientos desde un archivo CSV." },
  "Ends every session of your account, here and on your other devices.": {
    es: "Cierra todas las sesiones de tu cuenta, aquí y en tus otros dispositivos.",
  },
  "Signing out or deleting the account keeps what's in this browser.": {
    es: "Al cerrar sesión o eliminar la cuenta, lo que hay en este navegador se queda.",
  },

  // The first sync with data on both sides.
  "This browser and your account have different data": { es: "Este navegador y tu cuenta tienen datos distintos" },
  "Choose which to keep. The other is replaced, and this can't be undone.": {
    es: "Elige cuáles conservar. Los otros se reemplazan y no se puede deshacer.",
  },
  "Use your account's data": { es: "Usar los datos de tu cuenta" },
  "Replaces what's in this browser with the data in your Keepwell account.": {
    es: "Reemplaza lo que hay en este navegador con los datos de tu cuenta de Keepwell.",
  },
  "Keep this browser's data": { es: "Conservar los datos de este navegador" },
  "Replaces your account's data, on every device, with what's here.": {
    es: "Reemplaza los datos de tu cuenta, en todos tus dispositivos, con lo que hay aquí.",
  },
  "Replace your account's data?": { es: "¿Reemplazar los datos de tu cuenta?" },
  Replace: { es: "Reemplazar" },
  "Everything in your Keepwell account is deleted on every device and replaced with what's in this browser. This can't be undone.": {
    es: "Todo lo de tu cuenta de Keepwell se borra en todos tus dispositivos y se reemplaza con lo que hay en este navegador. No se puede deshacer.",
  },
  "Decide later": { es: "Decidir después" },
  "Choose which data to keep": { es: "Elige qué datos conservar" },
  "Sync is paused until you choose.": { es: "La sincronización está en pausa hasta que elijas." },
  "sync.count.movements": {
    en: { one: "%lld movement", other: "%lld movements" },
    es: { one: "%lld movimiento", other: "%lld movimientos" },
  },
  "sync.count.recurring": {
    en: { one: "%lld recurring", other: "%lld recurring" },
    es: { one: "%lld recurrente", other: "%lld recurrentes" },
  },
  "sync.count.goals": {
    en: { one: "%lld goal", other: "%lld goals" },
    es: { one: "%lld meta", other: "%lld metas" },
  },
  "sync.count.debts": {
    en: { one: "%lld debt", other: "%lld debts" },
    es: { one: "%lld deuda", other: "%lld deudas" },
  },
  "sync.count.rules": {
    en: { one: "%lld rule", other: "%lld rules" },
    es: { one: "%lld regla", other: "%lld reglas" },
  },
}
