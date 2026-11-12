"use client"

import { useState } from "react"

import { KWButton } from "@/components/kw/design"
import { OptionSelect } from "@/components/kw/pickers"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import { closeAccount, closingPlan, reopenAccount, type Ledger } from "@/lib/domain"
import { formatMoney } from "@/lib/domain/format"
import { useT } from "@/lib/i18n"
import type { Account } from "@/lib/schema"
import { accountName, shortDate } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"

/**
 * "Close account": with a zero balance it only asks; with money left it shows the balance per currency
 * and where it can move (open accounts holding those currencies), or says to move it first.
 */
export function CloseAccountDialog({
  ledger,
  account,
  open,
  onOpenChange,
}: {
  ledger: Ledger
  account: Account
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const plan = closingPlan(ledger, account.id)
  const [destination, setDestination] = useState<string>("")
  const chosen = plan.destinations.find((candidate) => candidate.id === destination)?.id ?? plan.destinations[0]?.id
  const blocked = plan.balances.length > 0 && chosen === undefined
  const close = () => {
    setBusy(true)
    closeAccount(ledgerStore, account.id, {
      ...(plan.balances.length > 0 && chosen ? { transferTo: chosen } : {}),
      description: t.in("sharedpresentation", "Closing transfer"),
    })
      .then(() => onOpenChange(false))
      .catch(() => toast.add({ title: t.in("sharedpresentation", "We couldn't close the account. Try again."), type: "error" }))
      .finally(() => setBusy(false))
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-2xl bg-nav p-6 ring-divider sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="type-heading text-foreground">
            {t.in("sharedpresentation", "Close %@?", accountName(account))}
          </DialogTitle>
          <DialogDescription className="type-body text-muted-foreground">
            {t.in(
              "sharedpresentation",
              "It disappears from your lists and pickers. Its movements stay in your summaries and net worth. You can reopen it."
            )}
          </DialogDescription>
        </DialogHeader>
        {plan.rulesToPause.length > 0 || plan.draftsToDelete.length > 0 ? (
          <ul className="flex flex-col gap-1 type-caption text-muted-foreground">
            {plan.rulesToPause.length > 0 ? (
              <li>{t.in("sharedpresentation", "Recurring rules paused: %lld", plan.rulesToPause.length)}</li>
            ) : null}
            {plan.draftsToDelete.length > 0 ? (
              <li>{t.in("sharedpresentation", "Drafts deleted: %lld", plan.draftsToDelete.length)}</li>
            ) : null}
          </ul>
        ) : null}
        {plan.balances.length > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="type-amount text-foreground">
              {plan.balances.map((balance) => formatMoney(balance)).join(" · ")}
            </p>
            {blocked ? (
              <p className="type-body text-pending">
                {t.in("sharedpresentation", "Move or record the balance first")}
              </p>
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className="type-caption text-muted-foreground">
                  {t.in("sharedpresentation", "Move the balance to")}
                </span>
                <OptionSelect
                  value={chosen ?? ""}
                  onChange={setDestination}
                  options={plan.destinations.map((candidate) => ({
                    value: candidate.id,
                    label: accountName(candidate),
                  }))}
                />
              </label>
            )}
          </div>
        ) : null}
        <DialogFooter className="-mx-6 -mb-6 rounded-b-2xl border-divider bg-transparent px-6 pb-6">
          <KWButton type="button" variant="plain" onClick={() => onOpenChange(false)}>
            {t.in("web", "Cancel")}
          </KWButton>
          {blocked ? null : (
            <KWButton type="button" disabled={busy} onClick={close}>
              {plan.balances.length > 0
                ? t.in("sharedpresentation", "Move and close")
                : t.in("sharedpresentation", "Close account")}
            </KWButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The head of a closed account's detail: when it closed, a warning if money came back, and "Reopen". */
export function ClosedAccountBanner({ ledger, account }: { ledger: Ledger; account: Account }) {
  const t = useT()
  if (!account.closedAt) return null
  const { balances } = closingPlan(ledger, account.id)
  const reopen = () => {
    reopenAccount(ledgerStore, account.id).catch(() =>
      toast.add({ title: t.in("accounts", "We couldn't save the change. Try again."), type: "error" })
    )
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="type-body text-foreground">
          {t.in("sharedpresentation", "Closed on %@", shortDate(t, new Date(account.closedAt)))}
        </span>
        {balances.length > 0 ? (
          <span className="type-caption text-pending">{t.in("sharedpresentation", "Balance isn't zero")}</span>
        ) : null}
      </div>
      <KWButton size="medium" onClick={reopen}>
        {t.in("sharedpresentation", "Reopen")}
      </KWButton>
    </div>
  )
}

