"use client"

import { useMemo, useState, type CSSProperties } from "react"

import {
  KWButton,
  KWCircleButton,
  KWEmptyState,
  KWGroupedCard,
  KWLargeTitleHeader,
} from "@/components/kw/design"
import { AnimatedList, ListItem, SpringFill } from "@/components/kw/motion"
import { CategoryBadge, Page, Surface } from "@/components/kw/primitives"
import { SkeletonList } from "@/components/kw/skeletons"
import { BALANCE_MASK, useHiddenBalances } from "@/hooks/use-hidden-balances"
import { useLedgerLoad } from "@/hooks/use-ledger"
import { orderedGoals, savingsGoalProgress } from "@/lib/domain"
import { formatAmount } from "@/lib/domain/format"
import { useT, type Translator } from "@/lib/i18n"
import type { SavingsGoal } from "@/lib/schema"
import { cn } from "@/lib/utils"

import { GoalEditorDialog, type GoalEditorTarget } from "./goal-editor-dialog"
import { DEFAULT_GOAL_SYMBOL, goalBadge, goalMoney, goalStatus } from "./goal-format"
import { GoalMoneyDialog, type GoalMoneyMode } from "./goal-money-dialog"

const TONE_CLASS = {
  positive: "text-positive",
  pending: "text-pending",
  neutral: "text-muted-foreground",
} as const

/**
 * Savings goals (Monzo Pots, Revolut Vaults): each with how much is set aside, its bar and what to put
 * away each month to arrive on time. The money is only tracked here; accounts don't move.
 */
export function GoalsScreen() {
  const t = useT()
  const { ledger, failed } = useLedgerLoad()
  const [hidden, toggleHidden] = useHiddenBalances()
  const [now] = useState(() => new Date())
  const [editor, setEditor] = useState<GoalEditorTarget>()
  const [money, setMoney] = useState<{ goal: SavingsGoal; mode: GoalMoneyMode }>()
  const goals = useMemo(() => (ledger ? orderedGoals(ledger.savingsGoals, now) : undefined), [ledger, now])
  const add = () => setEditor({ mode: "create" })

  return (
    <Page>
      <KWLargeTitleHeader
        title={t.in("goals", "Savings goals")}
        trailing={
          <>
            <KWCircleButton
              icon={hidden ? "eye" : "eyeOff"}
              label={t.in("goals", hidden ? "Show amounts" : "Hide amounts")}
              onClick={toggleHidden}
            />
            <KWButton icon="plus" onClick={add}>
              {t.in("goals", "New goal")}
            </KWButton>
          </>
        }
      />
      {failed ? (
        <p className="type-body text-muted-foreground">{t.in("goals", "We couldn't load your goals.")}</p>
      ) : !goals ? (
        <SkeletonList rows={3} />
      ) : goals.length === 0 ? (
        <KWGroupedCard>
          <KWEmptyState
            icon="wallet"
            title={t.in("goals", "No goals yet")}
            message={t.in(
              "goals",
              "Save for a trip, an emergency fund or anything else, and see how much to set aside each month."
            )}
            action={
              <KWButton icon="plus" size="large" onClick={add}>
                {t.in("goals", "New goal")}
              </KWButton>
            }
          />
        </KWGroupedCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatedList>
          {goals.map((goal) => (
            <ListItem key={goal.id}>
              <GoalCard
                t={t}
                goal={goal}
                now={now}
                hidden={hidden}
                onEdit={() => setEditor({ mode: "edit", goal })}
                onMoney={(mode) => setMoney({ goal, mode })}
              />
            </ListItem>
          ))}
          </AnimatedList>
        </div>
      )}
      {editor && ledger ? (
        <GoalEditorDialog
          key={editor.mode === "edit" ? editor.goal.id : "new"}
          t={t}
          target={editor}
          currencies={ledger.settings.currencies}
          onClose={() => setEditor(undefined)}
        />
      ) : null}
      {money ? (
        <GoalMoneyDialog
          key={`${money.goal.id}-${money.mode}`}
          t={t}
          goal={money.goal}
          mode={money.mode}
          onClose={() => setMoney(undefined)}
        />
      ) : null}
    </Page>
  )
}

function GoalCard({
  t,
  goal,
  now,
  hidden,
  onEdit,
  onMoney,
}: {
  t: Translator
  goal: SavingsGoal
  now: Date
  hidden: boolean
  onEdit: () => void
  onMoney: (mode: GoalMoneyMode) => void
}) {
  const progress = savingsGoalProgress(goal, now)
  const money = hidden ? () => BALANCE_MASK : goalMoney(goal)
  const status = goalStatus(t, goal, progress, money)
  const percent = Math.round(Math.min(progress.fraction.toNumber(), 1) * 100)
  return (
    <Surface className="flex h-full flex-col gap-4 p-4">
      <button
        type="button"
        onClick={onEdit}
        className="-m-2 flex items-center gap-3 rounded-xl p-2 text-left outline-none hover:bg-secondary/50 focus-visible:bg-secondary/50"
      >
        <CategoryBadge category={goalBadge(goal)} symbol={goal.icon ?? DEFAULT_GOAL_SYMBOL} />
        <span className="min-w-0 flex-1 truncate type-heading">{goal.name}</span>
        <span className="type-label text-muted-foreground tabular-nums">{percent}%</span>
      </button>
      <div className="flex flex-col gap-2">
        <span className="type-body tabular-nums">
          {t.in(
            "goals",
            "%@ of %@",
            hidden ? BALANCE_MASK : formatAmount(goal.saved, goal.target.currency),
            hidden ? BALANCE_MASK : formatAmount(goal.target.amount, goal.target.currency)
          )}
        </span>
        <span
          className="h-2 overflow-hidden rounded-full bg-secondary"
          style={{ "--fill": progress.isReached ? "var(--positive)" : "var(--accent)" } as CSSProperties}
          role="progressbar"
          aria-label={goal.name}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <SpringFill fraction={progress.fraction.toNumber()} className="bg-(--fill)" />
        </span>
        <span className={cn("type-caption", TONE_CLASS[status.tone])}>{status.text}</span>
      </div>
      <div className="mt-auto flex gap-2">
        <KWButton icon="plus" size="small" onClick={() => onMoney("add")}>
          {t.in("goals", "Add money")}
        </KWButton>
        <KWButton
          variant="surface"
          size="small"
          disabled={progress.saved.isZero()}
          onClick={() => onMoney("withdraw")}
        >
          {t.in("goals", "Withdraw")}
        </KWButton>
      </div>
    </Surface>
  )
}
