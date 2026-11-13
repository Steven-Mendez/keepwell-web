"use client"

import { NETWORKS, digitsOnly, domainErrorText } from "./form-helpers"
import { kwButtonClass } from "@/components/kw/design-styles"
import { useState, type FormEvent, type ReactNode } from "react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { KWButton } from "@/components/kw/design"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { OptionSelect } from "@/components/kw/pickers"
import { toast } from "@/components/ui/toast"
import {
  cardExpiry,
  deleteAccount,
  renameAccount,
  setCardDetails,
  setCardNumber,
  updateCreditTerms,
} from "@/lib/domain"
import {
  formatNumber,
  parseAmount,
} from "@/lib/domain/format"
import { useT } from "@/lib/i18n"
import type { Account, Card, CardNetwork } from "@/lib/schema"
import { networkName } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"

import { AmountInput, KW_INPUT, LabeledField } from "./form-parts"

/** A small edit dialog: the fields, then Save. `onSubmit` throws to keep it open. */
function EditDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  onSubmit: () => Promise<boolean>
}) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      if (await onSubmit()) onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-2xl bg-nav p-6 ring-divider sm:max-w-md">
        <form
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle className="type-heading text-foreground">
              {title}
            </DialogTitle>
            {description ? (
              <DialogDescription className="type-body text-muted-foreground">
                {description}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="flex flex-col gap-4">{children}</div>
          <DialogFooter className="-mx-6 -mb-6 rounded-b-2xl border-divider bg-transparent px-6 pb-6">
            <KWButton
              type="button"
              variant="plain"
              onClick={() => onOpenChange(false)}
            >
              {t.in("web", "Cancel")}
            </KWButton>
            <KWButton type="submit" disabled={busy}>
              {t.in("creditcard", "Save")}
            </KWButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const failed = (message: string) => toast.add({ title: message, type: "error" })

export function RenameDialog({
  account,
  open,
  onOpenChange,
}: {
  account: Account
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const isCard = account.kind === "credit"
  const [name, setName] = useState(account.name)
  const [error, setError] = useState<string>()
  return (
    <EditDialog
      open={open}
      onOpenChange={(next) => {
        if (next) setName(account.name)
        setError(undefined)
        onOpenChange(next)
      }}
      title={t.in(isCard ? "creditcard" : "accounts", "Edit name")}
      description={t.in(
        "sharedpresentation",
        "Every card on this account shows this name."
      )}
      onSubmit={async () => {
        if (name.trim() === "") {
          setError(
            t.in(
              isCard ? "creditcard" : "accounts",
              isCard
                ? "Write a name for the card."
                : "Write a name for the account."
            )
          )
          return false
        }
        try {
          await renameAccount(ledgerStore, account.id, name)
          return true
        } catch {
          failed(t.in("accounts", "We couldn't save the change. Try again."))
          return false
        }
      }}
    >
      <LabeledField
        id="account-name"
        label={t.in("sharedpresentation", "Account name")}
        error={error}
      >
        <Input
          className={KW_INPUT}
          id="account-name"
          value={name}
          maxLength={40}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          aria-invalid={error ? true : undefined}
        />
      </LabeledField>
    </EditDialog>
  )
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)

export function ProductExpiryDialog({
  card,
  open,
  onOpenChange,
}: {
  card: Card
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 16 }, (_, index) => thisYear - 3 + index)
  const [product, setProduct] = useState(card.productName ?? "")
  const [month, setMonth] = useState(
    card.expiry ? String(card.expiry.month) : ""
  )
  const [year, setYear] = useState(card.expiry ? String(card.expiry.year) : "")
  const [error, setError] = useState<string>()
  return (
    <EditDialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setProduct(card.productName ?? "")
          setMonth(card.expiry ? String(card.expiry.month) : "")
          setYear(card.expiry ? String(card.expiry.year) : "")
        }
        setError(undefined)
        onOpenChange(next)
      }}
      title={t.in("sharedpresentation", "Product and expiry")}
      description={t.in(
        "sharedpresentation",
        "As printed on the card. We remind you a month before it expires, with what's charged to it."
      )}
      onSubmit={async () => {
        if ((month === "") !== (year === "")) {
          setError(
            t.in("sharedpresentation", "Choose both the month and the year.")
          )
          return false
        }
        try {
          const expiry =
            month && year ? cardExpiry(Number(month), Number(year)) : undefined
          await setCardDetails(ledgerStore, card.id, product, expiry)
          return true
        } catch (thrown) {
          setError(
            domainErrorText(
              t,
              thrown,
              t.in("accounts", "We couldn't save the change. Try again.")
            )
          )
          return false
        }
      }}
    >
      <LabeledField
        id="card-product"
        label={t.in("sharedpresentation", "Product name (e.g. Platinum)")}
      >
        <Input
          className={KW_INPUT}
          id="card-product"
          value={product}
          maxLength={30}
          onChange={(event) => setProduct(event.target.value)}
        />
      </LabeledField>
      <div className="grid grid-cols-2 gap-3">
        <LabeledField
          id="card-month"
          label={t.in("sharedpresentation", "Expiry month")}
        >
          <OptionSelect
            id="card-month"
            value={month}
            onChange={setMonth}
            options={[
              { value: "", label: t.in("sharedpresentation", "Not set") },
              ...MONTHS.map((value) => ({
                value: String(value),
                label: `${String(value).padStart(2, "0")} · ${new Date(2000, value - 1, 1).toLocaleDateString(t.locale, { month: "long" })}`,
              })),
            ]}
          />
        </LabeledField>
        <LabeledField
          id="card-year"
          label={t.in("sharedpresentation", "Expiry year")}
        >
          <OptionSelect
            id="card-year"
            value={year}
            onChange={setYear}
            options={[
              { value: "", label: t.in("sharedpresentation", "Not set") },
              ...years.map((value) => ({
                value: String(value),
                label: String(value),
              })),
            ]}
          />
        </LabeledField>
      </div>
      {error ? (
        <p role="alert" className="type-caption text-negative">
          {error}
        </p>
      ) : null}
    </EditDialog>
  )
}

