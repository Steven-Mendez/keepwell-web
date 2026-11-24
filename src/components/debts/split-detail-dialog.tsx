"use client"

import { useState } from "react"

import { KWButton, KWGroupedCard } from "@/components/kw/design"
import { ConfirmDialog } from "@/components/settings/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import { useLedger } from "@/hooks/use-ledger"
import {
  canDepositRepayment,
  debtRemaining,
  debtRepaid,
  decimalText,
  deleteDebtRepayment,
  isSettled,
  openAccounts,
  reopenPersonalDebt,
  repayPersonalDebt,
  shareSplit,
  splitDebts,
  stopSharingSplit,
} from "@/lib/domain"
import { formatAmount } from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"
import { accountName } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"
import type { Account, PersonalDebt, Transaction } from "@/lib/schema"

import { SELECT_CLASS } from "./debt-format"

const DIALOG =
  "max-h-[90svh] gap-5 overflow-y-auto rounded-2xl bg-card p-6 ring-1 ring-border/60 sm:max-w-lg"

/** The public page of a shared split, on this same site. */
export function shareURL(token: string): string {
  return `${window.location.origin}/s/${token}`
}

/** The repayment that settled the debt the moment it was paid; undoing it opens the debt again. */
function settlingRepayment(debt: PersonalDebt) {
  const last = debt.repayments.at(-1)
  if (last?.id === undefined || debt.settledAt === undefined) return undefined
  return new Date(last.date).getTime() === new Date(debt.settledAt).getTime()
    ? last
    : undefined
}

/**
 * A split expense's people: each share and whether it was paid, "Mark as paid" (optionally deposited
 * into an account) and back, "Edit split", and the public link to send them.
 */
export function SplitDetailDialog({
  t,
  transaction,
  onEditSplit,
  onClose,
}: {
  t: Translator
  transaction: Transaction
  onEditSplit: () => void
  onClose: () => void
}) {
  const ledger = useLedger()
  const [paying, setPaying] = useState<PersonalDebt>()
  const [unpaying, setUnpaying] = useState<PersonalDebt>()
  const [failed, setFailed] = useState(false)
  const [isSaving, setSaving] = useState(false)
  if (!ledger) return null
  // The ledger is live: after sharing or paying, the movement and its debts read back updated.
  const current =
    ledger.transactions.find((candidate) => candidate.id === transaction.id) ??
    transaction
  const debts = splitDebts(current, ledger.personalDebts)
  const accounts = openAccounts(ledger.accounts).filter(
    (account) => account.kind !== "credit"
  )
  const token = current.shareToken

  async function run(work: () => Promise<unknown>) {
    setSaving(true)
    try {
      await work()
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.add({ title: t.in("web", "Link copied") })
    } catch {
      setFailed(true)
    }
  }

  function unpay(debt: PersonalDebt) {
    const repayment = settlingRepayment(debt)
    void run(() =>
      repayment?.id === undefined
        ? reopenPersonalDebt(ledgerStore, debt.id)
        : deleteDebtRepayment(ledgerStore, debt.id, repayment.id)
    )
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className={DIALOG}>
          <DialogHeader>
            <DialogTitle className="type-heading">
              {t.in("web", "Split with")}
            </DialogTitle>
            <p className="truncate type-caption text-muted-foreground">
              {current.description} ·{" "}
              {formatAmount(current.amount, current.currency)}
            </p>
          </DialogHeader>
          <KWGroupedCard className="bg-secondary/40">
            {debts.map((debt) => (
              <ShareRow
                key={debt.id}
                t={t}
                debt={debt}
                disabled={isSaving}
                onPay={() => setPaying(debt)}
                onUnpay={() =>
                  settlingRepayment(debt)?.transactionId === undefined
                    ? unpay(debt)
                    : setUnpaying(debt)
                }
              />
            ))}
          </KWGroupedCard>
          <div className="flex flex-col gap-2 rounded-2xl bg-secondary/60 p-4">
            <span className="type-label">{t.in("web", "Public link")}</span>
            <span className="type-caption text-muted-foreground">
              {token
                ? t.in(
                    "web",
                    "Anyone with the link sees what each person owes and who already paid. Only you can change it."
                  )
                : t.in(
                    "web",
                    "Send a link so each person sees how much to pay, without an account."
                  )}
            </span>
            {token ? (
              <>
                <code className="truncate rounded-lg bg-background px-3 py-2 type-caption">
                  {shareURL(token)}
                </code>
                <div className="flex flex-wrap gap-2">
                  <KWButton
                    size="small"
                    icon="share"
                    onClick={() => void copy(shareURL(token))}
                  >
                    {t.in("web", "Copy link")}
                  </KWButton>
                  <KWButton
                    variant="surface"
                    size="small"
                    disabled={isSaving}
                    onClick={() =>
                      void run(() => stopSharingSplit(ledgerStore, current.id))
                    }
                  >
                    {t.in("web", "Stop sharing")}
                  </KWButton>
                </div>
              </>
            ) : (
              <div>
                <KWButton
                  size="small"
                  icon="share"
                  disabled={isSaving || debts.length === 0}
                  onClick={() =>
                    void run(async () => {
                      const shared = await shareSplit(ledgerStore, current.id)
                      if (shared.shareToken)
                        await copy(shareURL(shared.shareToken))
                    })
                  }
                >
                  {t.in("web", "Share link")}
                </KWButton>
              </div>
            )}
          </div>
          {failed ? (
            <p role="alert" className="type-caption text-negative">
              {t.in("debts", "We couldn't save the debt. Try again.")}
            </p>
          ) : null}
          <DialogFooter className="-mx-6 -mb-6 gap-2 rounded-b-2xl border-divider bg-transparent px-6 pb-6 sm:justify-between">
            <KWButton variant="surface" icon="pencil" onClick={onEditSplit}>
              {t.in("web", "Edit split")}
            </KWButton>
            <KWButton variant="surface" onClick={onClose}>
              {t.in("web", "Done")}
            </KWButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {paying ? (
        <MarkPaidDialog
          key={paying.id}
          t={t}
          debt={paying}
          accounts={
            canDepositRepayment(paying, ledger.settings.currencies)
              ? accounts
              : []
          }
          onClose={() => setPaying(undefined)}
        />
      ) : null}
      <ConfirmDialog
        open={unpaying !== undefined}
        onOpenChange={(open) => !open && setUnpaying(undefined)}
        title={t.in("web", "Mark as unpaid?")}
        description={t.in(
          "web",
          "The income it deposited is deleted too, and the balance goes back."
        )}
        action={t.in("web", "Mark as unpaid")}
        destructive
        onConfirm={() => {
          if (unpaying) unpay(unpaying)
          setUnpaying(undefined)
        }}
      />
    </>
  )
}

