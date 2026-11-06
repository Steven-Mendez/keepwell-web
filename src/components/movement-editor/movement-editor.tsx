"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { WalletCardsIcon } from "lucide-react"

import { useAppActions, type EditorRequest } from "@/components/app/app-actions"
import { EmptyState } from "@/components/kw/primitives"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { getTransactionContext } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { ledgerStore } from "@/lib/repositories"

import { EditorForm } from "./editor-form"

/**
 * Log or edit a movement (iOS CreateTransaction flow) in one desktop dialog: the form on the left,
 * the live review on the right. Full screen on phones. Opened through `useAppActions().openEditor`.
 */
export function MovementEditor() {
  const { editor, closeEditor } = useAppActions()
  return (
    <Dialog open={editor !== undefined} onOpenChange={(open) => (open ? undefined : closeEditor())}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(92vh,860px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-h-none max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none"
      >
        {editor ? <EditorBody request={editor} onClose={closeEditor} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function EditorBody({ request, onClose }: { request: EditorRequest; onClose: () => void }) {
  const t = useT()
  const { openAddAccount } = useAppActions()
  // Live: a category created inside the flow, or a balance changed in another tab, shows at once.
  const context = useLiveQuery(() => getTransactionContext(ledgerStore), [])

  if (!context) {
    return (
      <div className="flex min-h-64 items-center justify-center" aria-busy>
        <DialogTitle className="sr-only">{t.in("app", "New transaction")}</DialogTitle>
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  if (context.accounts.length === 0) {
    return (
      <div className="p-6">
        <DialogTitle className="sr-only">{t.in("app", "New transaction")}</DialogTitle>
        <EmptyState icon={WalletCardsIcon} title={t.in("app", "Add an account in Keepwell first.")} description={t.in("web", "Add an account or card first to log transactions.")}>
          <Button
            onClick={() => {
              onClose()
              openAddAccount()
            }}
          >
            {t.in("accounts", "Add account or card")}
          </Button>
        </EmptyState>
      </div>
    )
  }

  const key = request.mode === "edit" ? `edit:${request.transaction.id}` : `create:${request.type ?? ""}:${request.accountId ?? ""}`
  return <EditorForm key={key} request={request} context={context} onClose={onClose} />
}
