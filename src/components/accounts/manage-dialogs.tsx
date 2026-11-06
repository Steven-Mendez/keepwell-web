"use client"

import { useState, type FormEvent, type ReactNode } from "react"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { toast } from "@/components/ui/toast"
import { cardExpiry, deleteAccount, formatNumber, parseAmount, renameAccount, setCardDetails, setCardNumber, updateCreditTerms } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import type { Account, Card, CardNetwork } from "@/lib/schema"
import { networkName } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"

import { AmountInput, LabeledField, NETWORKS, digitsOnly, domainErrorText } from "./form-parts"

/** A small edit dialog: the fields, then Save. `onSubmit` throws to keep it open. */
function EditDialog({ open, onOpenChange, title, description, children, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode; onSubmit: () => Promise<boolean> }) {
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
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div className="flex flex-col gap-4">{children}</div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t.in("web", "Cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {t.in("creditcard", "Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const failed = (message: string) => toast.add({ title: message, type: "error" })

export function RenameDialog({ account, open, onOpenChange }: { account: Account; open: boolean; onOpenChange: (open: boolean) => void }) {
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
      description={t.in("sharedpresentation", "Every card on this account shows this name.")}
      onSubmit={async () => {
        if (name.trim() === "") {
          setError(t.in(isCard ? "creditcard" : "accounts", isCard ? "Write a name for the card." : "Write a name for the account."))
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
      <LabeledField id="account-name" label={t.in("sharedpresentation", "Account name")} error={error}>
        <Input id="account-name" value={name} maxLength={40} autoFocus onChange={(event) => setName(event.target.value)} aria-invalid={error ? true : undefined} />
      </LabeledField>
    </EditDialog>
  )
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)

export function ProductExpiryDialog({ card, open, onOpenChange }: { card: Card; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT()
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 16 }, (_, index) => thisYear - 3 + index)
  const [product, setProduct] = useState(card.productName ?? "")
  const [month, setMonth] = useState(card.expiry ? String(card.expiry.month) : "")
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
      description={t.in("sharedpresentation", "As printed on the card. We remind you a month before it expires, with what's charged to it.")}
      onSubmit={async () => {
        if ((month === "") !== (year === "")) {
          setError(t.in("sharedpresentation", "Choose both the month and the year."))
          return false
        }
        try {
          const expiry = month && year ? cardExpiry(Number(month), Number(year)) : undefined
          await setCardDetails(ledgerStore, card.id, product, expiry)
          return true
        } catch (thrown) {
          setError(domainErrorText(t, thrown, t.in("accounts", "We couldn't save the change. Try again.")))
          return false
        }
      }}
    >
      <LabeledField id="card-product" label={t.in("sharedpresentation", "Product name (e.g. Platinum)")}>
        <Input id="card-product" value={product} maxLength={30} onChange={(event) => setProduct(event.target.value)} />
      </LabeledField>
      <div className="grid grid-cols-2 gap-3">
        <LabeledField id="card-month" label={t.in("sharedpresentation", "Expiry month")}>
          <NativeSelect id="card-month" className="w-full" value={month} onChange={(event) => setMonth(event.target.value)}>
            <NativeSelectOption value="">{t.in("sharedpresentation", "Not set")}</NativeSelectOption>
            {MONTHS.map((value) => (
              <NativeSelectOption key={value} value={String(value)}>
                {String(value).padStart(2, "0")} · {new Date(2000, value - 1, 1).toLocaleDateString(t.locale, { month: "long" })}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </LabeledField>
        <LabeledField id="card-year" label={t.in("sharedpresentation", "Expiry year")}>
          <NativeSelect id="card-year" className="w-full" value={year} onChange={(event) => setYear(event.target.value)}>
            <NativeSelectOption value="">{t.in("sharedpresentation", "Not set")}</NativeSelectOption>
            {years.map((value) => (
              <NativeSelectOption key={value} value={String(value)}>
                {value}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </LabeledField>
      </div>
      {error ? (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      ) : null}
    </EditDialog>
  )
}

export function CardNumberDialog({ card, open, onOpenChange }: { card: Card; open: boolean; onOpenChange: (open: boolean) => void }) {
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
      title={t.in("web", "Card number")}
      description={t.in("addcard", "We never ask for the full number or the CVV.")}
      onSubmit={async () => {
        try {
          await setCardNumber(ledgerStore, card.id, digits === "" ? undefined : digits, network === "" ? undefined : network)
          return true
        } catch (thrown) {
          setError(domainErrorText(t, thrown, t.in("accounts", "We couldn't save the change. Try again.")))
          return false
        }
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <LabeledField id="card-digits" label={t.in("addcard", "Last 4 digits")} error={error}>
          <Input id="card-digits" inputMode="numeric" className="tracking-widest tabular-nums" placeholder="0000" value={digits} autoFocus onChange={(event) => setDigits(digitsOnly(event.target.value))} />
        </LabeledField>
        <LabeledField id="card-network" label={t.in("addcard", "Network")}>
          <NativeSelect id="card-network" className="w-full" value={network} onChange={(event) => setNetwork(event.target.value as CardNetwork | "")}>
            <NativeSelectOption value="">{t.in("addcard", "Not set")}</NativeSelectOption>
            {NETWORKS.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {networkName(t, value)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </LabeledField>
      </div>
    </EditDialog>
  )
}

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1)

export function DaySelect({ id, value, onChange, notSetLabel }: { id: string; value: string; onChange: (value: string) => void; notSetLabel: string }) {
  const t = useT()
  return (
    <NativeSelect id={id} className="w-full" value={value} onChange={(event) => onChange(event.target.value)}>
      <NativeSelectOption value="">{notSetLabel}</NativeSelectOption>
      {DAYS.map((day) => (
        <NativeSelectOption key={day} value={String(day)}>
          {t.in("creditcard", "Day %lld", day)}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}

export function CreditTermsDialog({ account, limitCurrency, open, onOpenChange }: { account: Account; limitCurrency: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT()
  const terms = account.creditTerms
  const initial = () => ({ limit: terms?.limit ? formatNumber(terms.limit.amount) : "", cutoff: terms?.cutoffDay ? String(terms.cutoffDay) : "", due: terms?.dueDay ? String(terms.dueDay) : "" })
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
      description={t.in("creditcard", "The cutoff day closes each cycle, and with the payment day we remind you before it's due.")}
      onSubmit={async () => {
        const limit = form.limit.trim() === "" ? undefined : parseAmount(form.limit)
        if ((form.limit.trim() !== "" && !limit) || (limit && limit.lte(0))) {
          setError(t.in("creditcard", "Check the credit limit."))
          return false
        }
        try {
          await updateCreditTerms(ledgerStore, account.id, limit ? { amount: limit, currency: terms?.limit?.currency ?? limitCurrency } : undefined, form.cutoff ? Number(form.cutoff) : undefined, form.due ? Number(form.due) : undefined)
          return true
        } catch {
          failed(t.in("creditcard", "We couldn't save the change. Try again."))
          return false
        }
      }}
    >
      <LabeledField id="credit-limit" label={t.in("creditcard", "Credit limit (%@)", terms?.limit?.currency ?? limitCurrency)} description={t.in("creditcard", "Optional")} error={error}>
        <AmountInput id="credit-limit" currency={terms?.limit?.currency ?? limitCurrency} value={form.limit} invalid={error !== undefined} onChange={(limit) => setForm({ ...form, limit })} />
      </LabeledField>
      <div className="grid grid-cols-2 gap-3">
        <LabeledField id="credit-cutoff" label={t.in("creditcard", "Cutoff day")}>
          <DaySelect id="credit-cutoff" value={form.cutoff} notSetLabel={t.in("creditcard", "Not set")} onChange={(cutoff) => setForm({ ...form, cutoff })} />
        </LabeledField>
        <LabeledField id="credit-due" label={t.in("creditcard", "Payment day")}>
          <DaySelect id="credit-due" value={form.due} notSetLabel={t.in("creditcard", "Not set")} onChange={(due) => setForm({ ...form, due })} />
        </LabeledField>
      </div>
    </EditDialog>
  )
}

/** "Delete account": the iOS cascade, with how many movements go with it. */
export function DeleteAccountDialog({ account, displayName, movementCount, open, onOpenChange, onDeleted }: { account: Account; displayName: string; movementCount: number; open: boolean; onOpenChange: (open: boolean) => void; onDeleted: () => void }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const message =
    movementCount === 0
      ? t.in("accounts", "The account and its card are deleted. This can't be undone.")
      : t.in("accounts", "The account, its card and its %lld movements are deleted, including transfers with your other accounts, so their balances change too. This can't be undone.", movementCount)
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.in("accounts", "Delete %@?", displayName)}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.in("web", "Cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              deleteAccount(ledgerStore, account.id)
                .then(() => {
                  onOpenChange(false)
                  onDeleted()
                })
                .catch(() => failed(t.in("accounts", "We couldn't save the change. Try again.")))
                .finally(() => setBusy(false))
            }}
          >
            {t.in("accounts", "Delete account")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
