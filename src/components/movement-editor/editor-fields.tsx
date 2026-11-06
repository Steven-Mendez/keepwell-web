"use client"

import { Input } from "@/components/ui/input"
import { KWSegmented } from "@/components/kw/design"
import { Textarea } from "@/components/ui/textarea"
import { formatAmountInput } from "@/lib/domain"
import { cn } from "@/lib/utils"

import {
  amountQuestion,
  categoryQuestion,
  descriptionPlaceholder,
  destinationAccounts,
  destinationQuestion,
  methodGroups,
  sourceAccounts,
  sourceQuestion,
} from "./editor-model"
import { accountRow, availableText } from "./editor-state"
import { FieldLabel, KWSwitch, KW_FIELD, KW_TEXTAREA } from "./flow-parts"
import { NewCategoryDialog } from "./new-category-dialog"
import { AccountPicker, CategoryPicker, MethodPicker } from "./pickers"
import {
  useCreateTransactionT,
  type MovementEditorModel,
} from "./use-movement-editor"

// The editor's left column, one component per step of the iOS CreateTransaction flow.

type SectionProps = { editor: MovementEditorModel }

/** Transfers, withdrawals and card payments: the account it leaves and the one it reaches. */
export function TransferAccountsSection({ editor }: SectionProps) {
  const { t, ct } = useCreateTransactionT()
  const { context, fields, form } = editor
  const describe = (account: (typeof context.accounts)[number]) =>
    accountRow(t, account, context)
  const destinations = destinationAccounts(
    fields.type,
    context,
    form.sourceAccount?.id
  )
  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-2">
        <h3 className="px-1 type-heading text-foreground">
          {sourceQuestion(t, fields.type)}
        </h3>
        <AccountPicker
          accounts={sourceAccounts(fields.type, context)}
          value={form.sourceAccount?.id}
          onChange={editor.chooseSourceAccount}
          describe={describe}
        />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="px-1 type-heading text-foreground">
          {destinationQuestion(t, fields.type)}
        </h3>
        {destinations.length === 0 ? (
          <p className="rounded-2xl bg-card px-4 py-3 type-caption text-muted-foreground">
            {ct("No account can receive it from this one.")}
          </p>
        ) : (
          <AccountPicker
            accounts={destinations}
            value={fields.destinationId}
            onChange={(id) => editor.update({ destinationId: id })}
            describe={describe}
          />
        )}
      </div>
    </section>
  )
}

/** The amount card: the figure, its currency, what's available and the conversion. */
export function AmountSection({ editor }: SectionProps) {
  const { t, ct } = useCreateTransactionT()
  const { fields, form, review, update } = editor
  const available = availableText(ct, form, review, editor.sourceTitleText)
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl bg-card px-4 py-6 text-center">
      <label htmlFor="editor-amount" className="type-title-sm text-foreground">
        {amountQuestion(t, fields.type)}
      </label>
      <input
        id="editor-amount"
        autoFocus
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={fields.amountText}
        onChange={(event) => {
          update({ amountText: event.target.value })
          editor.setError(undefined)
        }}
        onBlur={() => {
          const formatted = formatAmountInput(fields.amountText)
          if (formatted) update({ amountText: formatted })
        }}
        onKeyDown={editor.onAmountKeyDown}
        aria-invalid={
          fields.amountText.trim() !== "" && form.amount === undefined
            ? true
            : undefined
        }
        className={cn(
          "w-full min-w-0 bg-transparent text-center type-display tabular-nums outline-none placeholder:text-text-faint aria-invalid:text-negative",
          form.kind === "income" ? "text-positive" : "text-foreground"
        )}
      />
      {form.currencies.length > 1 ? (
        <KWSegmented
          style="accent"
          aria-label={t.in("onboarding", "Currency")}
          value={fields.currency}
          onChange={(currency) => update({ currency })}
          options={form.currencies.map((code) => ({
            value: code,
            title: code,
          }))}
        />
      ) : (
        <span className="type-label text-text-secondary">
          {fields.currency}
        </span>
      )}
      {available ? (
        <p
          className={cn(
            "type-label font-normal tabular-nums",
            review.exceedsAvailable ? "text-pending" : "text-muted-foreground"
          )}
        >
          {available}
        </p>
      ) : null}
      {review.conversionLine ? (
        <p className="type-caption-sm text-muted-foreground tabular-nums">
          {review.conversionLine}
        </p>
      ) : null}
      {form.showsDebited ? <DebitedField editor={editor} /> : null}
    </section>
  )
}