export function CardNumberDialog({
  card,
  open,
  onOpenChange,
}: {
  card: Card
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const [digits, setDigits] = useState(card.lastFour ?? "")
  const [network, setNetwork] = useState<CardNetwork | "">(card.network ?? "")
  const [error, setError] = useState<string>()
  return (
    <EditDialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDigits(card.lastFour ?? "")
          setNetwork(card.network ?? "")
        }
        setError(undefined)
        onOpenChange(next)
      }}
      title={t.in("sharedpresentation", "Card number")}
      description={t.in(
        "sharedpresentation",
        "We never ask for the full number or the CVV."
      )}
      onSubmit={async () => {
        // As iOS CardNumberSheet: a credit card keeps its 4 digits; a debit card may clear them.
        if (digits.length !== 4 && (card.kind === "creditHolder" || digits !== "")) {
          setError(t.in("sharedpresentation", "Enter the last 4 digits."))
          return false
        }
        try {
          await setCardNumber(
            ledgerStore,
            card.id,
            digits === "" ? undefined : digits,
            network === "" ? undefined : network
          )
          return true
        } catch (thrown) {
          setError(
            domainErrorText(
              t,
              thrown,
              t.in("accounts", "We couldn't save the change. Try again.")
            )
          )
          return false
        }
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <LabeledField
          id="card-digits"
          label={t.in("sharedpresentation", "Last 4 digits")}
          error={error}
        >
          <Input
            id="card-digits"
            inputMode="numeric"
            className={`${KW_INPUT} tracking-widest tabular-nums`}
            placeholder="0000"
            value={digits}
            autoFocus
            onChange={(event) => setDigits(digitsOnly(event.target.value))}
          />
        </LabeledField>
        <LabeledField id="card-network" label={t.in("addcard", "Network")}>
          <OptionSelect<CardNetwork | "">
            id="card-network"
            value={network}
            onChange={setNetwork}
            options={[
              { value: "", label: t.in("addcard", "Not set") },
              ...NETWORKS.map((value) => ({
                value,
                label: networkName(t, value),
              })),
            ]}
          />
        </LabeledField>
      </div>
    </EditDialog>
  )
}

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1)

export function DaySelect({
  id,
  value,
  onChange,
  notSetLabel,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  notSetLabel: string
}) {
  const t = useT()
  return (
    <OptionSelect
      id={id}
      value={value}
      onChange={onChange}
      options={[
        { value: "", label: notSetLabel },
        ...DAYS.map((day) => ({
          value: String(day),
          label: t.in("creditcard", "Day %lld", day),
        })),
      ]}
    />
  )
}

