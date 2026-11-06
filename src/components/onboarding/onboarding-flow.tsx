"use client"

import {
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  BanknoteIcon,
  CheckIcon,
  CreditCardIcon,
  FileJsonIcon,
  GlobeIcon,
  LandmarkIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
  UserRoundXIcon,
  type LucideIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState, type FormEvent, type ReactNode } from "react"

import { IconBadge } from "@/components/kw/primitives"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { toast } from "@/components/ui/toast"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Decimal,
  ZERO,
  completeOnboarding,
  currencySettings,
  formatAmount,
  formatAmountInput,
  normalizedPreferredName,
  onboardingDisplayName,
  parseAmount,
  type OnboardingAccountDraft,
} from "@/lib/domain"
import { useT, type Translator } from "@/lib/i18n"
import { backupRepository, ledgerStore, profileStore } from "@/lib/repositories"
import type { CardNetwork, DebtMode } from "@/lib/schema"
import { cn } from "@/lib/utils"

type Step = "welcome" | "returning" | "name" | "currencies" | "accounts" | "done"
const STEPS: readonly Step[] = ["welcome", "returning", "name", "currencies", "accounts", "done"]

/** The quick picks iOS offers (`OnboardingViewModel.commonCurrencies`). */
const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "MXN", "CAD", "JPY", "CHF", "BRL"]

const ALL_CURRENCIES: readonly string[] = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("currency") : COMMON_CURRENCIES

/** The region's currency when the browser knows it and it's a common one, else USD (iOS does the same). */
function regionCurrency(): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region
    const byRegion: Record<string, string> = { US: "USD", GB: "GBP", MX: "MXN", CA: "CAD", JP: "JPY", CH: "CHF", BR: "BRL", ES: "EUR", FR: "EUR", DE: "EUR", IT: "EUR" }
    return (region && byRegion[region]) ?? "USD"
  } catch {
    return "USD"
  }
}

function currencyName(t: Translator, code: string): string {
  try {
    return new Intl.DisplayNames(t.locale, { type: "currency" }).of(code) ?? code
  } catch {
    return code
  }
}

