"use client"

import { ArrowLeftRightIcon, CoinsIcon, PercentIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import { KWButton } from "@/components/kw/design"
import { Input } from "@/components/ui/input"
import { CurrencyPicker } from "@/components/kw/pickers"
import { toast } from "@/components/ui/toast"
import {
  currencySettings,
  type Ledger,
} from "@/lib/domain"
import {
  formatNumber,
  parseAmount,
} from "@/lib/domain/format"
import {
  setRate,
  swapCurrencies,
  updateSettings,
} from "@/lib/domain/onboarding"
import type { Translator } from "@/lib/i18n"
import { ledgerStore } from "@/lib/repositories"
import type { Settings } from "@/lib/schema"

import { ConfirmDialog } from "./confirm-dialog"
import {
  SETTINGS_INPUT,
  SettingsLinkRow,
  SettingsRow,
  SettingsSection,
} from "./settings-rows"

/** "USD · US dollar", in the person's language (iOS `currencyName`). */
function currencyName(t: Translator, code: string): string {
  try {
    const name = new Intl.DisplayNames([t.locale], { type: "currency" }).of(
      code
    )
    return name && name !== code
      ? `${code} · ${name.charAt(0).toUpperCase()}${name.slice(1)}`
      : code
  } catch {
    return code
  }
}

/** Whether anything already recorded is kept in `code`, so changing that currency would break it. */
function isInUse(ledger: Ledger, code: string): boolean {
  return (
    ledger.accounts.some((account) =>
      account.openingBalances.some((balance) => balance.currency === code)
    ) ||
    ledger.transactions.some((transaction) => transaction.currency === code)
  )
}

type Currencies = Settings["currencies"]
type SaveSettings = (
  change: (settings: Settings) => Settings
) => Promise<boolean>

/** Saves a settings change, telling the person when it didn't stick. */
function settingsSaver(t: Translator): SaveSettings {
  return async (change) => {
    try {
      await updateSettings(ledgerStore, change)
      return true
    } catch {
      toast.add({
        title: t.in("settings", "We couldn't save the change. Try again."),
        type: "error",
      })
      return false
    }
  }
}

/**
 * The rate field's in-progress text: shown instead of the saved rate while typing, saved on
 * commit and dropped (back to the saved rate) on Escape or whenever the currencies change.
 */
function useRateDraft(
  t: Translator,
  currencies: Currencies,
  save: SaveSettings
) {
  const [rateText, setRateText] = useState<string>()
  const [rateError, setRateError] = useState<string>()
  const shownRate =
    rateText ??
    formatNumber(
      currencies.rate,
      Math.max(2, currencies.rate.split(".")[1]?.length ?? 0)
    ).replaceAll(",", "")

  async function commit() {
    if (rateText === undefined) return
    const value = parseAmount(rateText)
    if (!value || value.lte(0)) {
      setRateError(
        t.in("settings", "The rate has to be a number greater than zero.")
      )
      return
    }
    setRateError(undefined)
    if (await save(setRate(value))) setRateText(undefined)
  }

  function edit(text: string) {
    setRateText(text)
    setRateError(undefined)
  }

  function cancel() {
    setRateText(undefined)
    setRateError(undefined)
  }

  return {
    shownRate,
    rateError,
    edit,
    commit,
    cancel,
    reset: () => setRateText(undefined),
  }
}

type RateDraft = ReturnType<typeof useRateDraft>

function MainCurrencyRow({
  t,
  currencies,
  canChange,
  save,
}: {
  t: Translator
  currencies: Currencies
  canChange: boolean
  save: SaveSettings
}) {
  return (
    <SettingsRow
      icon="cash"
      label={t.in("settings", "Main currency")}
      htmlFor="main-currency"
      wide={canChange}
      {...(canChange
        ? {}
        : {
            description: t.in(
              "web",
              "Used by your accounts, so it can't change here."
            ),
          })}
    >
      {canChange ? (
        <CurrencyPicker
          id="main-currency"
          className="w-full sm:w-64"
          value={currencies.principal}
          exclude={currencies.second}
          onChange={(code) =>
            void save((settings) => ({
              ...settings,
              currencies: currencySettings(
                code,
                settings.currencies.second,
                settings.currencies.rate
              ),
            }))
          }
        />
      ) : (
        <span className="type-label">
          {currencyName(t, currencies.principal)}
        </span>
      )}
    </SettingsRow>
  )
}

function SecondCurrencyPicker({
  t,
  currencies,
  save,
  onChanged,
}: {
  t: Translator
  currencies: Currencies
  save: SaveSettings
  onChanged: () => void
}) {
  return (
    <div className="flex w-full items-center gap-1">
      <CurrencyPicker
        id="second-currency"
        className="w-full sm:w-64"
        value={currencies.second}
        exclude={currencies.principal}
        onChange={(code) => {
          void save((settings) => ({
            ...settings,
            currencies: currencySettings(
              settings.currencies.principal,
              code,
              code === settings.currencies.second ? settings.currencies.rate : 1
            ),
          }))
          onChanged()
        }}
      />
      {currencies.second ? (
        <KWButton
          variant="plain"
          size="regular"
          onClick={() => {
            void save((settings) => ({
              ...settings,
              currencies: currencySettings(settings.currencies.principal),
            }))
            onChanged()
          }}
        >
          {t.in("web", "None")}
        </KWButton>
      ) : null}
    </div>
  )
}

function SecondCurrencyRow({
  t,
  currencies,
  canChange,
  save,
  onChanged,
}: {
  t: Translator
  currencies: Currencies
  canChange: boolean
  save: SaveSettings
  onChanged: () => void
}) {
  return (
    <SettingsRow
      icon={<CoinsIcon strokeWidth={2} />}
      label={t.in("settings", "Second currency")}
      htmlFor="second-currency"
      wide={canChange}
      {...(canChange
        ? {}
        : {
            description: t.in(
              "web",
              "Used by your accounts, so it can't change here."
            ),
          })}
    >
      {canChange ? (
        <SecondCurrencyPicker
          t={t}
          currencies={currencies}
          save={save}
          onChanged={onChanged}
        />
      ) : (
        <span className="type-label">
          {currencies.second
            ? currencyName(t, currencies.second)
            : t.in("web", "None")}
        </span>
      )}
    </SettingsRow>
  )
}

/** The rate and the swap, which only exist once there is a second currency. */
function RateAndSwapRows({
  t,
  principal,
  second,
  rate,
  save,
}: {
  t: Translator
  principal: string
  second: string
  rate: RateDraft
  save: SaveSettings
}) {
  const [swapOpen, setSwapOpen] = useState(false)
  return (
    <>
      <SettingsRow
        icon={<PercentIcon strokeWidth={2} />}
        label={t.in("settings", "Rate")}
        description={rate.rateError ?? t.in("settings", "Manual · default 1")}
        htmlFor="rate"
        wide
      >
        <span className="type-label text-muted-foreground">
          1 {principal} =
        </span>
        <Input
          id="rate"
          inputMode="decimal"
          className={`w-28 text-right tabular-nums ${SETTINGS_INPUT}`}
          value={rate.shownRate}
          aria-invalid={rate.rateError ? true : undefined}
          onChange={(event) => rate.edit(event.target.value)}
          onBlur={() => void rate.commit()}
          onKeyDown={(event) => {
            if (event.key === "Enter") void rate.commit()
            if (event.key === "Escape") rate.cancel()
          }}
        />
        <span className="type-label">{second}</span>
      </SettingsRow>
      <SettingsLinkRow
        icon={<ArrowLeftRightIcon strokeWidth={2} />}
        label={t.in("settings", "Make %@ the main currency", second)}
        tone="link"
        onClick={() => setSwapOpen(true)}
      />
      <ConfirmDialog
        open={swapOpen}
        onOpenChange={setSwapOpen}
        title={t.in("settings", "Make %@ the main currency?", second)}
        description={t.in(
          "settings",
          "Net worth, summaries and new movements will be in %@, and the rate is turned around. Past movements keep the rate they were logged with.",
          second
        )}
        action={t.in("settings", "Swap currencies")}
        onConfirm={() => {
          rate.reset()
          void save(swapCurrencies)
        }}
      />
    </>
  )
}

/**
 * Main and second currency, the manual rate and the swap (iOS SettingsView `currency`). The rate
 * only affects movements from now on. Changing a currency is offered only while nothing uses it,
 * since balances and movements are kept in their currency.
 */
export function CurrencySection({
  t,
  ledger,
  children,
}: {
  t: Translator
  ledger: Ledger
  /** More money rows after the currencies (the payment reminder). */
  children?: ReactNode
}) {
  const currencies = ledger.settings.currencies
  const save = settingsSaver(t)
  const rate = useRateDraft(t, currencies, save)
  const canChangeMain =
    ledger.accounts.length === 0 && ledger.transactions.length === 0
  const canChangeSecond =
    currencies.second === undefined || !isInUse(ledger, currencies.second)

  return (
    <SettingsSection
      id="money"
      title={t.in("web", "Money")}
      footnote={
        currencies.second
          ? t.in(
              "settings",
              "Update it whenever you like by replacing the value. Each transaction keeps the rate it was logged with, so your history doesn't change."
            )
          : undefined
      }
    >
      <MainCurrencyRow
        t={t}
        currencies={currencies}
        canChange={canChangeMain}
        save={save}
      />
      <SecondCurrencyRow
        t={t}
        currencies={currencies}
        canChange={canChangeSecond}
        save={save}
        onChanged={rate.reset}
      />
      {currencies.second ? (
        <RateAndSwapRows
          t={t}
          principal={currencies.principal}
          second={currencies.second}
          rate={rate}
          save={save}
        />
      ) : null}
      {children}
    </SettingsSection>
  )
}