export function CreditTermsDialog({
  account,
  limitCurrency,
  open,
  onOpenChange,
}: {
  account: Account
  limitCurrency: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const terms = account.creditTerms
  const initial = () => ({
    limit: terms?.limit ? formatNumber(terms.limit.amount) : "",
    cutoff: terms?.cutoffDay ? String(terms.cutoffDay) : "",
    due: terms?.dueDay ? String(terms.dueDay) : "",
  })
  const [form, setForm] = useState(initial)
  const [error, setError] = useState<string>()
  return (
    <EditDialog
      open={open}
      onOpenChange={(next) => {
        if (next) setForm(initial())
        setError(undefined)
        onOpenChange(next)
      }}
      title={t.in("creditcard", "sheet.cardDetails")}
      description={t.in(
        "creditcard",
        "The cutoff day closes each cycle, and with the payment day we remind you before it's due."
      )}
      onSubmit={async () => {
        const limit =
          form.limit.trim() === "" ? undefined : parseAmount(form.limit)
        if ((form.limit.trim() !== "" && !limit) || (limit && limit.lte(0))) {
          setError(t.in("creditcard", "Check the credit limit."))
          return false
        }
        try {
          await updateCreditTerms(
            ledgerStore,
            account.id,
            limit
              ? {
                  amount: limit,
                  currency: terms?.limit?.currency ?? limitCurrency,
                }
              : undefined,
            form.cutoff ? Number(form.cutoff) : undefined,
            form.due ? Number(form.due) : undefined
          )
          return true
        } catch {
          failed(t.in("creditcard", "We couldn't save the change. Try again."))
          return false
        }
      }}
    >
      <LabeledField
        id="credit-limit"
        label={t.in(
          "creditcard",
          "Credit limit (%@)",
          terms?.limit?.currency ?? limitCurrency
        )}
        description={t.in("creditcard", "Optional")}
        error={error}
      >
        <AmountInput
          id="credit-limit"
          currency={terms?.limit?.currency ?? limitCurrency}
          value={form.limit}
          invalid={error !== undefined}
          onChange={(limit) => setForm({ ...form, limit })}
        />
      </LabeledField>
      <div className="grid grid-cols-2 gap-3">
        <LabeledField
          id="credit-cutoff"
          label={t.in("creditcard", "Cutoff day")}
        >
          <DaySelect
            id="credit-cutoff"
            value={form.cutoff}
            notSetLabel={t.in("creditcard", "Not set")}
            onChange={(cutoff) => setForm({ ...form, cutoff })}
          />
        </LabeledField>
        <LabeledField id="credit-due" label={t.in("creditcard", "Payment day")}>
          <DaySelect
            id="credit-due"
            value={form.due}
            notSetLabel={t.in("creditcard", "Not set")}
            onChange={(due) => setForm({ ...form, due })}
          />
        </LabeledField>
      </div>
    </EditDialog>
  )
}

/** "Delete account": the iOS cascade, with how many movements go with it. */
export function DeleteAccountDialog({
  account,
  displayName,
  movementCount,
  open,
  onOpenChange,
  onDeleted,
  onCloseInstead,
}: {
  account: Account
  displayName: string
  movementCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
  /** Offered when the account has a history worth keeping and is still open. */
  onCloseInstead?: () => void
}) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const closeInstead = onCloseInstead && movementCount > 0 && !account.closedAt ? onCloseInstead : undefined
  const message =
    movementCount === 0
      ? t.in(
          "accounts",
          "The account and its card are deleted. This can't be undone."
        )
      : t.in(
          "accounts",
          "The account, its card and its %lld movements are deleted, including transfers with your other accounts, so their balances change too. This can't be undone.",
          movementCount
        )
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl bg-nav p-6 ring-divider">
        <AlertDialogHeader>
          <AlertDialogTitle className="type-heading text-foreground">
            {t.in("accounts", "Delete %@?", displayName)}
          </AlertDialogTitle>
          <AlertDialogDescription className="type-body text-muted-foreground">
            {message}
            {closeInstead ? (
              <>
                {" "}
                {t.in("sharedpresentation", "To keep its history, close it instead.")}
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="-mx-6 -mb-6 rounded-b-2xl border-divider bg-transparent px-6 pb-6">
          <AlertDialogCancel
            render={
              <button
                type="button"
                className={kwButtonClass({ variant: "plain", size: "regular" })}
              />
            }
          >
            {t.in("web", "Cancel")}
          </AlertDialogCancel>
          {closeInstead ? (
            <KWButton
              variant="secondary"
              onClick={() => {
                onOpenChange(false)
                closeInstead()
              }}
            >
              {t.in("sharedpresentation", "Close instead")}
            </KWButton>
          ) : null}
          <KWButton
            variant="destructive"
            icon="trash"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              deleteAccount(ledgerStore, account.id)
                .then(() => {
                  onOpenChange(false)
                  onDeleted()
                })
                .catch(() =>
                  failed(
                    t.in("accounts", "We couldn't save the change. Try again.")
                  )
                )
                .finally(() => setBusy(false))
            }}
          >
            {t.in("accounts", "Delete account")}
          </KWButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