/** Onboarding (iOS OnboardingFlowView): restore a backup or set up name, currencies and accounts. */
export function OnboardingFlow() {
  const t = useT()
  const router = useRouter()
  const [step, setStep] = useState<Step>("welcome")
  const [name, setName] = useState("")
  const [principal, setPrincipal] = useState(regionCurrency)
  const [usesTwo, setUsesTwo] = useState(false)
  const [second, setSecond] = useState(() => COMMON_CURRENCIES.find((code) => code !== regionCurrency()) ?? "EUR")
  const [rateText, setRateText] = useState("1")
  const [accounts, setAccounts] = useState<OnboardingAccountDraft[]>([])
  const [saving, setSaving] = useState(false)

  const rate = parseAmount(rateText)
  const currencies = usesTwo && rate && rate.gt(0) ? currencySettings(principal, second, rate) : currencySettings(principal)
  const index = STEPS.indexOf(step)
  const back = index > 1 ? () => setStep(STEPS[index - 1] as Step) : undefined

  /** With cash in two currencies, "Cash" alone can't tell them apart (iOS `accountsToSave`). */
  function accountsToSave(): OnboardingAccountDraft[] {
    const cashCount = accounts.filter((account) => account.kind === "cash").length
    if (cashCount < 2) return accounts
    return accounts.map((account) => (account.kind === "cash" ? { ...account, name: t.in("onboarding", "Cash %@", account.currency) } : account))
  }

  async function finish(then: "home" | "expense") {
    setSaving(true)
    try {
      await completeOnboarding(ledgerStore, profileStore, { currencies, accounts: accountsToSave(), locksWithBiometrics: false, hasPasscode: false, hidesAmountsInAppSwitcher: true, backsUpToICloud: false, preferredName: name }, new Date())
      if (then === "expense") {
        try {
          sessionStorage.setItem("keepwell.openEditor", "expense")
        } catch {}
      }
      router.replace("/")
    } catch {
      setSaving(false)
      toast.add({ title: t.in("onboarding", "We couldn't save your data. Try again."), type: "error" })
    }
  }

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-brand-600/20 blur-3xl" aria-hidden />
      <header className="relative flex items-center justify-between px-(--gutter) py-4 md:px-8">
        <div className="flex items-center gap-2 text-heading">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG, nothing to optimize */}
          <img src="/icon.svg" alt="" className="size-7 rounded-mini" />
          Keepwell
        </div>
        {index > 0 && step !== "done" ? (
          <ol className="flex items-center gap-1.5" aria-label={t.in("designsystem", "Step %lld of %lld", index, STEPS.length - 1)}>
            {STEPS.slice(1).map((candidate, position) => (
              <li key={candidate} className={cn("h-1.5 w-6 rounded-full", position < index ? "bg-foreground" : "bg-control-off")} />
            ))}
          </ol>
        ) : null}
      </header>
      <main className="relative flex flex-1 items-start justify-center px-(--gutter) pb-10 md:items-center">
        <div className="w-full max-w-xl">
          {back ? (
            <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={back}>
              <ArrowLeftIcon data-icon="inline-start" />
              {t.in("designsystem", "Back")}
            </Button>
          ) : null}
          {step === "welcome" ? <WelcomeStep onStart={() => setStep("returning")} /> : null}
          {step === "returning" ? <ReturningStep onScratch={() => setStep("name")} /> : null}
          {step === "name" ? <NameStep name={name} onChange={setName} onNext={() => setStep("currencies")} /> : null}
          {step === "currencies" ? (
            <CurrenciesStep
              principal={principal}
              second={second}
              usesTwo={usesTwo}
              rateText={rateText}
              onPrincipal={(code) => {
                setPrincipal(code)
                if (code === second) setSecond(COMMON_CURRENCIES.find((other) => other !== code) ?? "EUR")
              }}
              onSecond={setSecond}
              onUsesTwo={setUsesTwo}
              onRate={setRateText}
              onSwap={() => {
                setPrincipal(second)
                setSecond(principal)
                if (rate && rate.gt(0)) setRateText(new Decimal(1).div(rate).toDecimalPlaces(6).toFixed())
              }}
              onNext={() => {
                // Accounts typed in a currency no longer chosen move to the main one.
                const chosen = usesTwo ? [principal, second] : [principal]
                setAccounts((list) => list.map((account) => (chosen.includes(account.currency) ? account : { ...account, currency: principal })))
                setStep("accounts")
              }}
            />
          ) : null}
          {step === "accounts" ? (
            <AccountsStep principal={currencies.principal} second={currencies.second} accounts={accounts} onChange={setAccounts} onNext={() => setStep("done")} />
          ) : null}
          {step === "done" ? (
            <DoneStep name={normalizedPreferredName(name)} principal={currencies.principal} second={currencies.second} rate={rateText} accountCount={accounts.length} saving={saving} onFinish={(then) => void finish(then)} />
          ) : null}
        </div>
      </main>
    </div>
  )
}

function Heading({ title, body }: { title: ReactNode; body?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <h1 className="text-title">{title}</h1>
      {body ? <p className="text-body text-muted-foreground">{body}</p> : null}
    </div>
  )
}

function Feature({ icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <li className="flex items-center gap-3">
      <IconBadge icon={icon} tone="accent" />
      <span className="text-label">{title}</span>
    </li>
  )
}

function WelcomeStep({ onStart }: { onStart: () => void }) {
  const t = useT()
  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-2xl bg-card p-6 shadow-glow ring-1 ring-border/60">
        <p className="text-label text-text-secondary">{t.in("home", "Net worth")}</p>
        <p className="text-display">$11,157.46</p>
      </div>
      <Heading title={t.in("onboarding", "Your money, clear, in one or two currencies")} body={t.in("onboarding", "Log expenses, income and transfers. Cards, cash and drafts to confirm later.")} />
      <ul className="flex flex-col gap-3">
        <Feature icon={UserRoundXIcon} title={t.in("onboarding", "No account or sign-up")} />
        <Feature icon={ShieldCheckIcon} title={t.in("web", "Stored in this browser")} />
        <Feature icon={GlobeIcon} title={t.in("onboarding", "Any currency, with your own rate")} />
      </ul>
      <Button size="lg" className="h-12 text-heading" onClick={onStart} autoFocus>
        {t.in("onboarding", "Start")}
      </Button>
    </div>
  )
}

