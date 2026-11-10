"use client"

import { COMMON_CURRENCIES } from "@/components/kw/currencies"
import { transactionAmountClass } from "@/components/kw/design-styles"
import { newID } from "@/lib/platform/uuid"

import { useRouter } from "next/navigation"
import { useRef, useState, type FormEvent, type ReactNode } from "react"

import {
  KWButton,
  KWCircleButton,
  KWGroupedCard,
  KWSegmented,
  KWTransactionIcon,
  KWValueRow,
} from "@/components/kw/design"
import { KWIcon, KWLockup, KWMiniCard } from "@/components/kw/kw-icon"
import type { KWIconName } from "@/components/kw/kw-icon-data"
import { CurrencyPicker } from "@/components/kw/pickers"
import { CardArt } from "@/components/kw/primitives"
import {
  FieldLabel,
  FlowHeader,
  KW_FIELD,
} from "@/components/movement-editor/flow-parts"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import {
  Decimal,
  ZERO,
  currencySettings,
} from "@/lib/domain"
import {
  formatAmount,
  parseAmount,
} from "@/lib/domain/format"
import {
  completeOnboarding,
  normalizedPreferredName,
  onboardingDisplayName,
  type OnboardingAccountDraft,
} from "@/lib/domain/onboarding"
import { useT } from "@/lib/i18n"
import { backupRepository, ledgerStore, profileStore } from "@/lib/repositories"
import type { CardNetwork, DebtMode } from "@/lib/schema"

import { AccountForm } from "./account-form"

type Step =
  "welcome" | "returning" | "name" | "currencies" | "accounts" | "done"
const STEPS: readonly Step[] = [
  "welcome",
  "returning",
  "name",
  "currencies",
  "accounts",
  "done",
]

/** The region's currency when the browser knows it and it's a common one, else USD (iOS does the same). */
function regionCurrency(): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region
    const byRegion: Record<string, string> = {
      US: "USD",
      GB: "GBP",
      MX: "MXN",
      CA: "CAD",
      JP: "JPY",
      CH: "CHF",
      BR: "BRL",
      ES: "EUR",
      FR: "EUR",
      DE: "EUR",
      IT: "EUR",
    }
    return (region && byRegion[region]) ?? "USD"
  } catch {
    return "USD"
  }
}

/**
 * Onboarding (iOS OnboardingFlowView): restore a backup or set up name, currencies and accounts.
 * Drawn with the iOS flow parts (KWFlowHeader with back and step progress, large titles, the white
 * primary button) in a centered column sized for a desktop window.
 */