/** "USD charged by the bank", for when the bank converted at its own rate. */
function DebitedField({ editor }: SectionProps) {
  const { ct } = useCreateTransactionT()
  const { fields, form, review, update } = editor
  return (
    <div className="flex w-full max-w-sm flex-col gap-1.5 text-left">
      <FieldLabel htmlFor="editor-debited">
        {ct("%@ charged by the bank", form.principal)}
      </FieldLabel>
      <Input
        id="editor-debited"
        inputMode="decimal"
        autoComplete="off"
        placeholder={ct("Optional · if a different rate was used")}
        value={fields.debitedText}
        onChange={(event) => update({ debitedText: event.target.value })}
        onBlur={() => {
          const formatted = formatAmountInput(fields.debitedText)
          if (formatted) update({ debitedText: formatted })
        }}
        aria-invalid={form.debitedInvalid ? true : undefined}
        className={cn(KW_FIELD, "tabular-nums")}
      />
      {review.bankRateLine ? (
        <span className="px-1 type-caption-sm text-muted-foreground tabular-nums">
          {review.bankRateLine}
        </span>
      ) : null}
    </div>
  )
}

/** Expenses and incomes: the category, with a new one created in place. */
export function CategorySection({ editor }: SectionProps) {
  const { t } = useCreateTransactionT()
  const { context, fields, form, update } = editor
  return (
    <section className="flex flex-col gap-3">
      <h3 className="px-1 type-heading text-foreground">
        {categoryQuestion(t, form.kind)}
      </h3>
      <CategoryPicker
        categories={form.categories}
        usage={context.categoryUsage}
        value={fields.categoryId}
        onChange={(id) => {
          update({ categoryId: id })
          editor.setError(undefined)
        }}
        onCreate={() => editor.setCreatingCategory(true)}
      />
      <NewCategoryDialog
        kind={form.kind}
        open={editor.creatingCategory}
        onOpenChange={editor.setCreatingCategory}
        onCreated={(created) => update({ categoryId: created.id })}
      />
    </section>
  )
}

/** Expenses and incomes: the card, transfer or cash it moved through. */
export function MethodSection({ editor }: SectionProps) {
  const { t, ct } = useCreateTransactionT()
  const { context, fields, form } = editor
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5 px-1">
        <h3 className="type-heading text-foreground">
          {sourceQuestion(t, fields.type)}
        </h3>
        <p className="type-caption text-muted-foreground">
          {ct(
            form.kind === "income"
              ? "The method decides which account increases."
              : "The method decides which account is charged."
          )}
        </p>
      </div>
      <MethodPicker
        groups={methodGroups(
          t,
          context,
          form.kind,
          fields.currency,
          editor.existing ? fields.source : undefined
        )}
        value={fields.source}
        onChange={(source) => editor.update({ source })}
      />
    </section>
  )
}

/** Description, date, draft and note. */
export function DetailsSection({ editor }: SectionProps) {
  const { t, ct } = useCreateTransactionT()
  const { fields, form, update } = editor
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <FieldLabel htmlFor="editor-description">
          {ct("Description")}
        </FieldLabel>
        <Input
          id="editor-description"
          value={fields.description}
          onChange={(event) => update({ description: event.target.value })}
          placeholder={descriptionPlaceholder(
            t,
            fields.type,
            form.categoryLabel
          )}
          autoComplete="off"
          className={KW_FIELD}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="editor-date">{ct("Date")}</FieldLabel>
        <Input
          id="editor-date"
          type="datetime-local"
          value={fields.dateText}
          onChange={(event) => update({ dateText: event.target.value })}
          className={cn(KW_FIELD, "[color-scheme:dark]")}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="editor-draft">{ct("Save as draft")}</FieldLabel>
        <div className="flex h-10 items-center justify-between gap-3 rounded-xl bg-secondary px-3.5">
          <span className="truncate type-caption text-muted-foreground">
            {t.in("transactions", "Drafts · they don't affect balances")}
          </span>
          <KWSwitch
            id="editor-draft"
            checked={fields.isDraft}
            onChange={(isDraft) => update({ isDraft })}
            label={ct("Save as draft")}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <FieldLabel htmlFor="editor-note">{ct("Note")}</FieldLabel>
        <Textarea
          id="editor-note"
          value={fields.note}
          onChange={(event) => update({ note: event.target.value })}
          placeholder={ct("Add a note")}
          rows={2}
          className={KW_TEXTAREA}
        />
      </div>
    </section>
  )
}
