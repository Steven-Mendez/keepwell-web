"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import catalog from "./strings.generated.json"
import { WEB_STRINGS } from "./web-strings"

/**
 * The iOS string catalogs (`pnpm strings:sync`), keyed by the English source text exactly as iOS
 * writes it. English is the source language; Spanish is the first translation. `%@` and `%lld` take
 * arguments in order; a plural entry picks its form from the first number.
 */
export type Locale = "en" | "es"
export const LOCALES: readonly Locale[] = ["en", "es"]

type Unit = string | Record<string, string>
type Entry = { en?: Unit; es?: Unit }
type Catalog = Record<string, Record<string, Entry>>
export type Namespace = keyof typeof catalog | "web"

const strings: Catalog = { ...(catalog as Catalog), web: WEB_STRINGS }

/** Lookup order when no namespace is given: shared text first, like iOS SharedPresentation. */
const SEARCH_ORDER: readonly string[] = [
  "sharedpresentation",
  "createtransaction",
  "home",
  "transactions",
  "accounts",
  "creditcard",
  "addcard",
  "summary",
  "settings",
  "onboarding",
  "app",
  "designsystem",
  "lock",
  "widgets",
  "web",
]

export type Arg = string | number

function entryFor(key: string, ns?: string): Entry | undefined {
  if (ns) return strings[ns]?.[key]
  for (const name of SEARCH_ORDER) {
    const entry = strings[name]?.[key]
    if (entry) return entry
  }
  return undefined
}

const pluralRules: Record<Locale, Intl.PluralRules> = {
  en: new Intl.PluralRules("en"),
  es: new Intl.PluralRules("es"),
}

function fill(template: string, args: readonly Arg[]): string {
  let index = 0
  return template.replace(/%(%|@|lld|d)/g, (match, spec: string) => {
    if (spec === "%") return "%"
    const value = args[index++]
    return value === undefined ? match : String(value)
  })
}

export function translate(locale: Locale, key: string, args: readonly Arg[] = [], ns?: string): string {
  const entry = entryFor(key, ns)
  const unit = entry?.[locale] ?? entry?.en ?? key
  if (typeof unit === "string") return fill(unit, args)
  const count = args.find((arg): arg is number => typeof arg === "number") ?? 0
  const form = pluralRules[locale].select(count)
  return fill(unit[form] ?? unit.other ?? Object.values(unit)[0] ?? key, args)
}

/** Whether the catalog has `key` (for tests and for picking between iOS keys). */
export function hasString(key: string, ns?: string): boolean {
  return entryFor(key, ns) !== undefined
}

export interface Translator {
  (key: string, ...args: Arg[]): string
  /** The same key from one catalog, for the few keys iOS translates differently per screen. */
  in(ns: Namespace, key: string, ...args: Arg[]): string
  locale: Locale
}

export function makeTranslator(locale: Locale): Translator {
  const t = ((key: string, ...args: Arg[]) => translate(locale, key, args)) as Translator
  t.in = (ns, key, ...args) => translate(locale, key, args, ns)
  t.locale = locale
  return t
}

const STORAGE_KEY = "keepwell.locale"

/** Like iOS, the device language decides; Settings › Language can pick another just here. */
function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "en" || stored === "es") return stored
  } catch {}
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("es")) return "es"
  return "en"
}

interface I18nValue {
  t: Translator
  locale: Locale
  /** `undefined` follows the device language again. */
  setLocale: (locale: Locale | undefined) => void
  /** Whether the person picked a language here instead of following the device. */
  isOverridden: boolean
}

const I18nContext = createContext<I18nValue>({
  t: makeTranslator("en"),
  locale: "en",
  setLocale: () => {},
  isOverridden: false,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en")
  const [isOverridden, setOverridden] = useState(false)

  useEffect(() => {
    // Read after mount: the server renders English and the browser's language arrives here.
    const detected = detectLocale()
    let overridden = false
    try {
      overridden = localStorage.getItem(STORAGE_KEY) !== null
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the browser language is only known after hydration
    setLocaleState(detected)
    setOverridden(overridden)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale | undefined) => {
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {}
    setOverridden(next !== undefined)
    setLocaleState(next ?? detectLocale())
  }, [])

  const value = useMemo(() => ({ t: makeTranslator(locale), locale, setLocale, isOverridden }), [locale, setLocale, isOverridden])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}

export function useT(): Translator {
  return useContext(I18nContext).t
}