export function OnboardingFlow() {
  const t = useT()
  const router = useRouter()
  const [step, setStep] = useState<Step>("welcome")
  const [name, setName] = useState("")
  const [principal, setPrincipal] = useState(regionCurrency)
  const [usesTwo, setUsesTwo] = useState(false)
  const [second, setSecond] = useState(
    () => COMMON_CURRENCIES.find((code) => code !== regionCurrency()) ?? "EUR"
  )
  const [rateText, setRateText] = useState("1")
  const [accounts, setAccounts] = useState<OnboardingAccountDraft[]>([])
  const [saving, setSaving] = useState(false)

  const rate = parseAmount(rateText)
  const currencies =
    usesTwo && rate && rate.gt(0)
      ? currencySettings(principal, second, rate)
      : currencySettings(principal)
  const index = STEPS.indexOf(step)

  /** With cash in two currencies, "Cash" alone can't tell them apart (iOS `accountsToSave`). */
  function accountsToSave(): OnboardingAccountDraft[] {
    const cashCount = accounts.filter(
      (account) => account.kind === "cash"
    ).length
    if (cashCount < 2) return accounts
    return accounts.map((account) =>
      account.kind === "cash"
        ? { ...account, name: t.in("onboarding", "Cash %@", account.currency) }
        : account
    )
  }

  async function finish(then: "home" | "expense") {
    setSaving(true)
    try {
      await completeOnboarding(
        ledgerStore,
        profileStore,
        {
          currencies,
          accounts: accountsToSave(),
          locksWithBiometrics: false,
          hasPasscode: false,
          hidesAmountsInAppSwitcher: true,
          backsUpToICloud: false,
          preferredName: name,
        },
        new Date()
      )
      if (then === "expense") {
        try {
          sessionStorage.setItem("keepwell.openEditor", "expense")
        } catch {}
      }
      router.replace("/")
    } catch {
      setSaving(false)
      toast.add({
        title: t.in("onboarding", "We couldn't save your data. Try again."),
        type: "error",
      })
    }
  }

  if (step === "welcome")
    return <WelcomeScreen onStart={() => setStep("returning")} />

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute -top-48 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-brand-600/20 blur-3xl"
        aria-hidden
      />
      <main className="relative flex flex-1 items-start justify-center px-(--gutter) py-8 md:items-center md:py-12">
        <div className="flex w-full max-w-xl flex-col gap-8">
          {step === "done" ? (
            <div className="flex items-center gap-2.5">
              <KWLockup height={28} className="text-foreground" />
            </div>
          ) : (
            <FlowHeader
              leading="back"
              onLeading={() => setStep(STEPS[index - 1] as Step)}
              progress={{ total: STEPS.length - 2, current: index }}
            />
          )}
          {step === "returning" ? (
            <ReturningStep onScratch={() => setStep("name")} />
          ) : null}
          {step === "name" ? (
            <NameStep
              name={name}
              onChange={setName}
              onNext={() => setStep("currencies")}
            />
          ) : null}
          {step === "currencies" ? (
            <CurrenciesStep
              principal={principal}
              second={second}
              usesTwo={usesTwo}
              rateText={rateText}
              onPrincipal={(code) => {
                setPrincipal(code)
                if (code === second)
                  setSecond(
                    COMMON_CURRENCIES.find((other) => other !== code) ?? "EUR"
                  )
              }}
              onSecond={setSecond}
              onUsesTwo={setUsesTwo}
              onRate={setRateText}
              onSwap={() => {
                setPrincipal(second)
                setSecond(principal)
                if (rate && rate.gt(0))
                  setRateText(
                    new Decimal(1).div(rate).toDecimalPlaces(6).toFixed()
                  )
              }}
              onNext={() => {
                // Accounts typed in a currency no longer chosen move to the main one.
                const chosen = usesTwo ? [principal, second] : [principal]
                setAccounts((list) =>
                  list.map((account) =>
                    chosen.includes(account.currency)
                      ? account
                      : { ...account, currency: principal }
                  )
                )
                setStep("accounts")
              }}
            />
          ) : null}
          {step === "accounts" ? (
            <AccountsStep
              principal={currencies.principal}
              second={currencies.second}
              accounts={accounts}
              onChange={setAccounts}
              onNext={() => setStep("done")}
            />
          ) : null}
          {step === "done" ? (
            <DoneStep
              name={normalizedPreferredName(name)}
              principal={currencies.principal}
              second={currencies.second}
              rate={rateText}
              accountCount={accounts.length}
              saving={saving}
              onFinish={(then) => void finish(then)}
            />
          ) : null}
        </div>
      </main>
    </div>
  )
}

/** OnboardingHeading: the step's large title and its one sentence. */
function Heading({ title, body }: { title: ReactNode; body?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="type-title text-foreground">{title}</h1>
      {body ? (
        <p className="type-body leading-relaxed text-muted-foreground">
          {body}
        </p>
      ) : null}
    </div>
  )
}

/** A row with its icon in a `surface2` circle, as the welcome and privacy lists show them. */
function IconRow({
  icon,
  title,
  body,
}: {
  icon: KWIconName
  title: string
  body?: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
        <KWIcon name={icon} size={20} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="type-body font-semibold text-foreground">{title}</span>
        {body ? (
          <span className="type-caption text-muted-foreground">{body}</span>
        ) : null}
      </span>
    </div>
  )
}

/**
 * Welcome. Phones keep the iOS column (title, three promises, a full-width white button). From `lg`
 * it becomes the split first-run screen desktop web apps use (Mobbin: Perplexity Health, Rox, Maze,
 * Base): the pitch and a normal-width button on the left, a preview of the app bleeding off the
 * right edge, instead of a phone column floating in the middle of a wide window.
 */