function ReturningStep({ onScratch }: { onScratch: () => void }) {
  const t = useT()
  const file = useRef<HTMLInputElement>(null)
  const [restoring, setRestoring] = useState(false)

  async function restore(selected: File) {
    setRestoring(true)
    try {
      const summary = await backupRepository.import(await selected.text())
      toast.add({ title: t.in("app", "Restored %lld accounts and %lld movements", summary.accounts, summary.transactions), type: "success" })
      // The shell sees finished settings and opens home.
    } catch {
      setRestoring(false)
      toast.add({ title: t.in("app", "That file isn't a Keepwell backup."), type: "error" })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Heading title={t.in("onboarding", "Have you used Keepwell before?")} body={t.in("onboarding", "Bring your accounts, cards and movements from a backup, or set everything up from scratch.")} />
      <ChoiceButton icon={FileJsonIcon} title={t.in("onboarding", "Restore from a backup file (.json)")} body={t.in("onboarding", "A file saved with “Back up now” in Settings")} onClick={() => file.current?.click()} disabled={restoring} />
      <ChoiceButton icon={SparklesIcon} title={t.in("onboarding", "Start from scratch")} onClick={onScratch} />
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const selected = event.target.files?.[0]
          event.target.value = ""
          if (selected) void restore(selected)
        }}
      />
    </div>
  )
}

function ChoiceButton({ icon, title, body, onClick, disabled }: { icon: LucideIcon; title: string; body?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-4 rounded-2xl bg-card p-4 text-left ring-1 ring-border/60 transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      <IconBadge icon={icon} tone="accent" />
      <span className="flex flex-col gap-0.5">
        <span className="text-label">{title}</span>
        {body ? <span className="text-caption text-muted-foreground">{body}</span> : null}
      </span>
    </button>
  )
}

function NameStep({ name, onChange, onNext }: { name: string; onChange: (name: string) => void; onNext: () => void }) {
  const t = useT()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onNext()
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Heading title={t.in("onboarding", "What's your name?")} body={t.in("web", "We'll use it to greet you and show it on your cards. It's only stored in this browser.")} />
      <Field>
        <FieldLabel htmlFor="name">{t.in("onboarding", "Your name")}</FieldLabel>
        <Input id="name" value={name} onChange={(event) => onChange(event.target.value)} placeholder={t.in("onboarding", "Your first name")} maxLength={30} autoFocus autoComplete="given-name" className="h-11" />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="flex-1">
          {t.in("onboarding", "Continue")}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="ghost"
          onClick={() => {
            onChange("")
            onNext()
          }}
        >
          {t.in("onboarding", "Skip")}
        </Button>
      </div>
    </form>
  )
}

function CurrencySelect({ id, value, onChange, exclude }: { id: string; value: string; onChange: (code: string) => void; exclude?: string }) {
  const t = useT()
  const others = ALL_CURRENCIES.filter((code) => !COMMON_CURRENCIES.includes(code) && code !== exclude)
  return (
    <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full">
      <optgroup label={t.in("onboarding", "Common")}>
        {[value, ...COMMON_CURRENCIES.filter((code) => code !== value)]
          .filter((code) => code !== exclude)
          .map((code) => (
            <NativeSelectOption key={code} value={code}>
              {code} · {currencyName(t, code)}
            </NativeSelectOption>
          ))}
      </optgroup>
      <optgroup label={t.in("onboarding", "All currencies")}>
        {others.map((code) => (
          <NativeSelectOption key={code} value={code}>
            {code} · {currencyName(t, code)}
          </NativeSelectOption>
        ))}
      </optgroup>
    </NativeSelect>
  )
}

