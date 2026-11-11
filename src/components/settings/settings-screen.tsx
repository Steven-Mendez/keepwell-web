"use client"

import { BotIcon, InfoIcon, KeyboardIcon, LanguagesIcon, LogOutIcon, ShieldCheckIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { KWGroupedCard, KWLargeTitleHeader, KWSectionHeader } from "@/components/kw/design"
import { KWIcon, KWMiniCard } from "@/components/kw/kw-icon"
import type { KWIconName } from "@/components/kw/kw-icon-data"
import { OptionSelect } from "@/components/kw/pickers"
import { Page } from "@/components/kw/primitives"
import { SettingsSkeleton } from "@/components/kw/skeletons"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { useAccount } from "@/hooks/use-account"
import { useLedger, usePreferredName } from "@/hooks/use-ledger"
import { useSync } from "@/hooks/use-sync"
import { deleteAccount, signOut } from "@/lib/api/account"
import { compareExpiry, paymentMethodGroups, type Ledger } from "@/lib/domain"
import { PREFERRED_NAME_MAX_LENGTH, normalizedPreferredName, updateSettings } from "@/lib/domain/onboarding"
import { useI18n, type Translator } from "@/lib/i18n"
import { accountName, cardKindLabel, expiryText, methodTitle } from "@/lib/presentation/display"
import { ledgerStore, profileStore } from "@/lib/repositories"
import type { Card } from "@/lib/schema"
import { cn } from "@/lib/utils"

import packageJson from "../../../package.json"

import { AccountHeader, canSync, SecuritySection, SyncRows, useAccountAction, type AccountRun } from "./account-section"
import { ConfirmDialog } from "./confirm-dialog"
import { ConnectedAppsSection } from "./connected-apps-section"
import { CurrencySection } from "./currency-section"
import { DataSection, EraseDataRow } from "./data-section"
import { SETTINGS_INPUT, SettingsLinkRow, SettingsRow, SettingsSection, type SettingsIcon } from "./settings-rows"

const APP_VERSION = packageJson.version

/** iOS SettingsViewModel.reminderOptions. */
const REMINDER_OPTIONS = [1, 2, 3, 5, 7] as const

/** The sections, in the order iOS shows them; the list on wide screens jumps to each. */
type SectionId = "preferences" | "money" | "organization" | "data" | "security" | "assistants" | "about"

function sectionTitles(t: Translator): Record<SectionId, string> {
  return {
    preferences: t.in("settings", "Profile & preferences"),
    money: t.in("settings", "Money"),
    organization: t.in("settings", "Organization"),
    data: t.in("settings", "Data & sync"),
    security: t.in("settings", "Security"),
    assistants: t.in("cloudaccount", "Connected assistants"),
    about: t.in("settings", "About"),
  }
}

const SECTION_ICONS: Record<SectionId, SettingsIcon> = {
  preferences: "person",
  money: "cash",
  organization: "list",
  data: "cloud",
  security: <ShieldCheckIcon strokeWidth={2} />,
  assistants: <BotIcon strokeWidth={2} />,
  about: <InfoIcon strokeWidth={2} />,
}

/**
 * Settings, as one narrow column of grouped sections (Mobbin: Base, Wise): who you are and whether
 * the data syncs at the top, then preferences, money, organization, data and sync, security,
 * assistants and about, with the actions that end or erase something together at the bottom. Wide
 * screens add a list of the sections on the left (Copilot Money, Monarch).
 */
export function SettingsScreen() {
  const { t } = useI18n()
  const ledger = useLedger()
  const preferredName = usePreferredName()
  const { state, refresh } = useAccount()
  const me = state.status === "signed-in" ? state.me : undefined
  const { status: sync, rejected } = useSync(canSync(me) ? me?.user.id : undefined)
  const action = useAccountAction(t, refresh)

  const sections: SectionId[] = ["preferences", "money", "organization", "data", ...(me ? (["security"] as const) : []), ...(me?.capabilities.includes("mcp") ? (["assistants"] as const) : []), "about"]

  return (
    <Page>
      <KWLargeTitleHeader title={t.in("settings", "Settings")} />
      {!ledger ? (
        <SettingsSkeleton />
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[13rem_minmax(0,42rem)] lg:gap-12">
          <SectionNav t={t} sections={sections} />
          <div className="flex min-w-0 flex-col gap-8">
            <AccountHeader t={t} state={state} sync={sync} preferredName={preferredName} />
            <PreferencesSection t={t} />
            <CurrencySection t={t} ledger={ledger}>
              <ReminderRow t={t} ledger={ledger} />
            </CurrencySection>
            <OrganizationSection t={t} ledger={ledger} />
            <DataSection t={t} syncRows={me ? <SyncRows t={t} me={me} sync={sync} rejected={rejected} /> : undefined} />
            {me ? <SecuritySection t={t} action={action} /> : null}
            {me?.capabilities.includes("mcp") ? <ConnectedAppsSection t={t} /> : null}
            <AboutSection t={t} />
            <EndSection t={t} signedIn={me !== undefined} action={action} onSignedOut={refresh} />
          </div>
        </div>
      )}
    </Page>
  )
}

/** The sections on the left of a wide screen, the one in view marked. */
function SectionNav({ t, sections }: { t: Translator; sections: SectionId[] }) {
  const titles = sectionTitles(t)
  const [current, setCurrent] = useState<SectionId>(sections[0] ?? "preferences")
  const key = sections.join()

  useEffect(() => {
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting ? entry.boundingClientRect.top : Infinity)
        const top = [...visible].filter(([, y]) => y !== Infinity).sort((a, b) => a[1] - b[1])[0]
        if (top) setCurrent(top[0] as SectionId)
      },
      { rootMargin: "-80px 0px -55% 0px" }
    )
    const ids = key.split(",")
    for (const id of ids) {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    }
    // The last sections never reach the top: at the end of the page, the last one is current.
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) setCurrent(ids[ids.length - 1] as SectionId)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", onScroll)
    }
  }, [key])

  return (
    <nav aria-label={t.in("settings", "Settings")} className="sticky top-24 hidden flex-col gap-0.5 lg:flex">
      {sections.map((id) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={current === id ? "true" : undefined}
          onClick={() => setCurrent(id)}
          className={cn(
            "flex h-10 items-center gap-3 rounded-xl px-3 type-label outline-none transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-ring",
            current === id ? "bg-card text-foreground" : "text-muted-foreground"
          )}
        >
          <span className="flex size-5 items-center justify-center [&_svg]:size-4">{typeof SECTION_ICONS[id] === "string" ? <KWIcon name={SECTION_ICONS[id] as KWIconName} size={16} /> : SECTION_ICONS[id]}</span>
          {titles[id]}
        </a>
      ))}
    </nav>
  )
}

