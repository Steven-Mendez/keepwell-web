"use client"

import { KWButton, KWSection } from "@/components/kw/design"
import { toast } from "@/components/ui/toast"
import {
  deleteRecurringRule,
  setRecurringRulePaused,
  type Ledger,
} from "@/lib/domain"
import type { Translator } from "@/lib/i18n"
import { ledgerStore } from "@/lib/repositories"

/**
 * Recurring payments an assistant set up through MCP wait paused until the person confirms them
 * here (ADR 0007 in keepwell-api). Confirming starts them; discarding deletes them.
 */
export function AssistantRulesSection({
  t,
  ledger,
}: {
  t: Translator
  ledger: Ledger
}) {
  const proposed = ledger.recurringRules.filter(
    (rule) => rule.source === "mcp" && rule.isPaused
  )
  if (proposed.length === 0) return null

  const act = (work: Promise<void>) =>
    work.catch(() =>
      toast.add({
        title: t.in("web", "Couldn't save the change. Try again."),
        type: "error",
      })
    )

  return (
    <KWSection title={t.in("web", "Proposed by Claude")}>
      <div className="flex flex-col divide-y divide-border rounded-2xl bg-card">
        {proposed.map((rule) => (
          <div key={rule.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate type-body font-semibold">
                {rule.name}
              </span>
              <span className="truncate type-caption text-muted-foreground">
                {`${rule.amount} ${rule.currency} · ${t.in("web", rule.frequency === "weekly" ? "Weekly" : rule.frequency === "yearly" ? "Yearly" : "Monthly")}`}
              </span>
            </div>
            <KWButton
              size="mini"
              variant="secondary"
              onClick={() =>
                void act(deleteRecurringRule(ledgerStore, rule.id))
              }
            >
              {t.in("web", "Discard")}
            </KWButton>
            <KWButton
              size="mini"
              onClick={() =>
                void act(setRecurringRulePaused(ledgerStore, rule.id, false))
              }
            >
              {t.in("home", "Confirm")}
            </KWButton>
          </div>
        ))}
      </div>
    </KWSection>
  )
}