function CurrenciesStep(props: {
  principal: string
  second: string
  usesTwo: boolean
  rateText: string
  onPrincipal: (code: string) => void
  onSecond: (code: string) => void
  onUsesTwo: (two: boolean) => void
  onRate: (text: string) => void
  onSwap: () => void
  onNext: () => void
}) {
  const t = useT()
  const rate = parseAmount(props.rateText)
  const rateInvalid = props.usesTwo && (!rate || rate.lte(0))
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        if (!rateInvalid) props.onNext()
      }}
    >
      <Heading title={t.in("onboarding", "Which currencies do you use?")} body={t.in("onboarding", "Reports and net worth are calculated in the main currency.")} />
      <ToggleGroup value={[props.usesTwo ? "two" : "one"]} onValueChange={(value: string[]) => value[0] && props.onUsesTwo(value[0] === "two")} variant="outline" className="w-full">
        <ToggleGroupItem value="one" className="flex-1">
          {t.in("onboarding", "One currency")}
        </ToggleGroupItem>
        <ToggleGroupItem value="two" className="flex-1">
          {t.in("onboarding", "Two currencies")}
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 ring-1 ring-border/60">
        <Field>
          <FieldLabel htmlFor="principal">{t.in("onboarding", "Main currency")}</FieldLabel>
          <CurrencySelect id="principal" value={props.principal} onChange={props.onPrincipal} />
        </Field>
        {props.usesTwo ? (
          <>
            <div className="flex justify-center">
              <Button type="button" variant="ghost" size="sm" onClick={props.onSwap} aria-label={t.in("onboarding", "Swap main and second currency")}>
                <ArrowLeftRightIcon data-icon="inline-start" className="rotate-90" />
                {t.in("onboarding", "Swap")}
              </Button>
            </div>
            <Field>
              <FieldLabel htmlFor="second">{t.in("onboarding", "Second currency")}</FieldLabel>
              <CurrencySelect id="second" value={props.second} onChange={props.onSecond} exclude={props.principal} />
            </Field>
            <Field data-invalid={rateInvalid || undefined}>
              <FieldLabel htmlFor="rate">{t.in("onboarding", "Exchange rate (you set it)")}</FieldLabel>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-label text-text-secondary">1 {props.principal} =</span>
                <Input id="rate" inputMode="decimal" value={props.rateText} onChange={(event) => props.onRate(event.target.value)} placeholder="1.0000" className="h-11 tabular-nums" aria-invalid={rateInvalid} />
                <span className="shrink-0 text-label text-text-secondary">{props.second}</span>
              </div>
              <FieldDescription>{t.in("onboarding", "It defaults to 1. Change it whenever you want; each transaction keeps the rate from when you logged it.")}</FieldDescription>
              {rateInvalid ? <FieldError>{t.in("settings", "The rate has to be a number greater than zero.")}</FieldError> : null}
            </Field>
          </>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={rateInvalid}>
        {t.in("onboarding", "Continue")}
      </Button>
    </form>
  )
}

type AccountKind = OnboardingAccountDraft["kind"]

