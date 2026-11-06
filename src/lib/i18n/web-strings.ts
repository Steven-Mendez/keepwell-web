/**
 * Text only the desktop web has (keyboard shortcuts, the command palette, browser storage, file
 * pickers), which no iOS catalog can hold. Same shape as the generated catalog; everything else on
 * screen comes from the iOS catalogs, so the two apps read the same.
 */
export type WebStrings = Record<
  string,
  { en?: string | Record<string, string>; es: string | Record<string, string> }
>

export const WEB_STRINGS_CORE: WebStrings = {
  "Keyboard shortcuts": { es: "Atajos de teclado" },
  "Hide balances": { es: "Ocultar saldos" },
  "Show balances": { es: "Mostrar saldos" },
  "Search or jump to…": { es: "Busca o ve a…" },
  "No results.": { es: "Sin resultados." },
  "Go to": { es: "Ir a" },
  Actions: { es: "Acciones" },
  "New expense": { es: "Nuevo gasto" },
  "New income": { es: "Nuevo ingreso" },
  "New transfer": { es: "Nueva transferencia" },
  "Command palette": { es: "Paleta de comandos" },
  "Show shortcuts": { es: "Ver atajos" },
  "Toggle sidebar": { es: "Mostrar u ocultar la barra lateral" },
  "Focus search": { es: "Buscar" },
  "Close panel": { es: "Cerrar panel" },
  "Next or previous movement": { es: "Movimiento siguiente o anterior" },
  "Money in": { es: "Entradas" },
  "Money out": { es: "Salidas" },
  Net: { es: "Neto" },
  Movements: { es: "Movimientos" },
  "column.description": { en: "Description", es: "Descripción" },
  "column.category": { en: "Category", es: "Categoría" },
  "column.account": { en: "Account", es: "Cuenta" },
  "column.amount": { en: "Amount", es: "Monto" },
  Navigation: { es: "Navegación" },
  "then %@": { es: "luego %@" },
  "Install app": { es: "Instalar app" },
  "Works offline": { es: "Funciona sin conexión" },
  "On this device": { es: "En este dispositivo" },
  "Stored in this browser": { es: "Guardado en este navegador" },
  "welcome.preview.rent": { en: "Rent", es: "Alquiler" },
  "Kept by the browser": { es: "El navegador lo conserva" },
  "May be cleared": { es: "Podría borrarse" },
  "Your data lives in this browser. Back it up now and then to keep a copy.": {
    es: "Tus datos viven en este navegador. Respáldalos de vez en cuando para tener una copia.",
  },
  "Follow the browser": { es: "Seguir al navegador" },
  "Keepwell uses your browser's language. To use another one only here, choose it below.":
    {
      es: "Keepwell usa el idioma de tu navegador. Para usar otro solo aquí, elígelo abajo.",
    },
  "Deletes the data in this browser.": {
    es: "Borra los datos de este navegador.",
  },
  "Your accounts, cards and transactions are deleted from this browser. This can't be undone.":
    {
      es: "Tus cuentas, tarjetas y movimientos se borran de este navegador. No se puede deshacer.",
    },
  "Edit transaction": { es: "Editar movimiento" },
  "Save changes": { es: "Guardar cambios" },
  "Transaction details": { es: "Detalle del movimiento" },
  Edit: { es: "Editar" },
  Status: { es: "Estado" },
  Planned: { es: "Previsto" },
  "Rate stored": { es: "Tasa guardada" },
  Back: { es: "Atrás" },
  /** iOS takes these from the system; the web needs them spelled out. */
  Cancel: { es: "Cancelar" },
  /** iOS says "on this iPhone"; on the web the name stays in the browser. */
  "We'll use it to greet you and show it on your cards. It's only stored in this browser.":
    {
      es: "Lo usaremos para saludarte y mostrarlo en tus tarjetas. Solo se guarda en este navegador.",
    },
  OK: { es: "OK" },
}

import { WEB_STRINGS_ACCOUNTS } from "./web-strings.accounts"
import { WEB_STRINGS_DEBTS } from "./web-strings.debts"
import { WEB_STRINGS_EDITOR } from "./web-strings.editor"
import { WEB_STRINGS_RECURRING } from "./web-strings.recurring"
import { WEB_STRINGS_SETTINGS } from "./web-strings.settings"
import { WEB_STRINGS_SUMMARY } from "./web-strings.summary"

export const WEB_STRINGS: WebStrings = {
  ...WEB_STRINGS_CORE,
  ...WEB_STRINGS_EDITOR,
  ...WEB_STRINGS_ACCOUNTS,
  ...WEB_STRINGS_SETTINGS,
  ...WEB_STRINGS_SUMMARY,
  ...WEB_STRINGS_RECURRING,
  ...WEB_STRINGS_DEBTS,
}
