"use client"

import { GlobeIcon } from "lucide-react"
import { useMemo } from "react"

import { OptionSelect } from "@/components/kw/pickers"
import { toast } from "@/components/ui/toast"
import type { Ledger } from "@/lib/domain"
import { updateSettings } from "@/lib/domain/onboarding"
import type { Translator } from "@/lib/i18n"
import { deviceTimeZone } from "@/lib/platform/time-zone"
import { ledgerStore } from "@/lib/repositories"

import { SettingsRow } from "./settings-rows"

/** Every zone the browser knows, with the ones in use first so they're never missing from the list. */
function zoneOptions(current: string, device: string): string[] {
  const known = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : []
  return [...new Set([current, device, ...known])].sort((a, b) => a.localeCompare(b))
}

/**
 * The home zone (`Settings.timeZone`): what the server reads "today" and month ends in, for the
 * assistant and reminders. Set from a device when missing; changed only here. The screens keep the
 * browser's zone.
 */
export function TimeZoneRow({ t, ledger }: { t: Translator; ledger: Ledger }) {
  const device = deviceTimeZone()
  const current = ledger.settings.timeZone ?? device
  const options = useMemo(() => zoneOptions(current, device).map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") })), [current, device])
  return (
    <SettingsRow
      icon={<GlobeIcon strokeWidth={2} />}
      label={t.in("settings", "Time zone")}
      description={t.in("settings", "Reminders and your assistant use it for today and for month ends.")}
      htmlFor="time-zone"
      wide
    >
      <OptionSelect
        id="time-zone"
        className="w-full sm:w-56"
        value={current}
        onChange={(zone) => {
          updateSettings(ledgerStore, (settings) => ({ ...settings, timeZone: zone })).catch(() =>
            toast.add({ title: t.in("settings", "We couldn't save the change. Try again."), type: "error" })
          )
        }}
        options={options}
      />
    </SettingsRow>
  )
}
