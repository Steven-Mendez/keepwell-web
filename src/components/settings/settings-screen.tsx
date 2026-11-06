"use client"

import { KeyboardIcon } from "lucide-react"
import { useState } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { CardArt, DetailGroup, Page, PageHeader } from "@/components/kw/primitives"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { OptionSelect } from "@/components/kw/pickers"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { useLedger, usePreferredName } from "@/hooks/use-ledger"
import { PREFERRED_NAME_MAX_LENGTH, compareExpiry, normalizedPreferredName, paymentMethodGroups, updateSettings, type Ledger } from "@/lib/domain"
import { useI18n, type Translator } from "@/lib/i18n"
import { accountName, cardKindLabel, expiryText, methodTitle } from "@/lib/presentation/display"
import { ledgerStore, profileStore } from "@/lib/repositories"
import type { Card } from "@/lib/schema"

import { CurrencySection } from "./currency-section"
import { DataSection } from "./data-section"
import { SettingsLinkRow, SettingsRow, SettingsSection } from "./settings-rows"

/** iOS SettingsViewModel.reminderOptions. */
const REMINDER_OPTIONS = [1, 2, 3, 5, 7] as const

/** iOS Settings, laid out for a wide screen: preferences on the left, organization and data on the right. */
export function SettingsScreen() {
  const { t } = useI18n()
  const ledger = useLedger()

  return (
    <Page className="max-w-5xl">
      <PageHeader title={t.in("settings", "Settings")} />
      {!ledger ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-8">
            <ProfileSection t={t} />
            <LanguageSection />
            <CurrencySection t={t} ledger={ledger} />
            <CardsSection t={t} ledger={ledger} />
          </div>
          <div className="flex flex-col gap-8">
            <OrganizationSection t={t} ledger={ledger} />
            <DataSection t={t} />
            <ShortcutsSection t={t} />
          </div>
        </div>
      )}
    </Page>
  )
}

function ProfileSection({ t }: { t: Translator }) {
  const stored = usePreferredName()
  const [text, setText] = useState<string>()
  const commit = () => {
    if (text === undefined) return
    profileStore.setPreferredName(normalizedPreferredName(text))
    setText(undefined)
  }
  return (
    <SettingsSection title={t.in("onboarding", "Your name")}>
      <SettingsRow label={t.in("settings", "Your name")} htmlFor="preferred-name">
        <Input
          id="preferred-name"
          className="w-56"
          maxLength={PREFERRED_NAME_MAX_LENGTH}
          placeholder={t.in("settings", "For the greeting")}
          value={text ?? stored ?? ""}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit()
          }}
        />
      </SettingsRow>
    </SettingsSection>
  )
}

function LanguageSection() {
  const { t, locale, setLocale, isOverridden } = useI18n()
  return (
    <SettingsSection title={t.in("settings", "Language")} footnote={t.in("web", "Keepwell uses your browser's language. To use another one only here, choose it below.")}>
      <SettingsRow label={t.in("settings", "App language")} htmlFor="language">
        <OptionSelect
          id="language"
          className="w-56"
          value={isOverridden ? locale : "auto"}
          onChange={(value) => setLocale(value === "en" || value === "es" ? value : undefined)}
          options={[
            { value: "auto", label: t.in("web", "Follow the browser") },
            { value: "en", label: "English" },
            { value: "es", label: "Español" },
          ]}
        />
      </SettingsRow>
    </SettingsSection>
  )
}

function CardsSection({ t, ledger }: { t: Translator; ledger: Ledger }) {
  return (
    <SettingsSection title={t.in("settings", "Credit cards")}>
      <SettingsRow label={t.in("settings", "Remind me to pay")} htmlFor="reminder">
        <OptionSelect
          id="reminder"
          className="w-40"
          value={String(ledger.settings.paymentReminderDaysBefore)}
          onChange={(value) => {
            const days = Number(value)
            updateSettings(ledgerStore, (settings) => ({ ...settings, paymentReminderDaysBefore: days })).catch(() =>
              toast.add({ title: t.in("settings", "We couldn't save the change. Try again."), type: "error" }),
            )
          }}
          options={REMINDER_OPTIONS.map((days) => ({ value: String(days), label: t.in("settings", "%lld days", days) }))}
        />
      </SettingsRow>
    </SettingsSection>
  )
}

function OrganizationSection({ t, ledger }: { t: Translator; ledger: Ledger }) {
  const [methodsOpen, setMethodsOpen] = useState(false)
  const expense = ledger.categories.filter((category) => category.kind === "expense").length
  const income = ledger.categories.filter((category) => category.kind === "income").length
  const groups = paymentMethodGroups(ledger.accounts, ledger.cards)
  return (
    <SettingsSection title={t.in("settings", "Organization")}>
      <SettingsLinkRow label={t.in("settings", "Expense categories")} value={expense} href="/settings/categories#expense" />
      <SettingsLinkRow label={t.in("settings", "Income categories")} value={income} href="/settings/categories#income" />
      <SettingsLinkRow label={t.in("settings", "Payment methods")} value={ledger.cards.length} onClick={() => setMethodsOpen(true)} />
      <Dialog open={methodsOpen} onOpenChange={setMethodsOpen}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.in("settings", "Payment methods")}</DialogTitle>
          </DialogHeader>
          {groups.length === 0 ? (
            <p className="type-body text-muted-foreground">{t.in("settings", "Add a bank account or a card from Accounts to see it here.")}</p>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map(({ account, methods }) => (
                <div key={account.id} className="flex flex-col gap-2">
                  <h3 className="type-label text-text-secondary">{accountName(account)}</h3>
                  <DetailGroup>
                    {methods.map((card) => (
                      <div key={card.id} className="flex items-center gap-3 px-3 py-2.5">
                        {card.kind === "transfer" ? (
                          <span className="flex h-8 w-12 items-center justify-center rounded-md bg-secondary type-micro text-muted-foreground">⇄</span>
                        ) : (
                          <CardArt className="w-12 rounded-md! p-1!" size="sm" color={card.color} bank="" kind={card.kind} />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate type-label">{methodTitle(t, card, account)}</span>
                          <span className="truncate type-caption text-muted-foreground">
                            {card.kind === "transfer"
                              ? t.in("settings", "Charged straight to the account")
                              : plasticSubtitle(t, card)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </DetailGroup>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SettingsSection>
  )
}

/** "Premia · valid thru 09/28", "Debit · expired 02/26" (iOS PaymentMethodsView). */
function plasticSubtitle(t: Translator, card: Card): string {
  const base = card.productName ?? cardKindLabel(t, card.kind)
  if (!card.expiry) return base
  const now = new Date()
  const today = { year: now.getFullYear(), month: now.getMonth() + 1 }
  const order = compareExpiry(card.expiry, today)
  if (order < 0) return t.in("settings", "%@ · expired %@", base, expiryText(card.expiry))
  if (order === 0) return t.in("settings", "%@ · expires this month", base)
  return t.in("settings", "%@ · valid thru %@", base, expiryText(card.expiry))
}

function ShortcutsSection({ t }: { t: Translator }) {
  const { setShortcutsOpen } = useAppActions()
  return (
    <SettingsSection title={t.in("web", "Keyboard shortcuts")}>
      <SettingsRow label={t.in("web", "Show shortcuts")}>
        <Kbd>?</Kbd>
        <Button variant="secondary" size="sm" onClick={() => setShortcutsOpen(true)}>
          <KeyboardIcon data-icon="inline-start" />
          {t.in("web", "Keyboard shortcuts")}
        </Button>
      </SettingsRow>
    </SettingsSection>
  )
}
