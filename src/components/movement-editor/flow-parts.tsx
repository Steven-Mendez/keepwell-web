"use client"

import type { ReactNode } from "react"

import { KWCircleButton } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Pieces of the iOS create and onboarding flows (CreateTransaction FlowComponents, DesignSystem
// KWFieldRows, KWStepProgress, KWFlowHeader) shared by the movement editor, its detail panel and
// onboarding.

/** KWFieldRows' input: `surface2` fill, 12 px radius, body type, 40 px tall. Applied to shadcn inputs. */
export const KW_FIELD =
  "h-10 rounded-xl border-0 bg-secondary px-3.5 type-body text-foreground shadow-none placeholder:text-text-faint focus-visible:ring-2 focus-visible:ring-ring aria-invalid:ring-2 aria-invalid:ring-negative dark:bg-secondary"

/** The same field as a textarea. */
export const KW_TEXTAREA =
  "min-h-20 rounded-xl border-0 bg-secondary px-3.5 py-2.5 type-body text-foreground shadow-none placeholder:text-text-faint focus-visible:ring-2 focus-visible:ring-ring dark:bg-secondary"

/** Caption above a field (KWFieldRows label: caption, muted). */
export function FieldLabel({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("px-1 type-caption text-muted-foreground", className)}
    >
      {children}
    </label>
  )
}

/** The flow's selection mark: a green check when chosen, an empty `controlOff` ring otherwise. */
export function RadioMark({ selected }: { selected: boolean }) {
  return selected ? (
    <span
      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-positive text-positive-foreground"
      aria-hidden
    >
      <KWIcon name="check" size={14} strokeWidth={3} />
    </span>
  ) : (
    <span
      className="size-6 shrink-0 rounded-full ring-2 ring-control-off ring-inset"
      aria-hidden
    />
  )
}

/** KWStepProgress: done steps white, pending ones `border`. `current` is 1-based. */
export function StepProgress({
  total,
  current,
  className,
}: {
  total: number
  current: number
  className?: string
}) {
  const t = useT()
  return (
    <div
      className={cn("flex flex-1 gap-1.5", className)}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={t.in("designsystem", "Step %lld of %lld", current, total)}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-1 flex-1 rounded-[2px] transition-colors duration-300 ease-snappy",
            index < current ? "bg-white" : "bg-border"
          )}
        />
      ))}
    </div>
  )
}

/** KWFlowHeader: back or close, then the step progress when the step counts. */
export function FlowHeader({
  leading,
  onLeading,
  progress,
  trailing,
}: {
  leading: "back" | "close"
  onLeading: () => void
  progress?: { total: number; current: number }
  trailing?: ReactNode
}) {
  const t = useT()
  return (
    <div className="flex items-center gap-3">
      <KWCircleButton
        icon={leading === "back" ? "chevronLeft" : "close"}
        label={t.in("designsystem", leading === "back" ? "Back" : "Close")}
        shortcut={leading === "close" ? "Esc" : undefined}
        onClick={onLeading}
      />
      {progress ? (
        <StepProgress total={progress.total} current={progress.current} />
      ) : (
        <span className="flex-1" />
      )}
      {trailing}
    </div>
  )
}

/** The receipt's status capsule: green "Confirmed", amber "Draft". */
export function StatusPill({
  confirmed,
  children,
}: {
  confirmed: boolean
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 type-micro font-bold",
        confirmed
          ? "bg-positive-tint text-positive"
          : "bg-pending-tint text-pending"
      )}
    >
      {children}
    </span>
  )
}

/** KWToggleStyle: the green switch iOS uses, as a button with switch semantics. */
export function KWSwitch({
  id,
  checked,
  onChange,
  label,
}: {
  id?: string
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ease-snappy outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked ? "bg-positive" : "bg-control-off"
      )}
    >
      {/* 28 px knob inside the 32 px track, as KWToggleStyle draws it. */}
      <span
        className={cn(
          "rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.35)] transition-transform duration-300 ease-spring",
          checked ? "translate-x-5" : "translate-x-0"
        )}
        style={{ width: 28, height: 28 }}
      />
    </button>
  )
}
