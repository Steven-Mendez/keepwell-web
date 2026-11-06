"use client"

import type { ReactNode } from "react"

import { KWButton, kwButtonClass } from "@/components/kw/design"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useT } from "@/lib/i18n"

/** An iOS-style confirmation: a question, what happens, and one action (destructive or not). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  action,
  destructive,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  action: ReactNode
  destructive?: boolean
  onConfirm: () => void
}) {
  const t = useT()
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-5 rounded-2xl bg-card p-6 ring-1 ring-border/60">
        <AlertDialogHeader>
          <AlertDialogTitle className="type-heading">{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription className="type-body leading-relaxed text-muted-foreground">{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter className="-mx-6 -mb-6 rounded-b-2xl border-divider bg-transparent px-6 pb-6">
          <AlertDialogCancel render={<button type="button" className={kwButtonClass({ variant: "plain", size: "regular" })} />}>{t.in("web", "Cancel")}</AlertDialogCancel>
          <KWButton
            variant={destructive ? "destructive" : "primary"}
            size="regular"
            className={destructive ? "bg-negative-tint" : undefined}
            onClick={() => {
              onOpenChange(false)
              onConfirm()
            }}
          >
            {action}
          </KWButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