function AccountsStep({ principal, second, accounts, onChange, onNext }: { principal: string; second: string | undefined; accounts: OnboardingAccountDraft[]; onChange: (accounts: OnboardingAccountDraft[]) => void; onNext: () => void }) {
  const t = useT()
  const [editing, setEditing] = useState<OnboardingAccountDraft>()
  const currencies = [principal, second].filter((code): code is string => code !== undefined)

  const subtitle = (account: OnboardingAccountDraft) => {
    switch (account.kind) {
      case "bank":
        return account.lastFour ? t.in("onboarding", "Bank · %@ · Debit ··%@", account.currency, account.lastFour) : t.in("onboarding", "Bank · %@", account.currency)
      case "credit":
        if (account.debtMode === "dual" && second) return t.in("onboarding", "Credit · %@ and %@", second, principal)
        return t.in("onboarding", "Credit · %@", account.debtMode === "second" && second ? second : principal)
      case "cash":
        return t.in("onboarding", "Cash")
    }
  }
  const balance = (account: OnboardingAccountDraft) => {
    if (account.kind !== "credit") return formatAmount(account.balance, account.currency)
    if (account.debtMode === "dual" && second) return `${formatAmount(account.balance.neg(), principal)} · ${formatAmount(account.secondBalance.neg(), second)}`
    return formatAmount(account.balance.neg(), account.debtMode === "second" && second ? second : principal)
  }
  const start = (kind: AccountKind) =>
    setEditing({
      id: crypto.randomUUID(),
      kind,
      name: kind === "cash" ? t.in("onboarding", "Cash") : "",
      currency: kind === "cash" ? (currencies.find((code) => !accounts.some((a) => a.kind === "cash" && a.currency === code)) ?? principal) : principal,
      balance: ZERO,
      secondBalance: ZERO,
      ...(kind === "credit" ? { debtMode: (second ? "dual" : "principal") as DebtMode, network: "visa" as CardNetwork } : {}),
    })

  return (
    <div className="flex flex-col gap-6">
      <Heading title={t.in("onboarding", "Add your accounts")} body={t.in("onboarding", "With today's balance. Credit cards start with what you owe.")} />
      <div className="grid grid-cols-3 gap-2">
        <KindButton icon={LandmarkIcon} label={t.in("onboarding", "Bank")} onClick={() => start("bank")} />
        <KindButton icon={CreditCardIcon} label={t.in("onboarding", "Credit card")} onClick={() => start("credit")} />
        <KindButton icon={BanknoteIcon} label={t.in("onboarding", "Cash")} onClick={() => start("cash")} />
      </div>
      {accounts.length > 0 ? (
        <ul className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card ring-1 ring-border/60">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center gap-2 pr-2">
              <button type="button" className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary/50" onClick={() => setEditing(account)}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-label">{onboardingDisplayName(account) || t.in("onboarding", "Account")}</span>
                  <span className="text-caption text-muted-foreground">{subtitle(account)}</span>
                </span>
                <span className="text-label tabular-nums">{balance(account)}</span>
              </button>
              <Button variant="ghost" size="icon-sm" aria-label={t.in("onboarding", "Remove account")} onClick={() => onChange(accounts.filter((other) => other.id !== account.id))}>
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button size="lg" onClick={onNext}>
        {t.in("onboarding", "Continue")}
      </Button>
      {editing ? (
        <AccountForm
          draft={editing}
          isNew={!accounts.some((account) => account.id === editing.id)}
          currencies={editing.kind === "cash" ? currencies.filter((code) => code === editing.currency || !accounts.some((a) => a.kind === "cash" && a.id !== editing.id && a.currency === code)) : currencies}
          principal={principal}
          second={second}
          onCancel={() => setEditing(undefined)}
          onRemove={() => {
            onChange(accounts.filter((account) => account.id !== editing.id))
            setEditing(undefined)
          }}
          onSave={(saved) => {
            onChange(accounts.some((account) => account.id === saved.id) ? accounts.map((account) => (account.id === saved.id ? saved : account)) : [...accounts, saved])
            setEditing(undefined)
          }}
        />
      ) : null}
    </div>
  )
}

function KindButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-2 rounded-2xl bg-card px-3 py-4 ring-1 ring-border/60 transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
      <Icon className="size-6 text-link" aria-hidden />
      <span className="text-label">{label}</span>
    </button>
  )
}

function amountText(value: Decimal): string {
  return value.isZero() ? "" : (formatAmountInput(value.toFixed()) ?? value.toFixed())
}

