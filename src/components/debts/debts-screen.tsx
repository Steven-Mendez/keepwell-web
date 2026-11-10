"use client"

import { useMemo, useState, type CSSProperties } from "react"

import {
  KWButton,
  KWCircleButton,
  KWEmptyState,
  KWGroupedCard,
  KWLargeTitleHeader,
  KWSection,
} from "@/components/kw/design"
import { AnimatedList, ListItem, SpringFill } from "@/components/kw/motion"
import { Page, Surface } from "@/components/kw/primitives"
import { SkeletonList } from "@/components/kw/skeletons"
import { useHiddenBalances } from "@/hooks/use-hidden-balances"
import { useLedger } from "@/hooks/use-ledger"
import {
  debtTotals,
  orderedLoans,
  orderedPersonalDebts,
  type LoanProgress,
  type Money,
} from "@/lib/domain"
import { useT, type Translator } from "@/lib/i18n"
import type { DebtDirection, Loan, PersonalDebt } from "@/lib/schema"
import { cn } from "@/lib/utils"

import {
  debtAmount,
  debtLine,
  loanLeft,
  loanLine,
  paidFraction,
  totalsText,
} from "./debt-format"
import { DebtDialog, DebtEditorDialog } from "./debt-dialogs"
import { LoanDialog, LoanEditorDialog } from "./loan-dialogs"

type Open =
  | { kind: "loanEditor"; loan?: Loan }
  | { kind: "loan"; id: string }
  | { kind: "debtEditor"; debt?: PersonalDebt; direction?: DebtDirection }
  | { kind: "debt"; id: string }

/**
 * Debts: what the person owes and is owed (one amount per currency, never added across currencies),
 * their loans with the next installment, and the people they lent to or borrowed from.
 */
export function DebtsScreen() {
  const t = useT()
  const ledger = useLedger()
  const [hidden, toggleHidden] = useHiddenBalances()
  const [now] = useState(() => new Date())
  const [open, setOpen] = useState<Open>()
  const loans = useMemo(
    () => (ledger ? orderedLoans(ledger.loans, now) : undefined),
    [ledger, now]
  )
  const debts = useMemo(
    () => (ledger ? orderedPersonalDebts(ledger.personalDebts) : undefined),
    [ledger]
  )
  const totals = useMemo(
    () => (ledger ? debtTotals(ledger.loans, ledger.personalDebts) : undefined),
    [ledger]
  )
  const close = () => setOpen(undefined)
  const openLoan =
    open?.kind === "loan"
      ? loans?.find((row) => row.loan.id === open.id)
      : undefined
  const openDebt =
    open?.kind === "debt" ? debts?.find((row) => row.id === open.id) : undefined

  return (
    <Page>
      <KWLargeTitleHeader
        title={t.in("debts", "Debts")}
        trailing={
          <>
            <KWCircleButton
              icon={hidden ? "eye" : "eyeOff"}
              label={t.in("web", hidden ? "Show balances" : "Hide balances")}
              onClick={toggleHidden}
            />
            <KWButton
              variant="surface"
              icon="plus"
              onClick={() => setOpen({ kind: "debtEditor" })}
            >
              {t.in("debts", "New debt")}
            </KWButton>
            <KWButton
              icon="plus"
              onClick={() => setOpen({ kind: "loanEditor" })}
            >
              {t.in("debts", "New loan")}
            </KWButton>
          </>
        }
      />
      {!ledger || !loans || !debts || !totals ? (
        <SkeletonList rows={3} />
      ) : (
        <>
          <Surface className="flex flex-col gap-3 p-4">
            <div className="grid grid-cols-2 gap-4">
              <Total
                t={t}
                title={t.in("debts", "You owe")}
                lines={totals.youOwe}
                hidden={hidden}
                tone="text-negative"
              />
              <Total
                t={t}
                title={t.in("debts", "Owed to you")}
                lines={totals.owedToYou}
                hidden={hidden}
                tone="text-positive"
              />
            </div>
            <p className="type-caption text-muted-foreground">
              {t.in(
                "debts",
                "Personal debts are only tracked here: they don't record movements or change your balances."
              )}
            </p>
          </Surface>
          {loans.length === 0 && debts.length === 0 ? (
            <KWGroupedCard>
              <KWEmptyState
                icon="wallet"
                title={t.in("debts", "No debts yet")}
                message={t.in(
                  "debts",
                  "Add a loan to follow its installments, or write down money you lent or borrowed."
                )}
                action={
                  <KWButton
                    icon="plus"
                    size="large"
                    onClick={() => setOpen({ kind: "loanEditor" })}
                  >
                    {t.in("debts", "New loan")}
                  </KWButton>
                }
              />
            </KWGroupedCard>
          ) : null}
          {loans.length > 0 ? (
            <KWSection title={t.in("debts", "Loans")}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <AnimatedList>
                  {loans.map((progress) => (
                    <ListItem key={progress.loan.id}>
                      <LoanCard
                        t={t}
                        progress={progress}
                        hidden={hidden}
                        onOpen={() =>
                          setOpen({ kind: "loan", id: progress.loan.id })
                        }
                      />
                    </ListItem>
                  ))}
                </AnimatedList>
              </div>
            </KWSection>
          ) : null}
          {debts.length > 0 ? (
            <KWSection title={t.in("debts", "People")}>
              <KWGroupedCard>
                {debts.map((debt) => (
                  <button
                    key={debt.id}
                    type="button"
                    onClick={() => setOpen({ kind: "debt", id: debt.id })}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left press-row outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate type-body font-semibold">
                        {debt.person}
                      </span>
                      <span className="truncate type-caption text-muted-foreground">
                        {debtLine(t, debt)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 type-body font-semibold tabular-nums",
                        debt.settledAt
                          ? "text-muted-foreground"
                          : debt.direction === "theyOweMe"
                            ? "text-positive"
                            : "text-negative"
                      )}
                    >
                      {debtAmount(t, debt, hidden)}
                    </span>
                  </button>
                ))}
              </KWGroupedCard>
            </KWSection>
          ) : null}
        </>
      )}
      {open?.kind === "loanEditor" && ledger ? (
        <LoanEditorDialog
          key={open.loan?.id ?? "new"}
          t={t}
          loan={open.loan}
          currencies={ledger.settings.currencies}
          onClose={close}
        />
      ) : null}
      {openLoan && ledger ? (
        <LoanDialog
          key={openLoan.loan.id}
          t={t}
          progress={openLoan}
          ledger={ledger}
          hidden={hidden}
          onEdit={() => setOpen({ kind: "loanEditor", loan: openLoan.loan })}
          onClose={close}
        />
      ) : null}
      {open?.kind === "debtEditor" && ledger ? (
        <DebtEditorDialog
          key={open.debt?.id ?? "new"}
          t={t}
          debt={open.debt}
          direction={open.direction ?? "theyOweMe"}
          currencies={ledger.settings.currencies}
          onClose={close}
        />
      ) : null}
      {openDebt ? (
        <DebtDialog
          key={openDebt.id}
          t={t}
          debt={openDebt}
          hidden={hidden}
          onEdit={() => setOpen({ kind: "debtEditor", debt: openDebt })}
          onClose={close}
        />
      ) : null}
    </Page>
  )
}

