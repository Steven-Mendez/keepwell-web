"use client"

import { useLiveQuery } from "dexie-react-hooks"
import type { ReactNode } from "react"

import {
  useAppActions,
  type RuleEditorRequest,
} from "@/components/app/app-actions"
import { AnimatedNumber } from "@/components/kw/animated-number"
import { KWButton, KWEmptyState, KWSegmented } from "@/components/kw/design"
import { OptionSelect } from "@/components/kw/pickers"
import { TransactionRow } from "@/components/kw/transaction-row"
import {
  AmountSection,
  CategorySection,
  MethodSection,
  TransferAccountsSection,
} from "@/components/movement-editor/editor-fields"
import { typeSubtitle } from "@/components/movement-editor/editor-model"
import { typeOptions } from "@/components/movement-editor/editor-state"
import {
  FieldLabel,
  FlowHeader,
  KWSwitch,
  KW_FIELD,
  KW_TEXTAREA,
  StatusPill,
} from "@/components/movement-editor/flow-parts"
import type { MovementEditorModel } from "@/components/movement-editor/use-movement-editor"
import { ConfirmDialog } from "@/components/settings/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useLedger, useTransactionDisplay } from "@/hooks/use-ledger"
import {
  Decimal,
  getTransactionContext,
  type Ledger,
  type TransactionContext,
} from "@/lib/domain"
import { formatMoney } from "@/lib/domain/format"
import { useT, type Translator } from "@/lib/i18n"
import { accountName, dayLabel } from "@/lib/presentation/display"
import { ledgerStore } from "@/lib/repositories"
import type { RecurringFrequency, RecurringRule } from "@/lib/schema"
import { cn } from "@/lib/utils"

import { frequencyText, frequencyUnit, nextDateText } from "./recurring-format"
import { useRuleEditor, type RuleEditorModel } from "./use-rule-editor"

/** Movements a rule created, listed in its detail. */
const PRODUCED_COUNT = 5

/**
 * A recurring rule, new or existing, in the movement editor's dialog: the same amount, method,
 * category and account pickers on the left; on the right what it will save, its next dates and,
 * for an existing rule, the movements it created, Pause/Resume and Delete. Full screen on phones.
 */
