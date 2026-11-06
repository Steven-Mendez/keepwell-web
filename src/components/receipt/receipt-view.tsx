"use client"

import { useEffect, useState, type CSSProperties, type ReactNode } from "react"

import { KWIcon } from "@/components/kw/kw-icon"
import type { KWIconName } from "@/components/kw/kw-icon-data"
import { StatusPill } from "@/components/movement-editor/flow-parts"
import { toast } from "@/components/ui/toast"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

import { receiptPng } from "./receipt-image"
import type { Receipt } from "./receipt-model"

/** KWTicketShape: rounded top, a row of 7 px bites along the bottom edge. */
const TICKET_MASK: CSSProperties = {
  maskImage:
    "linear-gradient(#000, #000), radial-gradient(circle 7px at 50% 100%, transparent 6.5px, #000 7px)",
  maskSize: "100% calc(100% - 7px), 21px 7px",
  maskPosition: "top, bottom",
  maskRepeat: "no-repeat, repeat-x",
}

/**
 * iOS ReceiptTicket: the ticket the receipt screen shows and the image saves, so both say the
 * same thing. `footer` holds the actions.
 */
export function ReceiptTicket({
  receipt,
  footer,
  className,
}: {
  receipt: Receipt
  footer?: ReactNode
  className?: string
}) {
  const t = useT()
  return (
    <div className={cn("relative pt-[30px]", className)}>
      <div
        className="flex flex-col items-center gap-3 rounded-t-[var(--radius-surface)] bg-card px-4 pt-10 pb-2 text-center"
        style={TICKET_MASK}
      >
        <p className="type-caption-sm text-muted-foreground">{receipt.date}</p>
        <div className="flex w-full flex-col items-center gap-0.5">
          <span className="type-label text-text-secondary">
            {receipt.headline}
          </span>
          <span className="max-w-full truncate type-amount-lg tabular-nums">
            {receipt.amount}
          </span>
          <span className="max-w-full text-[17px] leading-[22px] font-semibold break-words">
            {receipt.description}
          </span>
          <span className="pt-1">
            <StatusPill confirmed={receipt.confirmed}>
              {receipt.status}
            </StatusPill>
          </span>
        </div>
        <div className="my-1 h-px w-full bg-divider" />
        <dl className="w-full text-left">
          {receipt.rows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-3 py-[13px]"
            >
              <dt className="type-body text-text-secondary">{row.label}</dt>
              <dd className="min-w-0 text-right text-[15px] font-semibold break-words tabular-nums">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        {footer ?? <div className="h-3" />}
      </div>
      <span
        className="absolute top-0 left-1/2 flex size-[60px] -translate-x-1/2 items-center justify-center rounded-full bg-positive text-positive-foreground ring-[5px] ring-background ring-inset"
        role="img"
        aria-label={t.in("createtransaction", "Saved")}
      >
        <KWIcon name="check" size={28} strokeWidth={2.8 * (24 / 28)} />
      </span>
    </div>
  )
}

/** Whether this browser can hand a PNG to the system share sheet. */
function canShareFile(file: File): boolean {
  try {
    return (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    )
  } catch {
    return false
  }
}

/**
 * "Download image" and "Share" under the ticket, as iOS SavedView's round actions. The PNG is
 * drawn once per receipt, since sharing needs it up front; Share only shows where the browser can
 * share files.
 */
export function ReceiptActions({ receipt }: { receipt: Receipt }) {
  const t = useT()
  const [file, setFile] = useState<File>()
  useEffect(() => {
    let current = true
    receiptPng(receipt)
      .then((blob) => {
        if (current)
          setFile(new File([blob], receipt.fileName, { type: "image/png" }))
      })
      .catch(() => {
        if (current) setFile(undefined)
      })
    return () => {
      current = false
    }
  }, [receipt])

  const failed = () =>
    toast.add({
      title: t.in("createtransaction", "We couldn't save the image"),
      description: t.in(
        "createtransaction",
        "Try again, or share the receipt instead."
      ),
      type: "error",
    })

  function download() {
    if (!file) {
      failed()
      return
    }
    const url = URL.createObjectURL(file)
    const link = document.createElement("a")
    link.href = url
    link.download = receipt.fileName
    link.click()
    // The click starts the download synchronously; the URL can go once it has.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function shareImage() {
    if (!file) return
    try {
      await navigator.share({
        files: [file],
        title: t.in("createtransaction", "Share receipt"),
      })
    } catch {
      // Closing the share sheet rejects too; there's nothing to report.
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 pb-4">
      <div className="h-px w-full bg-divider" />
      <div className="flex items-start justify-center gap-6">
        <RoundAction
          icon="download"
          title={t.in("web", "Download image")}
          disabled={!file}
          onClick={download}
        />
        {file && canShareFile(file) ? (
          <RoundAction
            icon="share"
            title={t.in("createtransaction", "Share")}
            onClick={() => void shareImage()}
          />
        ) : null}
      </div>
    </div>
  )
}

/** A tinted circle with its caption underneath (iOS RoundAction). */
function RoundAction({
  icon,
  title,
  disabled,
  onClick,
}: {
  icon: KWIconName
  title: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group/round flex min-w-[88px] press flex-col items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      <span className="flex size-[52px] items-center justify-center rounded-full bg-link/14 text-link transition-colors group-hover/round:bg-link/24">
        <KWIcon name={icon} size={22} />
      </span>
      <span className="text-[13px] font-semibold text-text-secondary">
        {title}
      </span>
    </button>
  )
}