function AccountForm({
  draft,
  isNew,
  currencies,
  principal,
  second,
  onSave,
  onCancel,
  onRemove,
}: {
  draft: OnboardingAccountDraft
  isNew: boolean
  currencies: string[]
  principal: string
  second: string | undefined
  onSave: (draft: OnboardingAccountDraft) => void
  onCancel: () => void
  onRemove: () => void
}) {
  const t = useT()
  const [bank, setBank] = useState(draft.bank ?? "")
  const [name, setName] = useState(draft.name)
  const [currency, setCurrency] = useState(draft.currency)
  const [balanceText, setBalanceText] = useState(amountText(draft.balance))
  const [secondText, setSecondText] = useState(amountText(draft.secondBalance))
  const [lastFour, setLastFour] = useState(draft.lastFour ?? "")
  const [network, setNetwork] = useState<CardNetwork>(draft.network ?? "visa")
  const [debtMode, setDebtMode] = useState<DebtMode>(draft.debtMode ?? (second ? "dual" : "principal"))
  const [showErrors, setShowErrors] = useState(false)

  const balance = balanceText.trim() === "" ? ZERO : parseAmount(balanceText)
  const secondBalance = secondText.trim() === "" ? ZERO : parseAmount(secondText)
  const lastFourInvalid = lastFour !== "" && !/^[0-9]{4}$/.test(lastFour)
  const balanceInvalid = balance === undefined
  const secondInvalid = draft.kind === "credit" && debtMode === "dual" && secondBalance === undefined
  const title = { bank: "Bank account", credit: "Credit card", cash: "Cash" }[draft.kind]
  const debtCurrency = debtMode === "second" && second ? second : principal

  function submit(event: FormEvent) {
    event.preventDefault()
    if (lastFourInvalid || balanceInvalid || secondInvalid || !balance) {
      setShowErrors(true)
      return
    }
    const trimmedBank = bank.trim()
    const defaultName = draft.kind === "credit" ? ({ visa: "Visa", mastercard: "Mastercard", amex: "Amex", other: t.in("onboarding", "Credit card") } as const)[network] : t.in("onboarding", draft.kind === "cash" ? "Cash" : "Savings")
    onSave({
      id: draft.id,
      kind: draft.kind,
      name: name.trim() || defaultName,
      ...(trimmedBank ? { bank: trimmedBank } : {}),
      currency: draft.kind === "credit" ? debtCurrency : currency,
      balance,
      secondBalance: secondBalance ?? ZERO,
      ...(lastFour ? { lastFour } : {}),
      ...(draft.kind === "cash" ? {} : { network }),
      ...(draft.kind === "credit" ? { debtMode: second ? debtMode : "principal" } : {}),
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t.in("onboarding", title)}</DialogTitle>
          </DialogHeader>
          {draft.kind !== "cash" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="bank">{t.in("onboarding", "Bank")}</FieldLabel>
                <Input id="bank" value={bank} onChange={(event) => setBank(event.target.value)} placeholder={t.in("onboarding", "Bank name")} autoFocus />
              </Field>
              <Field>
                <FieldLabel htmlFor="account-name">{t.in("onboarding", "Name")}</FieldLabel>
                <Input id="account-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={draft.kind === "credit" ? "Visa" : t.in("onboarding", "Savings")} />
              </Field>
            </div>
          ) : null}
          {draft.kind !== "credit" && currencies.length > 1 ? (
            <Field>
              <FieldLabel>{t.in("onboarding", "Currency")}</FieldLabel>
              <ToggleGroup value={[currency]} onValueChange={(value: string[]) => value[0] && setCurrency(value[0])} variant="outline">
                {currencies.map((code) => (
                  <ToggleGroupItem key={code} value={code} className="flex-1">
                    {code}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          ) : null}
          {draft.kind === "credit" && second ? (
            <Field>
              <FieldLabel>{t.in("onboarding", "Which currencies does it charge you in?")}</FieldLabel>
              <ToggleGroup value={[debtMode]} onValueChange={(value: string[]) => value[0] && setDebtMode(value[0] as DebtMode)} variant="outline" className="flex-wrap">
                <ToggleGroupItem value="dual" className="flex-1">
                  {t.in("onboarding", "Two currencies")}
                </ToggleGroupItem>
                <ToggleGroupItem value="principal" className="flex-1">
                  {t.in("onboarding", "Only %@", principal)}
                </ToggleGroupItem>
                <ToggleGroupItem value="second" className="flex-1">
                  {t.in("onboarding", "Only %@", second)}
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={(showErrors && balanceInvalid) || undefined}>
              <FieldLabel htmlFor="balance">{draft.kind === "credit" ? t.in("onboarding", "Debt in %@", debtCurrency) : t.in("onboarding", "Today's balance")}</FieldLabel>
              <Input
                id="balance"
                inputMode="decimal"
                value={balanceText}
                onChange={(event) => setBalanceText(event.target.value)}
                onBlur={() => setBalanceText((text) => formatAmountInput(text) ?? text)}
                placeholder="10,000.00"
                className="tabular-nums"
                autoFocus={draft.kind === "cash"}
                aria-invalid={showErrors && balanceInvalid}
              />
              {showErrors && balanceInvalid ? <FieldError>{t.in("onboarding", "Enter an amount like 1,250.50.")}</FieldError> : null}
            </Field>
            {draft.kind === "credit" && debtMode === "dual" && second ? (
              <Field data-invalid={(showErrors && secondInvalid) || undefined}>
                <FieldLabel htmlFor="second-balance">{t.in("onboarding", "Debt in %@", second)}</FieldLabel>
                <Input id="second-balance" inputMode="decimal" value={secondText} onChange={(event) => setSecondText(event.target.value)} onBlur={() => setSecondText((text) => formatAmountInput(text) ?? text)} placeholder="10,000.00" className="tabular-nums" />
                {showErrors && secondInvalid ? <FieldError>{t.in("onboarding", "Enter an amount like 1,250.50.")}</FieldError> : null}
              </Field>
            ) : null}
          </div>
          {draft.kind !== "cash" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={(showErrors && lastFourInvalid) || undefined}>
                <FieldLabel htmlFor="last-four">{t.in("onboarding", draft.kind === "bank" ? "Debit, last 4" : "Last 4 digits")}</FieldLabel>
                <Input id="last-four" inputMode="numeric" maxLength={4} value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, ""))} placeholder={t.in("onboarding", "Optional")} className="font-mono tracking-widest" />
                {showErrors && lastFourInvalid ? <FieldError>{t.in("onboarding", "Enter all 4 digits or leave it empty.")}</FieldError> : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="network">{t.in("addcard", "Network")}</FieldLabel>
                <NativeSelect id="network" value={network} onChange={(event) => setNetwork(event.target.value as CardNetwork)} className="w-full">
                  <NativeSelectOption value="visa">Visa</NativeSelectOption>
                  <NativeSelectOption value="mastercard">Mastercard</NativeSelectOption>
                  <NativeSelectOption value="amex">Amex</NativeSelectOption>
                  <NativeSelectOption value="other">{t.in("onboarding", "Other")}</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            {!isNew ? (
              <Button type="button" variant="ghost" className="text-destructive sm:mr-auto" onClick={onRemove}>
                {t.in("onboarding", "Remove account")}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onCancel}>
              {t.in("web", "Cancel")}
            </Button>
            <Button type="submit">{t.in("onboarding", isNew ? "Add" : "Save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DoneStep({ name, principal, second, rate, accountCount, saving, onFinish }: { name: string | undefined; principal: string; second: string | undefined; rate: string; accountCount: number; saving: boolean; onFinish: (then: "home" | "expense") => void }) {
  const t = useT()
  const rows: [string, string][] = [
    [t.in("onboarding", "Currencies"), second ? `${principal} · ${second}` : principal],
    ...(second ? [[t.in("onboarding", "Rate"), `1 ${principal} = ${rate} ${second}`] as [string, string]] : []),
    [t.in("onboarding", "Accounts"), String(accountCount)],
  ]
  return (
    <div className="flex flex-col gap-6">
      <span className="flex size-16 items-center justify-center rounded-full bg-positive-tint text-positive">
        <CheckIcon className="size-8" aria-hidden />
      </span>
      <Heading title={name ? t.in("onboarding", "All set, %@", name) : t.in("onboarding", "All set")} body={t.in("onboarding", "Now log your first transaction. The more you record, the better your monthly summary.")} />
      <dl className="divide-y divide-divider rounded-2xl bg-card ring-1 ring-border/60">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-label text-text-secondary">{label}</dt>
            <dd className="text-label tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" className="flex-1" disabled={saving} onClick={() => onFinish("expense")} autoFocus>
          {t.in("onboarding", "Log first expense")}
        </Button>
        <Button size="lg" variant="secondary" className="flex-1" disabled={saving} onClick={() => onFinish("home")}>
          {t.in("onboarding", "Go to home")}
        </Button>
      </div>
    </div>
  )
}