function Total({
  t,
  title,
  lines,
  hidden,
  tone,
}: {
  t: Translator
  title: string
  lines: readonly Money[]
  hidden: boolean
  tone: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="type-label text-muted-foreground">{title}</span>
      <span
        className={cn(
          "type-heading break-words tabular-nums",
          lines.length === 0 ? "text-muted-foreground" : tone
        )}
      >
        {totalsText(t, lines, hidden)}
      </span>
    </div>
  )
}

function LoanCard({
  t,
  progress,
  hidden,
  onOpen,
}: {
  t: Translator
  progress: LoanProgress
  hidden: boolean
  onOpen: () => void
}) {
  const { loan } = progress
  const fraction = paidFraction(progress)
  return (
    <Surface className="h-full">
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col gap-3 rounded-2xl p-4 text-left outline-none hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 flex-col">
            <span className="truncate type-heading">{loan.name}</span>
            {loan.lender ? (
              <span className="truncate type-caption text-muted-foreground">
                {loan.lender}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 type-caption text-text-secondary tabular-nums">
            {loanLeft(t, progress, hidden)}
          </span>
        </span>
        <span
          className="h-2 overflow-hidden rounded-full bg-secondary"
          style={
            {
              "--fill": progress.isPaidOff
                ? "var(--positive)"
                : "var(--accent)",
            } as CSSProperties
          }
          role="progressbar"
          aria-label={loan.name}
          aria-valuemin={0}
          aria-valuemax={loan.installmentCount}
          aria-valuenow={loan.payments.length}
        >
          <SpringFill fraction={fraction} className="bg-(--fill)" />
        </span>
        <span
          className={cn(
            "type-caption tabular-nums",
            progress.isNextOverdue ? "text-pending" : "text-muted-foreground"
          )}
        >
          {loanLine(t, progress, hidden)}
        </span>
      </button>
    </Surface>
  )
}
