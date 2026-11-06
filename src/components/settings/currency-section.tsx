"use client"

import { useState } from "react"

import { KWButton } from "@/components/kw/design"
import { Input } from "@/components/ui/input"
import { CurrencyPicker } from "@/components/kw/pickers"
import { toast } from "@/components/ui/toast"
import { currencySettings, formatNumber, parseAmount, setRate, swapCurrencies, updateSettings, type Ledger } from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { ledgerStore } from "@/lib/repositories"
import type { Settings } from "@/lib/schema"

import { ConfirmDialog } from "./confirm-dialog"
import { SETTINGS_INPUT, SettingsLinkRow, SettingsRow, SettingsSection } from "./settings-rows"

/** "USD · US dollar", in the person's language (iOS `currencyName`). */
function currencyName(t: Translator, code: string): string {
  try {
    const name = new Intl.DisplayNames([t.locale], { type: "currency" }).of(code)
    return name && name !== code ? `${code} · ${name.charAt(0).toUpperCase()}${name.slice(1)}` : code
  } catch {
    return code
  }
}

/** Whether anything already recorded is kept in `code`, so changing that currency would break it. */
function isInUse(ledger: Ledger, code: string): boolean {
  return ledger.accounts.some((account) => account.openingBalances.some((balance) => balance.currency === code)) || ledger.transactions.some((transaction) => transaction.currency === code)
}

/**
 * Main and second currency, the manual rate and the swap (iOS SettingsView `currency`). The rate
 * only affects movements from now on. Changing a currency is offered only while nothing uses it,
 * since balances and movements are kept in their currency.
 */
export function CurrencySection({ t, ledger }: { t: Translator; ledger: Ledger }) {
  const currencies = ledger.settings.currencies
  const [rateText, setRateText] = useState<string>()
  const [rateError, setRateError] = useState<string>()
  const [swapOpen, setSwapOpen] = useState(false)
  const shownRate = rateText ?? formatNumber(currencies.rate, Math.max(2, currencies.rate.split(".")[1]?.length ?? 0)).replaceAll(",", "")
  const canChangeMain = ledger.accounts.length === 0 && ledger.transactions.length === 0
  const canChangeSecond = currencies.second === undefined || !isInUse(ledger, currencies.second)

  async function save(change: (settings: Settings) => Settings) {
    try {
      await updateSettings(ledgerStore, change)
      return true
    } catch {
      toast.add({ title: t.in("settings", "We couldn't save the change. Try again."), type: "error" })
      return false
    }
  }

  async function commitRate() {
    if (rateText === undefined) return
    const value = parseAmount(rateText)
    if (!value || value.lte(0)) {
      setRateError(t.in("settings", "The rate has to be a number greater than zero."))
      return
    }
    setRateError(undefined)
    if (await save(setRate(value))) setRateText(undefined)
  }

  return (
    <SettingsSection title={t.in("settings", "Currency")} footnote={currencies.second ? t.in("settings", "Update it whenever you like by replacing the value. Each transaction keeps the rate it was logged with, so your history doesn't change.") : undefined}>
      <SettingsRow label={t.in("settings", "Main currency")} htmlFor="main-currency" {...(canChangeMain ? {} : { description: t.in("web", "Used by your accounts, so it can't change here.") })}>
        {canChangeMain ? (
          <CurrencyPicker
            id="main-currency"
            className="w-64"
            value={currencies.principal}
            exclude={currencies.second}
            onChange={(code) => void save((settings) => ({ ...settings, currencies: currencySettings(code, settings.currencies.second, settings.currencies.rate) }))}
          />
        ) : (
          <span className="type-label">{currencyName(t, currencies.principal)}</span>
        )}
      </SettingsRow>
      <SettingsRow label={t.in("settings", "Second currency")} htmlFor="second-currency" {...(canChangeSecond ? {} : { description: t.in("web", "Used by your accounts, so it can't change here.") })}>
        {canChangeSecond ? (
          <div className="flex items-center gap-1">
            <CurrencyPicker
              id="second-currency"
              className="w-64"
              value={currencies.second}
              exclude={currencies.principal}
              onChange={(code) => {
                void save((settings) => ({ ...settings, currencies: currencySettings(settings.currencies.principal, code, code === settings.currencies.second ? settings.currencies.rate : 1) }))
                setRateText(undefined)
              }}
            />
            {currencies.second ? (
              <KWButton
                variant="plain"
                size="regular"
                onClick={() => {
                  void save((settings) => ({ ...settings, currencies: currencySettings(settings.currencies.principal) }))
                  setRateText(undefined)
                }}
              >
                {t.in("web", "None")}
              </KWButton>
            ) : null}
          </div>
        ) : (
          <span className="type-label">{currencies.second ? currencyName(t, currencies.second) : t.in("web", "None")}</span>
        )}
      </SettingsRow>
      {currencies.second ? (
        <>
          <SettingsRow label={t.in("settings", "Rate")} description={rateError ?? t.in("settings", "Manual · default 1")} htmlFor="rate">
            <span className="type-label text-muted-foreground">1 {currencies.principal} =</span>
            <Input
              id="rate"
              inputMode="decimal"
              className={`w-28 text-right tabular-nums ${SETTINGS_INPUT}`}
              value={shownRate}
              aria-invalid={rateError ? true : undefined}
              onChange={(event) => {
                setRateText(event.target.value)
                setRateError(undefined)
              }}
              onBlur={() => void commitRate()}
              onKeyDown={(event) => {
                if (event.key === "Enter") void commitRate()
                if (event.key === "Escape") {
                  setRateText(undefined)
                  setRateError(undefined)
                }
              }}
            />
            <span className="type-label">{currencies.second}</span>
          </SettingsRow>
          <SettingsLinkRow label={t.in("settings", "Make %@ the main currency", currencies.second)} tone="link" onClick={() => setSwapOpen(true)} />
          <ConfirmDialog
            open={swapOpen}
            onOpenChange={setSwapOpen}
            title={t.in("settings", "Make %@ the main currency?", currencies.second)}
            description={t.in("settings", "Net worth, summaries and new movements will be in %@, and the rate is turned around. Past movements keep the rate they were logged with.", currencies.second)}
            action={t.in("settings", "Swap currencies")}
            onConfirm={() => {
              setRateText(undefined)
              void save(swapCurrencies)
            }}
          />
        </>
      ) : null}
    </SettingsSection>
  )
}