function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const t = useT()
  const promises: { icon: KWIconName; title: string }[] = [
    { icon: "personOff", title: t.in("onboarding", "No account or sign-up") },
    { icon: "phone", title: t.in("web", "Stored in this browser") },
    {
      icon: "transfer",
      title: t.in("onboarding", "Any currency, with your own rate"),
    },
  ]
  return (
    <div className="flex min-h-svh bg-background">
      <section className="relative flex min-h-svh w-full flex-col px-(--gutter) py-8 lg:w-[44%] lg:max-w-[40rem] lg:shrink-0 lg:px-14 lg:py-10 xl:px-20">
        <div
          className="pointer-events-none absolute -top-48 left-1/2 size-[32rem] -translate-x-1/2 rounded-full bg-brand-600/15 blur-3xl lg:hidden"
          aria-hidden
        />
        <div className="relative flex items-center gap-2.5">
          <KWLockup height={28} className="text-foreground" />
        </div>
        <div className="relative flex flex-1 flex-col justify-center gap-8 py-10 lg:max-w-md">
          <Heading
            title={t.in(
              "onboarding",
              "Your money, clear, in one or two currencies"
            )}
            body={t.in(
              "onboarding",
              "Log expenses, income and transfers. Cards, cash and drafts to confirm later."
            )}
          />
          <ul className="flex flex-col gap-4">
            {promises.map((promise) => (
              <li key={promise.icon} className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-text-secondary">
                  <KWIcon name={promise.icon} size={16} />
                </span>
                <span className="type-body text-foreground">
                  {promise.title}
                </span>
              </li>
            ))}
          </ul>
          <KWButton
            size="large"
            onClick={onStart}
            autoFocus
            className="w-full lg:w-auto lg:min-w-48 lg:self-start"
          >
            {t.in("onboarding", "Start")}
          </KWButton>
        </div>
        <p className="relative type-caption text-text-faint">
          {t.in(
            "web",
            "Your data lives in this browser. Back it up now and then to keep a copy."
          )}
        </p>
      </section>
      <aside className="hidden flex-1 p-3 lg:block" aria-hidden>
        <div className="relative h-full overflow-hidden rounded-[28px] bg-linear-to-br from-brand-700/45 via-brand-900/40 to-card">
          <div className="pointer-events-none absolute -top-32 -right-32 size-[36rem] rounded-full bg-brand-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-brand-600/20 blur-3xl" />
          <FloatingPieces />
        </div>
      </aside>
    </div>
  )
}

/**
 * Real Keepwell pieces loose on a brand panel (Mobbin: Copilot, Revolut web): the net worth, a card,
 * an expense and a draft, each slightly tilted. Brand rather than a template window, and every piece
 * is something the app really draws.
 */