function PreferencesSection({ t }: { t: Translator }) {
  const stored = usePreferredName()
  const { locale, setLocale, isOverridden } = useI18n()
  const { setShortcutsOpen } = useAppActions()
  const [text, setText] = useState<string>()
  const commit = () => {
    if (text === undefined) return
    profileStore.setPreferredName(normalizedPreferredName(text))
    setText(undefined)
  }
  return (
    <SettingsSection id="preferences" title={sectionTitles(t).preferences}>
      <SettingsRow icon="person" label={t.in("settings", "Your name")} description={t.in("settings", "For the greeting")} htmlFor="preferred-name" wide>
        <Input
          id="preferred-name"
          className={`w-full sm:w-56 ${SETTINGS_INPUT}`}
          maxLength={PREFERRED_NAME_MAX_LENGTH}
          placeholder={t.in("settings", "Your name")}
          value={text ?? stored ?? ""}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit()
          }}
        />
      </SettingsRow>
      <SettingsRow icon={<LanguagesIcon strokeWidth={2} />} label={t.in("settings", "App language")} description={t.in("web", "Your browser's, unless you choose another one here.")} htmlFor="language" wide>
        <OptionSelect
          id="language"
          className="w-full sm:w-56"
          value={isOverridden ? locale : "auto"}
          onChange={(value) => setLocale(value === "en" || value === "es" ? value : undefined)}
          options={[
            { value: "auto", label: t.in("web", "Follow the browser") },
            { value: "en", label: "English" },
            { value: "es", label: "Español" },
          ]}
        />
      </SettingsRow>
      <SettingsLinkRow icon={<KeyboardIcon strokeWidth={2} />} label={t.in("web", "Keyboard shortcuts")} value="?" onClick={() => setShortcutsOpen(true)} />
    </SettingsSection>
  )
}

function ReminderRow({ t, ledger }: { t: Translator; ledger: Ledger }) {
  return (
    <SettingsRow icon="creditCard" label={t.in("settings", "Remind me to pay")} description={t.in("settings", "Credit cards")} htmlFor="reminder" wide>
      <OptionSelect
        id="reminder"
        className="w-full sm:w-40"
        value={String(ledger.settings.paymentReminderDaysBefore)}
        onChange={(value) => {
          const days = Number(value)
          updateSettings(ledgerStore, (settings) => ({ ...settings, paymentReminderDaysBefore: days })).catch(() =>
            toast.add({ title: t.in("settings", "We couldn't save the change. Try again."), type: "error" })
          )
        }}
        options={REMINDER_OPTIONS.map((days) => ({ value: String(days), label: t.in("settings", "%lld days", days) }))}
      />
    </SettingsRow>
  )
}