export function RuleEditor() {
  const { ruleEditor, closeRuleEditor } = useAppActions()
  return (
    <Dialog
      open={ruleEditor !== undefined}
      onOpenChange={(open) => (open ? undefined : closeRuleEditor())}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(92vh,880px)] flex-col gap-0 overflow-hidden rounded-[var(--radius-surface)] bg-background p-0 ring-1 ring-border max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-h-none max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none sm:max-w-5xl"
      >
        {ruleEditor ? (
          <RuleEditorBody request={ruleEditor} onClose={closeRuleEditor} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function RuleEditorBody({
  request,
  onClose,
}: {
  request: RuleEditorRequest
  onClose: () => void
}) {
  const t = useT()
  const { openAddAccount } = useAppActions()
  const context = useLiveQuery(() => getTransactionContext(ledgerStore), [])
  const ledger = useLedger()
  const rule =
    request.mode === "edit"
      ? ledger?.recurringRules.find(
          (candidate) => candidate.id === request.ruleId
        )
      : undefined
  const title = t.in(
    "recurring",
    request.mode === "edit" ? "Edit recurring" : "New recurring"
  )

  if (!context || !ledger || (request.mode === "edit" && !rule)) {
    return (
      <div className="flex min-h-64 items-center justify-center" aria-busy>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  if (context.accounts.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-(--gutter) md:p-6">
        <FlowHeader leading="close" onLeading={onClose} />
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <KWEmptyState
          icon="tabAccounts"
          title={t.in("app", "Add an account in Keepwell first.")}
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

  return (
    <RuleForm
      key={rule?.id ?? "new"}
      t={t}
      title={title}
      context={context}
      ledger={ledger}
      rule={rule}
      onClose={onClose}
    />
  )
}

function RuleForm({
  t,
  title,
  context,
  ledger,
  rule,
  onClose,
}: {
  t: Translator
  title: string
  context: TransactionContext
  ledger: Ledger
  rule: RecurringRule | undefined
  onClose: () => void
}) {
  const model = useRuleEditor(t, context, rule, onClose)
  const { editor } = model
  // A rule has no "charged by the bank": each occurrence is converted with that day's rate.
  const shown: MovementEditorModel = {
    ...editor,
    form: { ...editor.form, showsDebited: false },
  }
  const { movesBetweenAccounts } = editor.form
  // iOS offers Expense, Income and Transfer; ATM withdrawal and Card payment stay out of rules
  // (an old rule of those types keeps its own).
  const types = editor.types.filter(
    (type) =>
      type === "expense" ||
      type === "income" ||
      type === "transfer" ||
      type === editor.initialType
  )

  return (
    <>
      <form
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            void model.save()
          }
        }}
        onSubmit={(event) => {
          event.preventDefault()
          void model.save()
        }}
        className="flex min-h-0 flex-1 flex-col bg-background"
      >
        <header className="flex flex-col gap-4 border-b border-divider px-(--gutter) pt-5 pb-4 md:px-6">
          <FlowHeader
            leading="close"
            onLeading={onClose}
            trailing={
              rule?.isPaused ? (
                <StatusPill confirmed={false}>
                  {t.in("recurring", "Paused")}
                </StatusPill>
              ) : undefined
            }
          />
          <div className="flex flex-col gap-1">
            <DialogTitle className="type-title-sm text-foreground">
              {title}
            </DialogTitle>
            <DialogDescription className="type-body text-muted-foreground">
              {typeSubtitle(t, editor.fields.type)}
            </DialogDescription>
          </div>
          {types.length > 1 ? (
            <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
              <KWSegmented
                className="min-w-max"
                aria-label={t.in(
                  "createtransaction",
                  "What are you recording?"
                )}
                value={editor.fields.type}
                onChange={model.changeType}
                options={typeOptions(
                  t,
                  types,
                  undefined,
                  editor.initialType
                )}
              />
            </div>
          ) : null}
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_360px] md:overflow-hidden">
          <div className="flex flex-col gap-8 px-(--gutter) py-6 md:overflow-y-auto md:px-6">
            {movesBetweenAccounts ? (
              <TransferAccountsSection editor={shown} />
            ) : null}
            <AmountSection editor={shown} />
            {!movesBetweenAccounts ? <CategorySection editor={shown} /> : null}
            {!movesBetweenAccounts ? <MethodSection editor={shown} /> : null}
            <ScheduleSection t={t} model={model} />
            <RuleDetailsSection t={t} model={model} />
          </div>
          <RuleSummary t={t} model={model} ledger={ledger} onClose={onClose} />
        </div>
      </form>
      <ConfirmDialog
        open={model.confirmingDelete}
        onOpenChange={model.setConfirmingDelete}
        title={t.in("recurring", "Delete this recurring movement?")}
        description={t.in(
          "recurring",
          "Its drafts waiting for confirmation are deleted too. Movements already confirmed stay."
        )}
        action={t.in("recurring", "Delete")}
        destructive
        onConfirm={() => void model.remove()}
      />
    </>
  )
}

type SectionProps = { t: Translator; model: RuleEditorModel }

/** "Repeats" every N weeks, months or years; "Starts" (the first date, its time kept); an optional end. */
function ScheduleSection({ t, model }: SectionProps) {
  const { editor } = model
  const frequencies: { value: RecurringFrequency; label: string }[] = (
    ["weekly", "monthly", "yearly"] as const
  ).map((value) => ({ value, label: frequencyUnit(t, value) }))
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <FieldLabel htmlFor="rule-interval">
          {t.in("recurring", "Repeats")}
        </FieldLabel>
        <div className="flex items-center gap-2">
          <span className="type-body text-text-secondary">
            {t.in("recurring", "Every")}
          </span>
          <Input
            id="rule-interval"
            inputMode="numeric"
            autoComplete="off"
            value={model.intervalText}
            onChange={(event) =>
              model.setIntervalText(
                event.target.value.replace(/\D/g, "").slice(0, 2)
              )
            }
            aria-invalid={model.intervalValid ? undefined : true}
            className={cn(KW_FIELD, "w-16 text-center tabular-nums")}
          />
          <OptionSelect
            className="w-40 rounded-xl border-0 bg-secondary px-3.5 type-body dark:bg-secondary"
            aria-label={t.in("recurring", "Repeats")}
            value={model.frequency}
            options={frequencies}
            onChange={model.setFrequency}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="rule-start">{t.in("recurring", "Starts")}</FieldLabel>
        <Input
          id="rule-start"
          type="datetime-local"
          value={editor.fields.dateText}
          onChange={(event) => editor.update({ dateText: event.target.value })}
          className={cn(KW_FIELD, "[color-scheme:dark]")}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="rule-ends">{t.in("recurring", "Ends")}</FieldLabel>
        <div className="flex h-10 items-center justify-between gap-3 rounded-xl bg-secondary px-3.5">
          {model.hasEnd ? (
            <input
              id="rule-ends"
              type="date"
              value={model.endsText}
              onChange={(event) => model.setEndsText(event.target.value)}
              aria-invalid={model.endValid ? undefined : true}
              className="min-w-0 flex-1 bg-transparent type-body text-foreground [color-scheme:dark] outline-none aria-invalid:text-negative"
            />
          ) : (
            <span className="truncate type-caption text-muted-foreground">
              {t.in("recurring", "Last day")}
            </span>
          )}
          <KWSwitch
            checked={model.hasEnd}
            onChange={(on) => {
              model.setHasEnd(on)
              if (on && !model.endsText) model.setEndsText(model.defaultEnd())
            }}
            label={t.in("recurring", "Ends")}
          />
        </div>
      </div>
    </section>
  )
}

/** A switch row with its explanation, as the movement editor's draft switch. */
function SwitchRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-3.5 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={id} className="type-body text-foreground">
          {label}
        </label>
        {description ? (
          <span className="type-caption text-muted-foreground">
            {description}
          </span>
        ) : null}
      </div>
      <KWSwitch id={id} checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

/** Name, the subscription and auto-record switches, and the note copied to each movement. */
function RuleDetailsSection({ t, model }: SectionProps) {
  const { editor } = model
    return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="editor-description">
          {t.in("recurring", "Name")}
        </FieldLabel>
        <Input
          id="editor-description"
          value={editor.fields.description}
          onChange={(event) =>
            editor.update({ description: event.target.value })
          }
          placeholder={t.in("recurring", "Rent, Netflix…")}
          autoComplete="off"
          className={KW_FIELD}
        />
      </div>
      {editor.form.kind === "expense" ? (
        <SwitchRow
          id="rule-subscription"
          label={t.in("recurring", "Subscription")}
          checked={model.isSubscription}
          onChange={model.setSubscription}
        />
      ) : null}
      <SwitchRow
        id="rule-auto"
        label={t.in("recurring", "Record automatically")}
        description={t.in(
          "recurring",
          "Off: it waits as a draft for you to confirm."
        )}
        checked={model.autoConfirm}
        onChange={model.setAutoConfirm}
      />
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="editor-note">
          {t.in("recurring", "Note")}
        </FieldLabel>
        <Textarea
          id="editor-note"
          value={editor.fields.note}
          onChange={(event) => editor.update({ note: event.target.value })}
          placeholder={t.in("recurring", "Optional")}
          rows={2}
          className={KW_TEXTAREA}
        />
      </div>
    </section>
  )
}

