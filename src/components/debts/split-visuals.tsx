"use client"

import { useEffect, useState, type CSSProperties } from "react"
import QRCode from "qrcode"

import { KWIcon } from "@/components/kw/kw-icon"
import { SpringFill } from "@/components/kw/motion"
import { Decimal, ZERO } from "@/lib/domain"
import { formatAmount } from "@/lib/domain/format"
import type { Translator } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/** One person's share as the summary reads it, in the expense's currency. */
export interface ShareState {
  amount: Decimal
  repaid: Decimal
  paid: boolean
}

export interface SplitProgress {
  /** What the others owe together. */
  total: Decimal
  collected: Decimal
  left: Decimal
  paid: number
  people: number
}

/** A share settled by hand counts whole: the person said it was paid. */
export function splitProgress(shares: readonly ShareState[]): SplitProgress {
  let total = ZERO
  let collected = ZERO
  for (const share of shares) {
    total = total.plus(share.amount)
    collected = collected.plus(
      share.paid ? share.amount : Decimal.min(share.repaid, share.amount)
    )
  }
  return {
    total,
    collected,
    left: Decimal.max(total.minus(collected), ZERO),
    paid: shares.filter((share) => share.paid).length,
    people: shares.length,
  }
}

/**
 * "C$908.87 left to collect", a bar of what came back and "1 of 3 paid"; once everyone paid, a
 * green "Everyone paid".
 */
export function SplitSummary({
  t,
  progress,
  currency,
  className,
}: {
  t: Translator
  progress: SplitProgress
  currency: string
  className?: string
}) {
  const done = progress.people > 0 && progress.left.isZero()
  const fraction = progress.total.isZero()
    ? 0
    : progress.collected.div(progress.total).toNumber()
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl bg-secondary/60 p-4",
        className
      )}
    >
      {done ? (
        <span className="flex items-center gap-2 type-heading text-positive">
          <span className="flex size-6 items-center justify-center rounded-full bg-positive text-positive-foreground">
            <KWIcon name="check" size={14} />
          </span>
          {t.in("web", "Everyone paid")}
        </span>
      ) : (
        <span className="type-heading tabular-nums">
          {t.in(
            "web",
            "%@ left to collect",
            formatAmount(progress.left, currency)
          )}
        </span>
      )}
      <span
        className="h-2 overflow-hidden rounded-full bg-secondary"
        style={
          {
            "--fill": done ? "var(--positive)" : "var(--accent)",
          } as CSSProperties
        }
        role="progressbar"
        aria-label={t.in("web", "Collected")}
        aria-valuemin={0}
        aria-valuemax={progress.people}
        aria-valuenow={progress.paid}
      >
        <SpringFill fraction={fraction} className="bg-(--fill)" />
      </span>
      <span className="flex flex-wrap justify-between gap-x-3 type-caption text-muted-foreground tabular-nums">
        <span>
          {t.in(
            "web",
            "%@ of %@ collected",
            formatAmount(progress.collected, currency),
            formatAmount(progress.total, currency)
          )}
        </span>
        <span>
          {t.in(
            "web",
            "%@ of %@ paid",
            String(progress.paid),
            String(progress.people)
          )}
        </span>
      </span>
    </div>
  )
}

/** A person's initial in a circle, with a green check once their share is paid. */
export function PersonAvatar({ name, paid }: { name: string; paid: boolean }) {
  const initial = [...name.trim()][0]?.toUpperCase() ?? "?"
  return (
    <span aria-hidden className="relative shrink-0">
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-full type-body font-bold",
          paid ? "bg-positive-tint text-positive" : "bg-brand-500 text-white"
        )}
      >
        {initial}
      </span>
      {paid ? (
        <span className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-positive text-positive-foreground ring-2 ring-card">
          <KWIcon name="check" size={10} />
        </span>
      ) : null}
    </span>
  )
}

/** The public link as a QR code, to scan at the table. Drawn on the device, nothing is sent out. */
export function ShareQR({ url }: { url: string }) {
  const [image, setImage] = useState<string>()
  useEffect(() => {
    let current = true
    QRCode.toDataURL(url, { margin: 1, width: 240 }).then(
      (data) => current && setImage(data),
      () => current && setImage(undefined)
    )
    return () => {
      current = false
    }
  }, [url])
  return (
    <span className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- a data URL drawn here, nothing to optimize.
        <img src={image} alt="" className="size-full" />
      ) : null}
    </span>
  )
}

/** Whether a link's `?p=` names this person: the same letters, whatever the case or accents. */
export function namesPerson(name: string, query: string): boolean {
  const fold = (text: string) =>
    text.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase()
  return fold(query) !== "" && fold(name) === fold(query)
}
