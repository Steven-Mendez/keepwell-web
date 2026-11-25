"use client"

import { useEffect, useState } from "react"

import { KWGroupedCard } from "@/components/kw/design"
import { KWAppIconTile } from "@/components/kw/kw-icon"
import { formatAmount } from "@/lib/domain/format"
import { useT } from "@/lib/i18n"
import { ApiError } from "@/lib/api/client"
import { fetchSharedSplit, type SharedSplitView } from "@/lib/api/shared-split"
import { dec } from "@/lib/domain"
import {
  PersonAvatar,
  SplitSummary,
  splitProgress,
} from "@/components/debts/split-visuals"

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "failed" }
  | { kind: "ready"; split: SharedSplitView }

/**
 * A split expense's public page: anyone with the link sees each person's share and whether they paid,
 * read only, without an account. Outside the app shell, so nothing of this browser's ledger loads.
 */
export function SharedSplit({ token }: { token: string }) {
  const t = useT()
  const [state, setState] = useState<State>({ kind: "loading" })

  useEffect(() => {
    let current = true
    fetchSharedSplit(token).then(
      (split) => current && setState({ kind: "ready", split }),
      (error: unknown) =>
        current &&
        setState({
          kind:
            error instanceof ApiError && error.status === 404
              ? "missing"
              : "failed",
        })
    )
    return () => {
      current = false
    }
  }, [token])

  return (
    <main className="min-h-svh bg-background px-4 py-12">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <KWAppIconTile size={44} />
        {state.kind === "loading" ? (
          <p className="type-body text-muted-foreground">
            {t.in("web", "Loading…")}
          </p>
        ) : state.kind === "missing" ? (
          <p className="type-body text-muted-foreground">
            {t.in("web", "This link is no longer available.")}
          </p>
        ) : state.kind === "failed" ? (
          <p role="alert" className="type-body text-negative">
            {t.in("web", "We couldn't load this expense. Try again.")}
          </p>
        ) : (
          <SplitView split={state.split} />
        )}
      </div>
    </main>
  )
}

function SplitView({ split }: { split: SharedSplitView }) {
  const t = useT()
  const money = (amount: string, currency = split.currency) =>
    formatAmount(dec(amount), currency)
  // Shares in another currency are left out of the money totals: they can't be added up.
  const progress = splitProgress(
    split.shares
      .filter((share) => share.currency === split.currency)
      .map((share) => ({
        amount: dec(share.amount),
        repaid: dec(share.repaid),
        paid: share.paid,
      }))
  )
  return (
    <>
      <header className="flex flex-col gap-1">
        <p className="type-caption text-muted-foreground">
          {new Date(split.date).toLocaleDateString(t.locale, {
            dateStyle: "medium",
          })}
        </p>
        <h1 className="type-title text-balance">{split.description}</h1>
        <p className="type-body text-muted-foreground tabular-nums">
          {t.in("web", "Total %@", money(split.amount))}
        </p>
      </header>
      <SplitSummary t={t} progress={progress} currency={split.currency} />
      <KWGroupedCard>
        {split.shares.map((share, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3">
            <PersonAvatar name={share.person} paid={share.paid} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate type-body font-semibold">
                {share.person}
              </span>
              <span
                className={
                  share.paid
                    ? "type-caption text-positive"
                    : "type-caption text-muted-foreground tabular-nums"
                }
              >
                {share.paid
                  ? t.in("debts", "Paid")
                  : dec(share.repaid).gt(0)
                    ? t.in(
                        "web",
                        "Paid %@ of %@",
                        money(share.repaid, share.currency),
                        money(share.amount, share.currency)
                      )
                    : t.in("web", "Pending")}
              </span>
            </div>
            <span
              className={
                share.paid
                  ? "type-heading text-muted-foreground tabular-nums line-through decoration-1"
                  : "type-heading tabular-nums"
              }
            >
              {money(share.amount, share.currency)}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex-1 type-body text-muted-foreground">
            {t.in("web", "Whoever paid the bill")}
          </span>
          <span className="type-body text-muted-foreground tabular-nums">
            {money(split.owner_share)}
          </span>
        </div>
      </KWGroupedCard>
      <p className="type-caption text-muted-foreground">
        {t.in(
          "web",
          "Shared from Keepwell. Only the person who paid the bill can change it."
        )}
      </p>
    </>
  )
}
