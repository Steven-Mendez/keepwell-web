"use client"

import { COMMON_CURRENCIES } from "@/components/kw/currencies"
import { transactionAmountClass } from "@/components/kw/design-styles"
import { newID } from "@/lib/platform/uuid"

import { useRouter } from "next/navigation"
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"

import { SignInOptions } from "@/components/login/sign-in-options"
import { Spinner } from "@/components/ui/spinner"
import { useAccount } from "@/hooks/use-account"
import { signOut } from "@/lib/api/account"
import { restoreFromAccountResult } from "@/lib/sync/restore"
import { httpTransport } from "@/lib/sync/transport"

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
import { ledgerStore, profileStore } from "@/lib/repositories"
import type { CardNetwork, DebtMode } from "@/lib/schema"

import { AccountForm } from "./account-form"

type Step = "welcome" | "name" | "currencies" | "accounts" | "done"
const STEPS: readonly Step[] = [
  "welcome",
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
 * Onboarding (iOS OnboardingFlowView). The welcome asks first for an existing Keepwell account: one
 * that already has data brings it down and onboarding ends (AppShell sees the finished settings and
 * leaves for "/"). A new or empty account, or none at all ("Use without an account", everything in
 * this browser), goes on to name, currencies and accounts.
 * Drawn with the iOS flow parts (KWFlowHeader with back and step progress, large titles, the white
 * primary button) in a centered column sized for a desktop window.
 */
export function OnboardingFlow() {
  const t = useT()
  const router = useRouter()
  const { state: account, refresh: refreshAccount } = useAccount()
  const me = account.status === "signed-in" ? account.me : undefined
  const [step, setStep] = useState<Step>("welcome")
  // The account whose data was already looked for (and had nothing finished to bring back).
  const [restoredUser, setRestoredUser] = useState<string>()
  // The account's data couldn't be loaded (offline, server error): the welcome says so and retries.
  const [restoreFailed, setRestoreFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const restoring = me !== undefined && restoredUser !== me.user.id && !restoreFailed
  const restoredFor = useRef<string>(undefined)
  const [name, setName] = useState("")
  // Nothing syncs during the setup: the account's settings (finished on another device) would end
  // it halfway. Once it's saved, AppShell's sync uploads the result.

  // Signed in on the welcome (a passkey here, or back from Apple): look for the account's data once.
  useEffect(() => {
    if (step !== "welcome" || !me || restoredFor.current === me.user.id) return
    restoredFor.current = me.user.id
    const userId = me.user.id
    // The greeting's name: the first one of the account's ("Ana" from "Ana López").
    const accountName = normalizedPreferredName(me.user.name.trim().split(/\s+/)[0])
    setRestoreFailed(false)
    void restoreFromAccountResult(me, httpTransport).then((result) => {
      // Never drop into onboarding because the account couldn't be read: that would hide data.
      if (result === "failed") {
        setRestoreFailed(true)
        return
      }
      // The account's data came down: AppShell takes over and opens Home. The greeting's name is
      // this device's, so it starts from the account's here too.
      if (result === "restored") {
        if (accountName && !profileStore.preferredName()) profileStore.setPreferredName(accountName)
        return
      }
      setRestoredUser(userId)
      // The setup runs in full, starting from the account's name when it has one.
      if (accountName) setName((current) => current || accountName)
      setStep("name")
    })
  }, [step, me, attempt])

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
    return (
      <WelcomeScreen
        account={account.status}
        signedInAs={me ? me.user.name || me.user.email : undefined}
        restoring={restoring}
        restoreFailed={restoreFailed}
        onRetry={() => {
          restoredFor.current = undefined
          setRestoreFailed(false)
          setAttempt((n) => n + 1)
        }}
        onSignOut={() => {
          // Signing back in (even as the same account) must try the restore again, not show the old failure.
          restoredFor.current = undefined
          setRestoreFailed(false)
          void signOut().then(refreshAccount, refreshAccount)
        }}
        onPasskeySignedIn={refreshAccount}
        onUseLocally={() => setStep("name")}
      />
    )

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
              <KWLockup height={28} className="text-logo" />
            </div>
          ) : (
            <FlowHeader
              leading="back"
              onLeading={() => setStep(STEPS[index - 1] as Step)}
              progress={{ total: STEPS.length - 2, current: index }}
            />
          )}
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

/**
 * Welcome, and the one decision before setup: an existing Keepwell account or none. Sign-in comes
 * first, right here (Mobbin: Monarch, Wise, Fuse put Apple on the welcome itself), and the local path
 * sits under it as a real choice with what it means (Buddy's "Continue Anonymous"), not a default.
 * Phones keep the iOS column. From `lg` it becomes the split first-run screen desktop web apps use
 * (Mobbin: Perplexity Health, Rox, Maze, Base): the pitch and the choice on the left, a preview of the
 * app bleeding off the right edge.
 */
function WelcomeScreen({
  account,
  signedInAs,
  restoring,
  restoreFailed,
  onRetry,
  onSignOut,
  onPasskeySignedIn,
  onUseLocally,
}: {
  account: "unavailable" | "loading" | "signed-out" | "signed-in" | "error"
  signedInAs: string | undefined
  restoring: boolean
  restoreFailed: boolean
  onRetry: () => void
  onSignOut: () => void
  onPasskeySignedIn: () => void
  onUseLocally: () => void
}) {
  const t = useT()
  // Builds without the Keepwell API (or with it down) can only be used locally: a plain start.
  const offersAccount = account !== "unavailable" && account !== "error"
  const promises: { icon: KWIconName; title: string }[] = [
    offersAccount
      ? { icon: "cloud", title: t.in("web", "Synced with Keepwell for iPhone") }
      : { icon: "phone", title: t.in("web", "Stored in this browser") },
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
          <KWLockup height={28} className="text-logo" />
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
          {offersAccount ? (
            <WelcomeChoice
              signedInAs={signedInAs}
              restoring={restoring}
              restoreFailed={restoreFailed}
              onRetry={onRetry}
              onSignOut={onSignOut}
              busy={restoring || account === "loading"}
              onPasskeySignedIn={onPasskeySignedIn}
              onUseLocally={onUseLocally}
            />
          ) : (
            <KWButton
              size="large"
              onClick={onUseLocally}
              autoFocus
              className="w-full lg:w-auto lg:min-w-48 lg:self-start"
            >
              {t.in("onboarding", "Start")}
            </KWButton>
          )}
        </div>
        {offersAccount ? null : (
          <p className="relative type-caption text-text-faint">
            {t.in(
              "web",
              "Your data lives in this browser. Export a CSV now and then to keep a copy."
            )}
          </p>
        )}
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
 * Sign in to an existing account first; under an "or", Keepwell without an account and what that
 * means. While signed in and the account's data comes down, the choice gives way to the wait.
 */
function WelcomeChoice({
  signedInAs,
  restoring,
  restoreFailed,
  onRetry,
  onSignOut,
  busy,
  onPasskeySignedIn,
  onUseLocally,
}: {
  signedInAs: string | undefined
  restoring: boolean
  restoreFailed: boolean
  onRetry: () => void
  onSignOut: () => void
  busy: boolean
  onPasskeySignedIn: () => void
  onUseLocally: () => void
}) {
  const t = useT()
  if (signedInAs)
    return (
      <div
        className="flex flex-col items-center gap-3 rounded-2xl bg-card px-4 py-5 text-center lg:items-start lg:text-left"
        aria-live="polite"
      >
        <span className="type-caption text-muted-foreground">
          {t.in("web", "Signed in as %@", signedInAs)}
        </span>
        {restoring ? (
          <span className="inline-flex items-center gap-2 type-body text-foreground">
            <Spinner className="size-4 text-muted-foreground" />
            {t.in("web", "Looking for your data…")}
          </span>
        ) : restoreFailed ? (
          <>
            <p role="alert" className="type-body text-foreground">
              {t.in("web", "Couldn't load your data. Check your connection and try again.")}
            </p>
            <KWButton fill onClick={onRetry}>
              {t.in("web", "Try again")}
            </KWButton>
            <KWButton fill variant="surface" onClick={onUseLocally}>
              {t.in("web", "Use without an account")}
            </KWButton>
            <KWButton variant="plain" size="regular" onClick={onSignOut}>
              {t.in("web", "Sign out")}
            </KWButton>
          </>
        ) : (
          <KWButton fill onClick={onUseLocally}>
            {t.in("onboarding", "Continue")}
          </KWButton>
        )}
      </div>
    )
  return (
    <div className="flex w-full flex-col gap-4 lg:max-w-sm">
      <div className="flex flex-col gap-1">
        <h2 className="type-heading text-foreground">
          {t.in("web", "Already use Keepwell?")}
        </h2>
        <p className="type-caption text-muted-foreground">
          {t.in(
            "web",
            "Sign in and your accounts and movements come back as they were."
          )}
        </p>
      </div>
      <SignInOptions
        returnPath="/welcome"
        disabled={busy}
        onPasskeySignedIn={onPasskeySignedIn}
      />
      <div
        className="flex items-center gap-3 type-caption text-muted-foreground"
        aria-hidden
      >
        <span className="h-px flex-1 bg-border" />
        {t.in("web", "or")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-col gap-1.5">
        <KWButton
          fill
          variant="surface"
          disabled={busy}
          onClick={onUseLocally}
        >
          {t.in("web", "Use without an account")}
        </KWButton>
        <p className="text-center type-caption-sm text-muted-foreground">
          {t.in(
            "web",
            "Everything stays only in this browser. You can sign in later from Settings."
          )}
        </p>
      </div>
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
              <p className="type-caption text-muted-foreground">
                {t.in(
                  "onboarding",
                  "It defaults to 1. Change it whenever you want; each transaction keeps the rate from when you logged it."
                )}
              </p>
              {rateInvalid ? (
                <p className="type-caption text-negative">
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
