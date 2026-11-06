/**
 * Text only the desktop web has (keyboard shortcuts, the command palette, browser storage, file
 * pickers), which no iOS catalog can hold. Same shape as the generated catalog; everything else on
 * screen comes from the iOS catalogs, so the two apps read the same.
 */
export type WebStrings = Record<string, { en?: string | Record<string, string>; es: string | Record<string, string> }>

export const WEB_STRINGS_CORE: WebStrings = {
  "Keyboard shortcuts": { es: "Atajos de teclado" },
  "Search or jump to…": { es: "Busca o ve a…" },
  "No results.": { es: "Sin resultados." },
  "Go to": { es: "Ir a" },
  Actions: { es: "Acciones" },
  "New expense": { es: "Nuevo gasto" },
  "New income": { es: "Nuevo ingreso" },
  "New transfer": { es: "Nueva transferencia" },
  "Command palette": { es: "Paleta de comandos" },
  "Show shortcuts": { es: "Ver atajos" },
  "Focus search": { es: "Buscar" },
  "Close panel": { es: "Cerrar panel" },
  Navigation: { es: "Navegación" },
  "then %@": { es: "luego %@" },
  "Install app": { es: "Instalar app" },
  "Works offline": { es: "Funciona sin conexión" },
  "On this device": { es: "En este dispositivo" },
  "Stored in this browser": { es: "Guardado en este navegador" },
  "Kept by the browser": { es: "El navegador lo conserva" },
  "May be cleared": { es: "Podría borrarse" },
  "Your data lives in this browser. Back it up now and then to keep a copy.": {
    es: "Tus datos viven en este navegador. Respáldalos de vez en cuando para tener una copia.",
  },
  "Follow the browser": { es: "Seguir al navegador" },
  "Keepwell uses your browser's language. To use another one only here, choose it below.": {
    es: "Keepwell usa el idioma de tu navegador. Para usar otro solo aquí, elígelo abajo.",
  },
  "Deletes the data in this browser.": { es: "Borra los datos de este navegador." },
  "Your accounts, cards and transactions are deleted from this browser. This can't be undone.": {
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
}

import { WEB_STRINGS_ACCOUNTS } from "./web-strings.accounts"
import { WEB_STRINGS_EDITOR } from "./web-strings.editor"
import { WEB_STRINGS_SETTINGS } from "./web-strings.settings"

export const WEB_STRINGS: WebStrings = { ...WEB_STRINGS_CORE, ...WEB_STRINGS_EDITOR, ...WEB_STRINGS_ACCOUNTS, ...WEB_STRINGS_SETTINGS }