function AboutSection({ t }: { t: Translator }) {
  return (
    <SettingsSection id="about" title={sectionTitles(t).about}>
      <SettingsLinkRow icon={<ShieldCheckIcon strokeWidth={2} />} label={t.in("web", "Privacy Policy")} href="/privacy" />
      <SettingsRow icon={<InfoIcon strokeWidth={2} />} label={t.in("web", "Version")}>
        <span className="type-body text-text-secondary tabular-nums">{APP_VERSION}</span>
      </SettingsRow>
    </SettingsSection>
  )
}

/** What ends or erases something, together and last: sign out, delete the account, erase this browser. */
function EndSection({ t, signedIn, action, onSignedOut }: { t: Translator; signedIn: boolean; action: AccountRun; onSignedOut: () => void }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  return (
    <SettingsSection footnote={signedIn ? t.in("web", "Signing out or deleting the account keeps what's in this browser.") : undefined}>
      {signedIn ? (
        <>
          <SettingsLinkRow icon={<LogOutIcon strokeWidth={2} />} tone="destructive" label={t.in("cloudaccount", "Sign out")} disabled={action.busy} onClick={() => void action.run(signOut)} />
          <SettingsLinkRow
            icon="personOff"
            tone="destructive"
            label={t.in("cloudaccount", "Delete account")}
            description={t.in("cloudaccount", "Erases your synced data from Keepwell's servers.")}
            disabled={action.busy}
            onClick={() => setConfirmingDelete(true)}
          />
          <ConfirmDialog
            open={confirmingDelete}
            onOpenChange={setConfirmingDelete}
            title={t.in("cloudaccount", "Delete your Keepwell account?")}
            description={t.in("web", "You're signed out everywhere at once and your synced data is erased from Keepwell's servers. Backups keep it up to 35 more days. What's in this browser stays here.")}
            action={t.in("cloudaccount", "Delete account")}
            destructive
            onConfirm={() => void action.run(deleteAccount)}
          />
        </>
      ) : null}
      <EraseDataRow t={t} signedIn={signedIn} onSignedOut={onSignedOut} />
    </SettingsSection>
  )
}

function OrganizationSection({ t, ledger }: { t: Translator; ledger: Ledger }) {
  const [methodsOpen, setMethodsOpen] = useState(false)
  const expense = ledger.categories.filter(
    (category) => category.kind === "expense"
  ).length
  const income = ledger.categories.filter(
    (category) => category.kind === "income"
  ).length
  const groups = paymentMethodGroups(ledger.accounts, ledger.cards)
  return (
    <SettingsSection id="organization" title={t.in("settings", "Organization")}>
      <SettingsLinkRow
        icon="arrowUpRight"
        label={t.in("settings", "Expense categories")}
        value={expense}
        href="/settings/categories#expense"
      />
      <SettingsLinkRow
        icon="arrowDownLeft"
        label={t.in("settings", "Income categories")}
        value={income}
        href="/settings/categories#income"
      />
      <SettingsLinkRow
        icon="creditCard"
        label={t.in("settings", "Payment methods")}
        value={ledger.cards.length}
        onClick={() => setMethodsOpen(true)}
      />
      <SettingsLinkRow
        icon="bolt"
        label={t.in("settings", "Rules")}
        value={ledger.categorizationRules.length}
        href="/settings/rules"
      />
      <Dialog open={methodsOpen} onOpenChange={setMethodsOpen}>
        <DialogContent className="max-h-[85svh] gap-5 overflow-y-auto rounded-2xl bg-background p-6 ring-1 ring-border/60 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="type-heading">
              {t.in("settings", "Payment methods")}
            </DialogTitle>
          </DialogHeader>
          {groups.length === 0 ? (
            <p className="type-body text-muted-foreground">
              {t.in(
                "settings",
                "Add a bank account or a card from Accounts to see it here."
              )}
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map(({ account, methods }) => (
                <div key={account.id} className="flex flex-col gap-2">
                  <KWSectionHeader title={accountName(account)} />
                  <KWGroupedCard>
                    {methods.map((card) => (
                      <div
                        key={card.id}
                        className="flex min-h-12 items-center gap-3 px-4 py-2.5"
                      >
                        {card.kind === "transfer" ? (
                          <KWMiniCard kind="transfer" />
                        ) : (
                          <KWMiniCard color={card.color} />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate type-label text-foreground">
                            {methodTitle(t, card, account)}
                          </span>
                          <span className="truncate type-caption text-muted-foreground">
                            {card.kind === "transfer"
                              ? t.in(
                                  "settings",
                                  "Charged straight to the account"
                                )
                              : plasticSubtitle(t, card)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </KWGroupedCard>
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
  if (order < 0)
    return t.in("settings", "%@ · expired %@", base, expiryText(card.expiry))
  if (order === 0) return t.in("settings", "%@ · expires this month", base)
  return t.in("settings", "%@ · valid thru %@", base, expiryText(card.expiry))
}
