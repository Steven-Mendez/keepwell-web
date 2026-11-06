"use client"

import { BanknoteIcon, ChevronRightIcon, CreditCardIcon, PencilIcon, ReceiptIcon, Trash2Icon, WalletIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import { useAppActions } from "@/components/app/app-actions"
import { Amount, CardArt, DetailGroup, DetailRow, EmptyState } from "@/components/kw/primitives"
import { TransactionRow } from "@/components/kw/transaction-row"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { usePreferredName } from "@/hooks/use-ledger"
import {
  balanceOf,
  convert,
  creditCardDetail,
  debitCardDetail,
  formatAmount,
  formatMoney,
  isConfirmed,
  joinedMoney,
  scopeIncludes,
  setCardColor,
  settingsRate,
  type Ledger,
} from "@/lib/domain"
import { useT, type Translator } from "@/lib/i18n"
import type { Account, Card, CardColor } from "@/lib/schema"
import { accountName, cardKindLabel, dayLabel, debitTitle, expiryText, selectableCardColors, type TransactionDisplay } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"
import { cn } from "@/lib/utils"

import { ColorSwatches } from "./form-parts"
import { CardNumberDialog, CreditTermsDialog, DeleteAccountDialog, ProductExpiryDialog, RenameDialog } from "./manage-dialogs"

const LATEST_COUNT = 5

/** "STEVEN", as banks emboss the owner's name on their own cards. */
function holderName(name: string | undefined, locale: string) {
  return name ? name.toLocaleUpperCase(locale) : undefined
}

/** One account's detail: the debit card of a bank account, cash, or a credit card (iOS DebitCardView, CreditCardView). */
export function AccountDetail({ ledger, display, accountId, onDeleted }: { ledger: Ledger; display: TransactionDisplay; accountId: string; onDeleted: () => void }) {
  const t = useT()
  const account = ledger.accounts.find((candidate) => candidate.id === accountId)
  if (!account) return <EmptyState icon={WalletIcon} title={t.in("accounts", "We couldn't load this account.")} />
  switch (account.kind) {
    case "deposit":
      return <DebitDetail ledger={ledger} display={display} account={account} onDeleted={onDeleted} />
    case "cash":
      return <CashDetail ledger={ledger} display={display} account={account} onDeleted={onDeleted} />
    case "credit":
      return <CreditDetail ledger={ledger} display={display} account={account} onDeleted={onDeleted} />
  }
}

function Section({ title, children, action }: { title: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="type-caption font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/** A tappable row of the "Manage" group (iOS KWListRows). */
function ManageRow({ icon: Icon, label, value, onClick, destructive }: { icon: typeof PencilIcon; label: ReactNode; value?: ReactNode; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent/60", destructive && "text-destructive")}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 type-body">{label}</span>
      {value ? <span className="max-w-[50%] truncate type-caption text-muted-foreground">{value}</span> : null}
      {destructive ? null : <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />}
    </button>
  )
}

function Movements({ transactions, display, empty }: { transactions: readonly Ledger["transactions"][number][]; display: TransactionDisplay; empty: string }) {
  const t = useT()
  const { showDetail } = useAppActions()
  if (transactions.length === 0) return <p className="rounded-xl bg-secondary/40 px-4 py-6 text-center type-caption text-muted-foreground">{empty}</p>
  return (
    <div className="flex flex-col gap-0.5">
      {transactions.map((transaction) => (
        <TransactionRow key={transaction.id} transaction={transaction} display={display} onSelect={(selected) => showDetail(selected.id)} dateLabel={dayLabel(t, new Date(transaction.date))} />
      ))}
    </div>
  )
}

function ColorSection({ t, card }: { t: Translator; card: Card }) {
  const save = (color: CardColor) => {
    setCardColor(ledgerStore, card.id, color).catch(() => toast.add({ title: t.in("accounts", "We couldn't save the change. Try again."), type: "error" }))
  }
  return (
    <Section title={t.in("accounts", "Card color")}>
      <div className="rounded-xl bg-secondary/40 p-3">
        <ColorSwatches t={t} value={card.color} onChange={save} colors={selectableCardColors(card.color)} />
      </div>
    </Section>
  )
}

type Open = "rename" | "product" | "number" | "terms" | "delete" | undefined

function DebitDetail({ ledger, display, account, onDeleted }: { ledger: Ledger; display: TransactionDisplay; account: Account; onDeleted: () => void }) {
  const t = useT()
  const owner = usePreferredName()
  const [open, setOpen] = useState<Open>()
  let detail: ReturnType<typeof debitCardDetail> | undefined
  try {
    detail = debitCardDetail(ledger, account.id)
  } catch {
    detail = undefined
  }
  const name = accountName(account)
  if (!detail) {
    // The moment between an account arriving and the launch check giving it its card.
    return <EmptyState icon={CreditCardIcon} title={t.in("accounts", "We couldn't load this account.")} />
  }
  const { card, balance } = detail
  const toggle = (value: Open) => (next: boolean) => setOpen(next ? value : undefined)
  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto w-full max-w-sm">
        <CardArt color={card.color} bank={account.bank ?? account.name} network={card.network} lastFour={card.lastFour} kind="debit" kindLabel={cardKindLabel(t, "debit")} holder={holderName(owner, t.locale)} caption={card.expiry ? expiryText(card.expiry) : undefined} />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="type-caption text-muted-foreground">{t.in("accounts", "Available balance")}</span>
        <Amount value={balance} className={cn("type-amount-lg", balance.amount.lt(0) && "text-negative")} />
        <span className="type-caption text-muted-foreground">{t.in("accounts", "Bank account · %@", name)}</span>
      </div>
      <Section title={t.in("accounts", "Latest movements")}>
        <Movements transactions={detail.latestTransactions} display={display} empty={t.in("accounts", "No movements on this account yet.")} />
      </Section>
      <ColorSection t={t} card={card} />
      <Section title={t.in("accounts", "Manage account")}>
        <DetailGroup>
          <ManageRow icon={PencilIcon} label={t.in("accounts", "Edit name")} value={account.name} onClick={() => setOpen("rename")} />
          <ManageRow icon={CreditCardIcon} label={t.in("web", "Card number")} value={debitTitle(t, card)} onClick={() => setOpen("number")} />
          <ManageRow
            icon={ReceiptIcon}
            label={t.in("accounts", "Product and expiry")}
            value={[card.productName, card.expiry ? expiryText(card.expiry) : undefined].filter(Boolean).join(" · ") || t.in("sharedpresentation", "Not set")}
            onClick={() => setOpen("product")}
          />
          <ManageRow icon={Trash2Icon} label={t.in("accounts", "Delete account")} onClick={() => setOpen("delete")} destructive />
        </DetailGroup>
      </Section>
      <RenameDialog account={account} open={open === "rename"} onOpenChange={toggle("rename")} />
      <CardNumberDialog card={card} open={open === "number"} onOpenChange={toggle("number")} />
      <ProductExpiryDialog card={card} open={open === "product"} onOpenChange={toggle("product")} />
      <DeleteAccountDialog account={account} displayName={name} movementCount={detail.movementCount} open={open === "delete"} onOpenChange={toggle("delete")} onDeleted={onDeleted} />
    </div>
  )
}

function CashDetail({ ledger, display, account, onDeleted }: { ledger: Ledger; display: TransactionDisplay; account: Account; onDeleted: () => void }) {
  const t = useT()
  const [open, setOpen] = useState<Open>()
  const currencies = ledger.settings.currencies
  const balance = balanceOf(account, ledger.transactions)[0] ?? { amount: undefined, currency: currencies.principal }
  let equivalent: string | undefined
  if (balance.amount && balance.currency !== currencies.principal) {
    try {
      equivalent = formatMoney(convert({ amount: balance.amount, currency: balance.currency }, settingsRate(currencies), currencies.principal))
    } catch {
      equivalent = undefined
    }
  }
  const touching = ledger.transactions.filter((transaction) => scopeIncludes({ kind: "account", id: account.id }, transaction))
  const latest = touching.filter(isConfirmed).slice(0, LATEST_COUNT)
  const toggle = (value: Open) => (next: boolean) => setOpen(next ? value : undefined)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-secondary/40 px-4 py-8 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-positive-tint text-positive" aria-hidden>
          <BanknoteIcon className="size-6" />
        </span>
        <span className="type-heading">{account.name}</span>
        {balance.amount ? <Amount value={{ amount: balance.amount, currency: balance.currency }} className="type-amount-lg" /> : null}
        {equivalent ? <span className="type-caption text-muted-foreground">≈ {equivalent}</span> : null}
      </div>
      <Section title={t.in("accounts", "Latest movements")}>
        <Movements transactions={latest} display={display} empty={t.in("accounts", "No movements on this account yet.")} />
      </Section>
      <Section title={t.in("accounts", "Manage account")}>
        <DetailGroup>
          <ManageRow icon={PencilIcon} label={t.in("accounts", "Edit name")} value={account.name} onClick={() => setOpen("rename")} />
          <ManageRow icon={Trash2Icon} label={t.in("accounts", "Delete account")} onClick={() => setOpen("delete")} destructive />
        </DetailGroup>
      </Section>
      <RenameDialog account={account} open={open === "rename"} onOpenChange={toggle("rename")} />
      <DeleteAccountDialog account={account} displayName={accountName(account)} movementCount={touching.length} open={open === "delete"} onOpenChange={toggle("delete")} onDeleted={onDeleted} />
    </div>
  )
}

function CreditDetail({ ledger, display, account, onDeleted }: { ledger: Ledger; display: TransactionDisplay; account: Account; onDeleted: () => void }) {
  const t = useT()
  const owner = usePreferredName()
  const { openEditor } = useAppActions()
  const [open, setOpen] = useState<Open>()
  let detail: ReturnType<typeof creditCardDetail> | undefined
  try {
    detail = creditCardDetail(ledger, account.id)
  } catch {
    detail = undefined
  }
  if (!detail) return <EmptyState icon={CreditCardIcon} title={t.in("creditcard", "We couldn't load this card.")} />
  const { holder, balances, totalDebt, available, cycleTransactions } = detail
  const terms = account.creditTerms
  const name = accountName(account)
  const movementCount = ledger.transactions.filter((transaction) => scopeIncludes({ kind: "account", id: account.id }, transaction)).length
  const toggle = (value: Open) => (next: boolean) => setOpen(next ? value : undefined)
  const shortDay = (date: Date) => date.toLocaleDateString(t.locale, { day: "numeric", month: "short" })
  const dayValue = (day: number | undefined, next: Date | undefined) =>
    day === undefined ? t.in("creditcard", "Not set") : next ? t.in("creditcard", "Day %lld · next %@", day, shortDay(next)) : t.in("creditcard", "Day %lld", day)
  const owes = [...balances].reverse()
  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto w-full max-w-sm">
        <CardArt color={holder?.color} bank={account.bank ?? account.name} network={holder?.network} lastFour={holder?.lastFour} kind="creditHolder" kindLabel={cardKindLabel(t, "creditHolder")} holder={holderName(owner, t.locale)} caption={holder?.expiry ? expiryText(holder.expiry) : undefined} />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="type-caption text-muted-foreground">{t.in("creditcard", "Current debt")}</span>
        <span className={cn("type-amount-lg tabular-nums", owes.some((owed) => owed.amount.lt(0)) && "text-negative")}>{joinedMoney(owes)}</span>
        {balances.length > 1 ? <span className="type-caption text-muted-foreground">{t.in("web", "Total %@", formatMoney(totalDebt))}</span> : null}
        <Button className="mt-3" onClick={() => openEditor({ mode: "create", type: "cardPayment", accountId: account.id })}>
          {t.in("creditcard", "Pay")}
        </Button>
      </div>
      <Section title={t.in("creditcard", "Billing details")}>
        <DetailGroup>
          <DetailRow label={t.in("creditcard", "Credit limit")}>{terms?.limit ? formatAmount(terms.limit.amount, terms.limit.currency) : t.in("creditcard", "Not set")}</DetailRow>
          {available ? (
            <DetailRow label={t.in("creditcard", "Available")}>
              <Amount value={available} className={cn(available.amount.lt(0) && "text-negative")} />
            </DetailRow>
          ) : null}
          <DetailRow label={t.in("creditcard", "Cutoff date")}>{dayValue(terms?.cutoffDay, detail.nextCutoff)}</DetailRow>
          <DetailRow label={t.in("creditcard", "Payment date")}>{dayValue(terms?.dueDay, detail.nextDue)}</DetailRow>
        </DetailGroup>
        <Button variant="secondary" className="self-start" onClick={() => setOpen("terms")}>
          {t.in("creditcard", "Complete card details")}
        </Button>
      </Section>
      <Section title={t.in("creditcard", "This cycle")}>
        <Movements transactions={cycleTransactions} display={display} empty={t.in("creditcard", "Nothing charged this cycle yet.")} />
      </Section>
      {holder ? <ColorSection t={t} card={holder} /> : null}
      <Section title={t.in("creditcard", "Manage card")}>
        <DetailGroup>
          <ManageRow icon={PencilIcon} label={t.in("creditcard", "Edit name")} value={account.name} onClick={() => setOpen("rename")} />
          {holder ? (
            <>
              <ManageRow icon={CreditCardIcon} label={t.in("web", "Card number")} value={holder.lastFour ? `•••• ${holder.lastFour}` : t.in("creditcard", "Not set")} onClick={() => setOpen("number")} />
              <ManageRow
                icon={ReceiptIcon}
                label={t.in("creditcard", "Product and expiry")}
                value={[holder.productName, holder.expiry ? expiryText(holder.expiry) : undefined].filter(Boolean).join(" · ") || t.in("creditcard", "Not set")}
                onClick={() => setOpen("product")}
              />
            </>
          ) : null}
          <ManageRow icon={Trash2Icon} label={t.in("accounts", "Delete account")} onClick={() => setOpen("delete")} destructive />
        </DetailGroup>
      </Section>
      <RenameDialog account={account} open={open === "rename"} onOpenChange={toggle("rename")} />
      <CreditTermsDialog account={account} limitCurrency={detail.limitCurrency} open={open === "terms"} onOpenChange={toggle("terms")} />
      {holder ? <CardNumberDialog card={holder} open={open === "number"} onOpenChange={toggle("number")} /> : null}
      {holder ? <ProductExpiryDialog card={holder} open={open === "product"} onOpenChange={toggle("product")} /> : null}
      <DeleteAccountDialog account={account} displayName={name} movementCount={movementCount} open={open === "delete"} onOpenChange={toggle("delete")} onDeleted={onDeleted} />
    </div>
  )
}