function ShareRow({
  t,
  debt,
  disabled,
  onPay,
  onUnpay,
}: {
  t: Translator
  debt: PersonalDebt
  disabled: boolean
  onPay: () => void
  onUnpay: () => void
}) {
  const money = (amount: Parameters<typeof formatAmount>[0]) =>
    formatAmount(amount, debt.amount.currency)
  const repaid = debtRepaid(debt)
  const paid = isSettled(debt)
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate type-body font-semibold">{debt.person}</span>
        <span
          className={
            paid
              ? "type-caption text-positive"
              : "type-caption text-muted-foreground tabular-nums"
          }
        >
          {paid
            ? t.in("debts", "Paid")
            : repaid.gt(0)
              ? t.in(
                  "web",
                  "Paid %@ of %@",
                  money(repaid),
                  money(debt.amount.amount)
                )
              : t.in("web", "Pending")}
        </span>
      </div>
      <span className="type-body tabular-nums">
        {money(debt.amount.amount)}
      </span>
      {paid ? (
        <KWButton
          variant="plain"
          size="small"
          disabled={disabled}
          onClick={onUnpay}
        >
          {t.in("web", "Mark as unpaid")}
        </KWButton>
      ) : (
        <KWButton
          variant="surface"
          size="small"
          icon="check"
          disabled={disabled}
          onClick={onPay}
        >
          {t.in("web", "Mark as paid")}
        </KWButton>
      )}
    </div>
  )
}

/** "Mark as paid": records what is left as repaid, and asks whether the money went into an account. */
function MarkPaidDialog({
  t,
  debt,
  accounts,
  onClose,
}: {
  t: Translator
  debt: PersonalDebt
  /** Empty when the debt's currency can't be deposited. */
  accounts: readonly Account[]
  onClose: () => void
}) {
  const [accountId, setAccountId] = useState("")
  const [failed, setFailed] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const remaining = debtRemaining(debt)
  const account = accounts.find((candidate) => candidate.id === accountId)

  async function save() {
    setSaving(true)
    try {
      await repayPersonalDebt(
        ledgerStore,
        debt.id,
        decimalText(remaining),
        new Date(),
        account ? { accountId: account.id } : undefined
      )
      onClose()
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={DIALOG}>
        <DialogHeader>
          <DialogTitle className="type-heading">
            {t.in(
              "web",
              "%@ paid you %@",
              debt.person,
              formatAmount(remaining, debt.amount.currency)
            )}
          </DialogTitle>
        </DialogHeader>
        {accounts.length > 0 ? (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="split-paid-deposit"
              className="type-label text-text-secondary"
            >
              {t.in("web", "Deposit into account")}
            </label>
            <select
              id="split-paid-deposit"
              className={SELECT_CLASS}
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">{t.in("web", "Don't deposit")}</option>
              {accounts.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {accountName(candidate)}
                </option>
              ))}
            </select>
            {account ? (
              <span className="type-caption text-muted-foreground">
                {t.in(
                  "web",
                  "Records an income in %@. It changes the balance but doesn't count as income: the money only came back.",
                  accountName(account)
                )}
              </span>
            ) : null}
          </div>
        ) : null}
        {failed ? (
          <p role="alert" className="type-caption text-negative">
            {t.in("debts", "We couldn't save the debt. Try again.")}
          </p>
        ) : null}
        <DialogFooter className="-mx-6 -mb-6 gap-2 rounded-b-2xl border-divider bg-transparent px-6 pb-6">
          <KWButton variant="surface" onClick={onClose}>
            {t.in("debts", "Cancel")}
          </KWButton>
          <KWButton disabled={isSaving} onClick={() => void save()}>
            {t.in("web", "Mark as paid")}
          </KWButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