function FloatingPieces() {
  const t = useT()
  const piece =
    "absolute rounded-2xl bg-card/95 shadow-elevated backdrop-blur-md"
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none">
      <div className="relative h-[26rem] w-[34rem] xl:scale-110">
        <div className={`${piece} top-6 left-0 w-72 -rotate-3 p-5`}>
          <p className="type-label text-text-secondary">
            {t.in("home", "Net worth")}
          </p>
          <p className="type-amount-lg text-foreground tabular-nums">
            $11,157.46
          </p>
        </div>
        <div className="absolute top-0 right-0 w-72 rotate-6">
          <CardArt
            color="azul"
            bank=""
            network="visa"
            lastFour="4321"
            kind="debit"
          />
        </div>
        <div
          className={`${piece} top-52 right-2 flex w-80 rotate-2 items-center gap-3 px-4 py-3`}
        >
          <KWTransactionIcon style="expense" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate type-body font-semibold text-foreground">
              {t.in("widgets", "Groceries")}
            </span>
            <span className="truncate type-caption text-muted-foreground">
              Visa •••• 4321
            </span>
          </span>
          <span
            className={`type-body font-bold tabular-nums ${transactionAmountClass("expense")}`}
          >
            −$86.40
          </span>
        </div>
        <div
          className={`${piece} bottom-0 left-0 flex w-80 -rotate-2 items-center gap-3 px-4 py-3`}
        >
          <KWTransactionIcon style="planned" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate type-body font-semibold text-foreground">
              {t.in("web", "welcome.preview.rent")}
            </span>
            <span className="truncate type-caption text-pending">
              {t.in("createtransaction", "Draft")}
            </span>
          </span>
          <span
            className={`type-body font-bold tabular-nums ${transactionAmountClass("planned")}`}
          >
            −$650.00
          </span>
        </div>
      </div>
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
      toast.add({
        title: t.in(
          "app",
          "Restored %lld accounts and %lld movements",
          summary.accounts,
          summary.transactions
        ),
        type: "success",
      })
      // The shell sees finished settings and opens home.
    } catch {
      setRestoring(false)
      toast.add({
        title: t.in("app", "That file isn't a Keepwell backup."),
        type: "error",
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Heading
        title={t.in("onboarding", "Have you used Keepwell before?")}
        body={t.in(
          "onboarding",
          "Bring your accounts, cards and movements from a backup, or set everything up from scratch."
        )}
      />
      <KWGroupedCard>
        <ChoiceRow
          icon="download"
          title={t.in("onboarding", "Restore from a backup file (.json)")}
          body={t.in(
            "onboarding",
            "A file saved with “Back up now” in Settings"
          )}
          onClick={() => file.current?.click()}
          disabled={restoring}
        />
      </KWGroupedCard>
      <KWButton size="large" fill onClick={onScratch}>
        {t.in("onboarding", "Start from scratch")}
      </KWButton>
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

function ChoiceRow({
  icon,
  title,
  body,
  onClick,
  disabled,
}: {
  icon: KWIconName
  title: string
  body?: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 text-left transition-colors outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50 disabled:opacity-40"
    >
      <span className="min-w-0 flex-1">
        <IconRow icon={icon} title={title} {...(body ? { body } : {})} />
      </span>
      <KWIcon name="chevronRight" size={16} className="mr-4 text-text-faint" />
    </button>
  )
}

function NameStep({
  name,
  onChange,
  onNext,
}: {
  name: string
  onChange: (name: string) => void
  onNext: () => void
}) {
  const t = useT()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onNext()
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Heading
        title={t.in("onboarding", "What's your name?")}
        body={t.in(
          "web",
          "We'll use it to greet you and show it on your cards. It's only stored in this browser."
        )}
      />
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="name">
          {t.in("onboarding", "Your name")}
        </FieldLabel>
        <Input
          id="name"
          value={name}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t.in("onboarding", "Your first name")}
          maxLength={30}
          autoFocus
          autoComplete="given-name"
          className={KW_FIELD}
        />
      </div>
      <div className="flex flex-col gap-2">
        <KWButton type="submit" size="large" fill>
          {t.in("onboarding", "Continue")}
        </KWButton>
        <KWButton
          variant="plain"
          fill
          onClick={() => {
            onChange("")
            onNext()
          }}
        >
          {t.in("onboarding", "Skip")}
        </KWButton>
      </div>
    </form>
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
      <Heading
        title={t.in("onboarding", "Which currencies do you use?")}
        body={t.in(
          "onboarding",
          "Reports and net worth are calculated in the main currency."
        )}
      />
      <KWSegmented
        aria-label={t.in("onboarding", "Currencies")}
        value={props.usesTwo ? "two" : "one"}
        onChange={(value) => props.onUsesTwo(value === "two")}
        options={[
          { value: "one", title: t.in("onboarding", "One currency") },
          { value: "two", title: t.in("onboarding", "Two currencies") },
        ]}
      />
      <div className="flex flex-col gap-4 rounded-2xl bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="principal">
            {t.in("onboarding", "Main currency")}
          </FieldLabel>
          <CurrencyPicker
            id="principal"
            value={props.principal}
            onChange={props.onPrincipal}
          />
        </div>
        {props.usesTwo ? (
          <>
            <div className="flex justify-center">
              <KWButton
                variant="secondary"
                size="small"
                icon="transfer"
                onClick={props.onSwap}
                aria-label={t.in("onboarding", "Swap main and second currency")}
              >
                {t.in("onboarding", "Swap")}
              </KWButton>
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="second">
                {t.in("onboarding", "Second currency")}
              </FieldLabel>
              <CurrencyPicker
                id="second"
                value={props.second}
                onChange={props.onSecond}
                exclude={props.principal}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="rate">
                {t.in("onboarding", "Exchange rate (you set it)")}
              </FieldLabel>
              <div className="flex items-center gap-2">
                <span className="shrink-0 type-label text-text-secondary">
                  1 {props.principal} =
                </span>
                <Input
                  id="rate"
                  inputMode="decimal"
                  value={props.rateText}
                  onChange={(event) => props.onRate(event.target.value)}
                  placeholder="1.0000"
                  className={`${KW_FIELD} tabular-nums`}
                  aria-invalid={rateInvalid}
                />
                <span className="shrink-0 type-label text-text-secondary">
                  {props.second}
                </span>
              </div>
              <p className="px-1 type-caption text-muted-foreground">
                {t.in(
                  "onboarding",
                  "It defaults to 1. Change it whenever you want; each transaction keeps the rate from when you logged it."
                )}
              </p>
              {rateInvalid ? (
                <p className="px-1 type-caption text-negative">
                  {t.in(
                    "settings",
                    "The rate has to be a number greater than zero."
                  )}
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
      <KWButton type="submit" size="large" fill disabled={rateInvalid}>
        {t.in("onboarding", "Continue")}
      </KWButton>
    </form>
  )
}

type AccountKind = OnboardingAccountDraft["kind"]

function accountThumbnail(account: OnboardingAccountDraft) {
  if (account.kind === "cash") return <KWMiniCard kind="cash" />
  return <KWMiniCard color={account.kind === "credit" ? "azul" : "verde"} />
}

function AccountsStep({
  principal,
  second,
  accounts,
  onChange,
  onNext,
}: {
  principal: string
  second: string | undefined
  accounts: OnboardingAccountDraft[]
  onChange: (accounts: OnboardingAccountDraft[]) => void
  onNext: () => void
}) {
  const t = useT()
  const [editing, setEditing] = useState<OnboardingAccountDraft>()
  const currencies = [principal, second].filter(
    (code): code is string => code !== undefined
  )

  const subtitle = (account: OnboardingAccountDraft) => {
    switch (account.kind) {
      case "bank":
        return account.lastFour
          ? t.in(
              "onboarding",
              "Bank · %@ · Debit ··%@",
              account.currency,
              account.lastFour
            )
          : t.in("onboarding", "Bank · %@", account.currency)
      case "credit":
        if (account.debtMode === "dual" && second)
          return t.in("onboarding", "Credit · %@ and %@", second, principal)
        return t.in(
          "onboarding",
          "Credit · %@",
          account.debtMode === "second" && second ? second : principal
        )
      case "cash":
        return t.in("onboarding", "Cash")
    }
  }
  const balance = (account: OnboardingAccountDraft) => {
    if (account.kind !== "credit")
      return formatAmount(account.balance, account.currency)
    if (account.debtMode === "dual" && second)
      return `${formatAmount(account.balance.neg(), principal)} · ${formatAmount(account.secondBalance.neg(), second)}`
    return formatAmount(
      account.balance.neg(),
      account.debtMode === "second" && second ? second : principal
    )
  }
  const start = (kind: AccountKind) =>
    setEditing({
      id: newID(),
      kind,
      name: kind === "cash" ? t.in("onboarding", "Cash") : "",
      currency:
        kind === "cash"
          ? (currencies.find(
              (code) =>
                !accounts.some((a) => a.kind === "cash" && a.currency === code)
            ) ?? principal)
          : principal,
      balance: ZERO,
      secondBalance: ZERO,
      ...(kind === "credit"
        ? {
            debtMode: (second ? "dual" : "principal") as DebtMode,
            network: "visa" as CardNetwork,
          }
        : {}),
    })

  return (
    <div className="flex flex-col gap-6">
      <Heading
        title={t.in("onboarding", "Add your accounts")}
        body={t.in(
          "onboarding",
          "With today's balance. Credit cards start with what you owe."
        )}
      />
      <div className="grid grid-cols-3 gap-2">
        <KindTile
          icon="bank"
          label={t.in("onboarding", "Bank")}
          onClick={() => start("bank")}
        />
        <KindTile
          icon="creditCard"
          label={t.in("onboarding", "Credit card")}
          onClick={() => start("credit")}
        />
        <KindTile
          icon="cash"
          label={t.in("onboarding", "Cash")}
          onClick={() => start("cash")}
        />
      </div>
      {accounts.length > 0 ? (
        <KWGroupedCard>
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center gap-2 pr-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50"
                onClick={() => setEditing(account)}
              >
                {accountThumbnail(account)}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate type-body font-semibold text-foreground">
                    {onboardingDisplayName(account) ||
                      t.in("onboarding", "Account")}
                  </span>
                  <span className="truncate type-caption-sm text-muted-foreground">
                    {subtitle(account)}
                  </span>
                </span>
                <span className="shrink-0 type-label text-foreground tabular-nums">
                  {balance(account)}
                </span>
              </button>
              <KWCircleButton
                icon="trash"
                size={32}
                label={t.in("onboarding", "Remove account")}
                onClick={() =>
                  onChange(accounts.filter((other) => other.id !== account.id))
                }
              />
            </div>
          ))}
        </KWGroupedCard>
      ) : null}
      <KWButton size="large" fill onClick={onNext}>
        {t.in("onboarding", "Continue")}
      </KWButton>
      {editing ? (
        <AccountForm
          draft={editing}
          isNew={!accounts.some((account) => account.id === editing.id)}
          currencies={
            editing.kind === "cash"
              ? currencies.filter(
                  (code) =>
                    code === editing.currency ||
                    !accounts.some(
                      (a) =>
                        a.kind === "cash" &&
                        a.id !== editing.id &&
                        a.currency === code
                    )
                )
              : currencies
          }
          principal={principal}
          second={second}
          onCancel={() => setEditing(undefined)}
          onRemove={() => {
            onChange(accounts.filter((account) => account.id !== editing.id))
            setEditing(undefined)
          }}
          onSave={(saved) => {
            onChange(
              accounts.some((account) => account.id === saved.id)
                ? accounts.map((account) =>
                    account.id === saved.id ? saved : account
                  )
                : [...accounts, saved]
            )
            setEditing(undefined)
          }}
        />
      ) : null}
    </div>
  )
}

function KindTile({
  icon,
  label,
  onClick,
}: {
  icon: KWIconName
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-24 flex-col items-center justify-center gap-2 rounded-[18px] bg-card px-3 text-foreground transition-colors outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
    >
      <KWIcon name={icon} size={24} />
      <span className="type-label">{label}</span>
    </button>
  )
}

function DoneStep({
  name,
  principal,
  second,
  rate,
  accountCount,
  saving,
  onFinish,
}: {
  name: string | undefined
  principal: string
  second: string | undefined
  rate: string
  accountCount: number
  saving: boolean
  onFinish: (then: "home" | "expense") => void
}) {
  const t = useT()
  return (
    <div className="flex flex-col gap-6">
      <span className="flex size-16 items-center justify-center rounded-full bg-positive text-positive-foreground">
        <KWIcon name="check" size={30} strokeWidth={2.8} />
      </span>
      <Heading
        title={
          name
            ? t.in("onboarding", "All set, %@", name)
            : t.in("onboarding", "All set")
        }
        body={t.in(
          "onboarding",
          "Now log your first transaction. The more you record, the better your monthly summary."
        )}
      />
      <KWGroupedCard>
        <KWValueRow
          label={t.in("onboarding", "Currencies")}
          value={second ? `${principal} · ${second}` : principal}
        />
        {second ? (
          <KWValueRow
            label={t.in("onboarding", "Rate")}
            value={
              <span className="tabular-nums">{`1 ${principal} = ${rate} ${second}`}</span>
            }
          />
        ) : null}
        <KWValueRow
          label={t.in("onboarding", "Accounts")}
          value={String(accountCount)}
        />
      </KWGroupedCard>
      <div className="flex flex-col gap-2">
        <KWButton
          size="large"
          fill
          disabled={saving}
          onClick={() => onFinish("expense")}
          autoFocus
        >
          {t.in("onboarding", "Log first expense")}
        </KWButton>
        <KWButton
          variant="plain"
          fill
          disabled={saving}
          onClick={() => onFinish("home")}
        >
          {t.in("onboarding", "Go to home")}
        </KWButton>
      </div>
    </div>
  )
}