/** The right column: what it saves, its next dates, the movements it created, and the actions. */
function RuleSummary({
  t,
  model,
  ledger,
  onClose,
}: SectionProps & { ledger: Ledger; onClose: () => void }) {
  const { editor, rule } = model
  const { fields, form, review } = editor
  const display = useTransactionDisplay(ledger)
  const { showDetail } = useAppActions()
  const produced = rule
    ? ledger.transactions
        .filter((transaction) => transaction.recurringId === rule.id)
        .slice(0, PRODUCED_COUNT)
    : []
  const method = form.movesBetweenAccounts
    ? [form.sourceAccount, form.destinationAccount]
        .map((account) => (account ? accountName(account) : "—"))
        .join(" → ")
    : (editor.sourceTitleText ?? "—")
  return (
    <aside className="flex flex-col gap-5 border-t border-divider px-(--gutter) py-6 md:overflow-y-auto md:border-t-0 md:border-l md:px-6">
      <div className="flex flex-col items-center gap-1 rounded-2xl bg-card px-4 pt-5 pb-4 text-center">
        <span className="type-label text-text-secondary">
          {frequencyText(t, model.frequency, model.interval)}
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
        <span className="max-w-full truncate type-body font-semibold text-foreground">
          {form.draft.description}
        </span>
        <span className="max-w-full truncate type-caption text-muted-foreground">
          {[form.categoryLabel, method].filter(Boolean).join(" · ")}
        </span>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="type-label text-muted-foreground">
          {t.in("recurring", "Next dates")}
        </h3>
        <ol className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card">
          {model.nextDates.length === 0 ? (
            <li className="px-4 py-3 type-caption text-muted-foreground">
              {t.in("recurring", rule?.isPaused ? "Paused" : "Ended")}
            </li>
          ) : (
            model.nextDates.map((date) => (
              <li
                key={date.toISOString()}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-2.5",
                  rule?.isPaused && "opacity-55"
                )}
              >
                <span className="type-body text-foreground">
                  {nextDateText(t, date)}
                </span>
                <span className="type-caption text-muted-foreground">
                  {date.toLocaleDateString(t.locale, { weekday: "long" })}
                </span>
              </li>
            ))
          )}
        </ol>
      </section>

      {rule && display && produced.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="type-label text-muted-foreground">
            {t.in("recurring", "Recorded")}
          </h3>
          <div className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card">
            {produced.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                display={display}
                dateLabel={dayLabel(t, new Date(transaction.date))}
                onSelect={() => {
                  onClose()
                  showDetail(transaction.id)
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {editor.error ? (
          <p role="alert" className="type-caption text-negative">
            {editor.error}
          </p>
        ) : null}
        <KWButton
          type="submit"
          fill
          disabled={!model.canSave}
          shortcut="⌘↵"
          className="justify-between"
        >
          {t.in("recurring", "Save")}
        </KWButton>
        {rule ? (
          <div className="grid grid-cols-2 gap-2">
            <KWButton
              variant="surface"
              fill
              disabled={model.busy}
              onClick={() => void model.togglePause()}
            >
              {t.in("recurring", rule.isPaused ? "Resume" : "Pause")}
            </KWButton>
            <KWButton
              variant="destructive"
              icon="trash"
              fill
              className="bg-negative-tint"
              disabled={model.busy}
              onClick={() => model.setConfirmingDelete(true)}
            >
              {t.in("recurring", "Delete")}
            </KWButton>
          </div>
        ) : null}
        <KWButton variant="plain" fill onClick={onClose}>
          {t.in("web", "Cancel")}
        </KWButton>
      </div>
    </aside>
  )
}
