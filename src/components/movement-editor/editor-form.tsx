"use client"

import type { EditorRequest } from "@/components/app/app-actions"
import { KWSegmented } from "@/components/kw/design"
import { DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { TransactionContext } from "@/lib/domain"

import {
  AmountSection,
  CategorySection,
  DetailsSection,
  MethodSection,
  TagsSection,
  TransferAccountsSection,
} from "./editor-fields"
import { typeSubtitle, typeTitle } from "./editor-model"
import { EditorReview } from "./editor-review"
import { SavedReceipt } from "./saved-receipt"
import { typeOptions } from "./editor-state"
import { FlowHeader, StatusPill } from "./flow-parts"
import {
  useCreateTransactionT,
  useMovementEditor,
  type MovementEditorModel,
} from "./use-movement-editor"

export function EditorForm({
  request,
  context,
  onClose,
  onLogAnother,
}: {
  request: EditorRequest
  context: TransactionContext
  onClose: () => void
  /** Starts a fresh movement of the same kind from the receipt. */
  onLogAnother: () => void
}) {
  const { t, ct } = useCreateTransactionT()
  const editor = useMovementEditor(request, context, onClose)
  const { movesBetweenAccounts } = editor.form

  if (editor.saved) {
    return (
      <SavedReceipt
        saved={editor.saved}
        context={context}
        onLogAnother={onLogAnother}
        onClose={onClose}
      />
    )
  }

  return (
    <form
      onKeyDown={editor.onKeyDown}
      onSubmit={(event) => {
        event.preventDefault()
        void editor.save()
      }}
      className="flex min-h-0 flex-1 flex-col bg-background"
    >
      <header className="flex flex-col gap-4 border-b border-divider px-(--gutter) pt-5 pb-4 md:px-6">
        <EditorTitle editor={editor} onClose={onClose} />
        {editor.types.length > 1 ? (
          <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
            <KWSegmented
              className="min-w-max"
              aria-label={ct("What are you recording?")}
              value={editor.fields.type}
              onChange={editor.changeType}
              options={typeOptions(
                t,
                editor.types,
                editor.existing,
                editor.initialType
              )}
            />
          </div>
        ) : null}
      </header>

      <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_360px] md:overflow-hidden">
        <div className="flex flex-col gap-8 px-(--gutter) py-6 md:overflow-y-auto md:px-6">
          {movesBetweenAccounts ? (
            <TransferAccountsSection editor={editor} />
          ) : null}
          <AmountSection editor={editor} />
          {!movesBetweenAccounts ? <CategorySection editor={editor} /> : null}
          {!movesBetweenAccounts ? <MethodSection editor={editor} /> : null}
          <DetailsSection editor={editor} />
          {!movesBetweenAccounts ? <TagsSection editor={editor} /> : null}
        </div>

        <EditorReview editor={editor} onClose={onClose} />
      </div>
    </form>
  )
}

/** Close, the draft pill, and the title with what the movement type covers. */
function EditorTitle({
  editor,
  onClose,
}: {
  editor: MovementEditorModel
  onClose: () => void
}) {
  const { t, ct } = useCreateTransactionT()
  const { existing, fields } = editor
  return (
    <>
      <FlowHeader
        leading="close"
        onLeading={onClose}
        trailing={
          fields.isDraft ? (
            <StatusPill confirmed={false}>{ct("Draft")}</StatusPill>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-1">
        <DialogTitle className="type-title-sm text-foreground">
          {existing
            ? t.in("createtransaction", "Edit transaction")
            : typeTitle(t, fields.type)}
        </DialogTitle>
        <DialogDescription className="type-body text-muted-foreground">
          {typeSubtitle(t, fields.type)}
        </DialogDescription>
      </div>
    </>
  )
}
