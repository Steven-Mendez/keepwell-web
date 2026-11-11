"use client"

import { AnimatedNumber } from "@/components/kw/animated-number"
import { KWButton } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { OptionSelect } from "@/components/kw/pickers"
import { frequencyText } from "@/components/recurring/recurring-format"
import { Decimal } from "@/lib/domain"
import { formatMoney } from "@/lib/domain/format"
import { accountName } from "@/lib/presentation/display"
import { cn } from "@/lib/utils"

import { accountThumbnail, reviewTitle, type Thumbnail } from "./editor-model"
import {
  balanceAfter,
  primaryLabel,
  reviewRows,
  sourceCaptionKey,
  sourceThumbnail,
} from "./editor-state"
import { FieldLabel, StatusPill } from "./flow-parts"
import { MethodThumbnail } from "./pickers"
import {
  useCreateTransactionT,
  type MovementEditorModel,
  type RepeatChoice,
} from "./use-movement-editor"

// The editor's right column: the iOS review step, kept live beside the form.

type ReviewProps = { editor: MovementEditorModel }

export function EditorReview({
  editor,
  onClose,
}: ReviewProps & { onClose: () => void }) {
  const { t } = useCreateTransactionT()
  const { existing, fields, form } = editor
  return (
    <aside className="flex flex-col gap-4 border-t border-divider px-(--gutter) py-6 md:overflow-y-auto md:border-t-0 md:border-l md:px-6">
      <ReceiptTicket editor={editor} />
      <ReviewParties editor={editor} />
      {existing ? null : <RepeatField editor={editor} />}

      {fields.isDraft ? (
        <p className="rounded-xl bg-pending-tint px-3 py-2 type-caption text-pending">
          {t.in(
            "web",
            "Saved as a draft, it doesn't affect balances until you confirm it."
          )}
        </p>
      ) : null}
      {existing && form.rate.second !== form.rate.principal ? (
        <p className="type-caption-sm text-muted-foreground">
          {t.in("createtransaction", "Edits keep the rate this transaction was logged with.")}
        </p>
      ) : null}

      <EditorActions editor={editor} onClose={onClose} />
    </aside>
  )
}

/** The iOS receipt ticket, live: what will be saved, on the `surface` card. */
function ReceiptTicket({ editor }: ReviewProps) {
  const { t, ct } = useCreateTransactionT()
  const { fields, form, review } = editor
  const rows = reviewRows(
    t,
    ct,
    form,
    review,
    fields.note,
    editor.sourceTitleText
  )
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-card px-4 pt-5 pb-2 text-center">
      <span className="type-label text-text-secondary">
        {reviewTitle(t, fields.type)}
      </span>
      <AnimatedNumber
        value={formatMoney({
          amount:
            review.hasAmount && form.amount ? form.amount : new Decimal(0),
          currency: fields.currency,
        })}
        className={cn(
          "max-w-full overflow-hidden type-amount-lg",
          form.kind === "income" ? "text-positive" : "text-foreground"
        )}
      />
      {/* Until a category or text gives it one, the expense has no description to show yet. */}
      {form.movesBetweenAccounts ||
      fields.description.trim() ||
      form.categoryLabel ? (
        <span className="max-w-full truncate type-body font-semibold text-foreground">
          {form.draft.description}
        </span>
      ) : null}
      <span className="pt-1 pb-3">
        <StatusPill confirmed={!fields.isDraft}>
          {ct(fields.isDraft ? "Draft" : "Confirmed")}
        </StatusPill>
      </span>
      <dl className="w-full divide-y divide-divider border-t border-divider text-left">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-3 py-2.5"
          >
            <dt className="shrink-0 type-caption text-muted-foreground">
              {row.label}
            </dt>
            <dd className="min-w-0 truncate text-right type-caption text-foreground tabular-nums">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** "Repeat": a new movement can start a recurring rule, whose next ones wait as drafts. */
function RepeatField({ editor }: ReviewProps) {
  const { t } = useCreateTransactionT()
  const options: { value: RepeatChoice; label: string }[] = [
    { value: "none", label: t.in("createtransaction", "repeat.none") },
    ...(["weekly", "monthly", "yearly"] as const).map((frequency) => ({
      value: frequency,
      label: frequencyText(t, frequency, 1),
    })),
  ]
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor="editor-repeat">{t.in("createtransaction", "Repeat")}</FieldLabel>
      <OptionSelect
        id="editor-repeat"
        className="rounded-xl border-0 bg-secondary px-3.5 type-body dark:bg-secondary"
        value={editor.repeat}
        options={options}
        onChange={editor.setRepeat}
      />
    </div>
  )
}

/** Who pays and, for a movement between accounts, who receives, with the balances after. */
function ReviewParties({ editor }: ReviewProps) {
  const { ct } = useCreateTransactionT()
  const { context, fields, form, preview, review } = editor
  const { sourceAccount, destinationAccount } = form
  const after = (balances: Parameters<typeof balanceAfter>[1]) =>
    balanceAfter(ct, balances, fields.currency, review.hasAmount)
  return (
    <div className="flex flex-col gap-2">
      {sourceAccount ? (
        <Party
          caption={ct(sourceCaptionKey(form.kind))}
          title={
            form.movesBetweenAccounts
              ? accountName(sourceAccount)
              : (editor.sourceTitleText ?? accountName(sourceAccount))
          }
          detail={after(preview?.sourceAfter)}
          thumbnail={sourceThumbnail(fields.source, sourceAccount, context)}
        />
      ) : null}
      {form.movesBetweenAccounts && destinationAccount ? (
        <>
          <KWIcon
            name="arrowDown"
            size={16}
            className="mx-auto text-muted-foreground"
          />
          <Party
            caption={ct("To")}
            title={accountName(destinationAccount)}
            detail={after(preview?.destinationAfter)}
            thumbnail={accountThumbnail(destinationAccount, context.cards)}
          />
        </>
      ) : null}
    </div>
  )
}

/** The error, the save button (⌘↵) and cancel, pinned to the bottom of the column. */
function EditorActions({
  editor,
  onClose,
}: ReviewProps & { onClose: () => void }) {
  const { t, ct } = useCreateTransactionT()
  return (
    <div className="mt-auto flex flex-col gap-2 pt-2">
      {editor.error ? (
        <p role="alert" className="type-caption text-negative">
          {editor.error}
        </p>
      ) : null}
      <KWButton
        type="submit"
        fill
        disabled={!editor.review.canSave}
        shortcut="⌘↵"
        className="justify-between"
      >
        {primaryLabel(t, ct, editor.existing, editor.fields)}
      </KWButton>
      <KWButton variant="plain" fill onClick={onClose}>
        {t.in("web", "Cancel")}
      </KWButton>
    </div>
  )
}

function Party({
  caption,
  title,
  detail,
  thumbnail,
}: {
  caption: string
  title: string
  detail?: string | undefined
  thumbnail: Thumbnail
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
      <MethodThumbnail thumbnail={thumbnail} />
      <div className="flex min-w-0 flex-col">
        <span className="type-caption-sm text-muted-foreground">{caption}</span>
        <span className="truncate type-body font-semibold text-foreground">
          {title}
        </span>
        {detail ? (
          <span className="truncate type-caption-sm text-muted-foreground tabular-nums">
            {detail}
          </span>
        ) : null}
      </div>
    </div>
  )
}
