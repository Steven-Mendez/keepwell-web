"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { useEffect, useState } from "react"

import { useAppActions, type EditorRequest } from "@/components/app/app-actions"
import { KWButton, KWEmptyState } from "@/components/kw/design"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { getTransactionContext } from "@/lib/domain"
import { useT } from "@/lib/i18n"
import { ledgerStore } from "@/lib/repositories"

import { EditorForm } from "./editor-form"
import { FlowHeader } from "./flow-parts"

/**
 * Log or edit a movement (iOS CreateTransaction flow) in one desktop dialog: the form on the left,
 * the live review on the right. Full screen on phones. Opened through `useAppActions().openEditor`.
 */
export function MovementEditor() {
  const { editor, closeEditor } = useAppActions()
  return (
    <Dialog open={editor !== undefined} onOpenChange={(open) => (open ? undefined : closeEditor())}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(92vh,880px)] flex-col gap-0 overflow-hidden rounded-[var(--radius-surface)] bg-background p-0 ring-1 ring-border sm:max-w-5xl max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-h-none max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none"
      >
        {editor ? <EditorBody request={editor} onClose={closeEditor} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function EditorBody({ request, onClose }: { request: EditorRequest; onClose: () => void }) {
  const t = useT()
  const { openAddAccount } = useAppActions()
  // "Log another" on the receipt remounts the form on a fresh movement.
  const [round, setRound] = useState(0)
  const [attempt, setAttempt] = useState(0)
  // Live: a category created inside the flow, or a balance changed in another tab, shows at once.
  // A failure is caught and shown, never left as an endless spinner.
  const loaded = useLiveQuery(async () => {
    try {
      return { context: await getTransactionContext(ledgerStore) }
    } catch (error) {
      console.error("[Keepwell] couldn't load the movement editor", error)
      return { error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }
    }
  }, [attempt])
  // Some browsers leave an IndexedDB read hanging instead of failing; after a while say so.
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (loaded) return
    const timer = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(timer)
  }, [loaded, attempt])

  if (!loaded?.context) {
    const problem = loaded?.error ?? (slow ? t.in("web", "This is taking too long.") : undefined)
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 p-6 text-center" aria-busy={!problem}>
        <DialogTitle className="sr-only">{t.in("app", "New transaction")}</DialogTitle>
        {problem ? (
          <>
            <p className="type-body text-foreground">{t.in("web", "Couldn't open the editor.")}</p>
            <p className="max-w-md type-caption break-words text-muted-foreground">{problem}</p>
            <div className="flex gap-3">
              <KWButton variant="secondary" onClick={onClose}>
                {t.in("web", "Close")}
              </KWButton>
              <KWButton
                onClick={() => {
                  setSlow(false)
                  setAttempt((value) => value + 1)
                }}
              >
                {t.in("web", "Try again")}
              </KWButton>
            </div>
          </>
        ) : (
          <Spinner className="size-6 text-muted-foreground" />
        )}
      </div>
    )
  }
  const context = loaded.context

  if (context.accounts.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-(--gutter) md:p-6">
        <FlowHeader leading="close" onLeading={onClose} />
        <DialogTitle className="sr-only">{t.in("app", "New transaction")}</DialogTitle>
        <KWEmptyState
          icon="tabAccounts"
          title={t.in("app", "Add an account in Keepwell first.")}
          message={t.in("web", "Add an account or card first to log transactions.")}
          action={
            <KWButton
              icon="addCard"
              onClick={() => {
                onClose()
                openAddAccount()
              }}
            >
              {t.in("accounts", "Add account or card")}
            </KWButton>
          }
        />
      </div>
    )
  }

  const key = request.mode === "edit" ? `edit:${request.transaction.id}` : `create:${request.type ?? ""}:${request.accountId ?? ""}:${round}`
  return <EditorForm key={key} request={request} context={context} onClose={onClose} onLogAnother={() => setRound((value) => value + 1)} />
}
