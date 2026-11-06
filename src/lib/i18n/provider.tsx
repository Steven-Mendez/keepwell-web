"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { makeTranslator, type Locale, type Translator } from "./translate"

const STORAGE_KEY = "keepwell.locale"

/** Like iOS, the device language decides; Settings › Language can pick another just here. */
function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "en" || stored === "es") return stored
  } catch {}
  if (
    typeof navigator !== "undefined" &&
    navigator.language.toLowerCase().startsWith("es")
  )
    return "es"
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

  const value = useMemo(
    () => ({ t: makeTranslator(locale), locale, setLocale, isOverridden }),
    [locale, setLocale, isOverridden]
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}

export function useT(): Translator {
  return useContext(I18nContext).t
}
