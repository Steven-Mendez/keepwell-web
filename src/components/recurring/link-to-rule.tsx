"use client"

import { useMemo, useState } from "react"

import { BrandOrCategoryBadge } from "@/components/kw/brand-mark"
import { KWTransactionIcon } from "@/components/kw/design"
import { FlowHeader } from "@/components/movement-editor/flow-parts"
import { frequencyText } from "@/components/recurring/recurring-format"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import { useLedger, useMerchants } from "@/hooks/use-ledger"
import { canLinkPayment, linkPayment, paymentCandidates } from "@/lib/domain"
import { formatAmount } from "@/lib/domain/format"
import { useT } from "@/lib/i18n"
import { movementLogo } from "@/lib/presentation/merchants"
import { ledgerStore } from "@/lib/repositories"
import type { RecurringRule, Transaction } from "@/lib/schema"
import { cn } from "@/lib/utils"

/**
 * The rules a movement could be a payment of: of its kind, the ones it would be suggested for first
 * (same currency, and its amount or name matches), then the rest of its currency, then any other.
 */
export function linkableRules(transaction: Transaction, rules: readonly RecurringRule[]): RecurringRule[] {
  const rank = (rule: RecurringRule): [number, number] => [
    paymentCandidates(rule, [transaction]).length > 0 ? 0 : 1,
    rule.currency === transaction.currency ? 0 : 1,
  ]
  return rules
    .filter((rule) => canLinkPayment(rule, transaction))
    .sort((a, b) => {
      const [a1, a2] = rank(a)
      const [b1, b2] = rank(b)
      return a1 - b1 || a2 - b2 || a.name.localeCompare(b.name)
    })
}

/**
 * "Link to a recurring", opened from a movement: choosing a rule links the movement as one of its
 * payments. The rule's schedule doesn't move.
 */
export function LinkToRule({
  transaction,
  onClose,
}: {
  transaction: Transaction | undefined
  onClose: () => void
}) {
  return (
    <Dialog open={transaction !== undefined} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(80vh,720px)] flex-col gap-0 overflow-hidden rounded-[var(--radius-surface)] bg-background p-0 ring-1 ring-border sm:max-w-md"
      >
        {transaction ? <RulePicker transaction={transaction} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function RulePicker({ transaction, onClose }: { transaction: Transaction; onClose: () => void }) {
  const t = useT()
  const ledger = useLedger()
  const merchants = useMerchants()
  const [linkingId, setLinkingId] = useState<string>()
  const rules = useMemo(
    () => linkableRules(transaction, ledger?.recurringRules ?? []),
    [transaction, ledger?.recurringRules]
  )

  const link = (rule: RecurringRule) => {
    if (linkingId) return
    setLinkingId(rule.id)
    linkPayment(ledgerStore, rule.id, transaction.id)
      .then(onClose)
      .catch(() => {
        setLinkingId(undefined)
        toast.add({ title: t.in("recurring", "We couldn't link it. Try again."), type: "error" })
      })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-(--gutter) md:p-6">
      <FlowHeader leading="close" onLeading={onClose} />
      <div className="flex flex-col gap-1">
        <DialogTitle className="type-title text-foreground">
          {t.in("recurring", "Link to a recurring")}
        </DialogTitle>
        <p className="type-caption text-muted-foreground">
          {t.in("recurring", "It counts as a payment of the one you choose.")}
        </p>
      </div>
      {rules.length === 0 ? (
        <p className="type-body text-muted-foreground">
          {t.in("recurring", "No recurring payments of this kind")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card">
          {rules.map((rule) => {
            const category = ledger?.categories.find((candidate) => candidate.id === rule.categoryId)
            return (
              <li key={rule.id}>
                <button
                  type="button"
                  disabled={linkingId !== undefined}
                  onClick={() => link(rule)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-default",
                    linkingId === rule.id && "opacity-55"
                  )}
                >
                  {rule.kind === "transfer" ? (
                    <KWTransactionIcon style="transfer" />
                  ) : (
                    <BrandOrCategoryBadge
                      text={rule.name}
                      category={category}
                      logo={movementLogo({ description: rule.name, merchantId: rule.merchantId }, merchants ?? [])}
                    />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate type-body font-semibold text-foreground">{rule.name}</span>
                    <span className="truncate type-caption text-muted-foreground">
                      {`${formatAmount(rule.amount, rule.currency)} · ${frequencyText(t, rule.frequency, rule.interval)}`}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
