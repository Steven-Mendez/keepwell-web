"use client"

import { KWEmptyState, KWLargeTitleHeader } from "@/components/kw/design"
import { Page } from "@/components/kw/primitives"
import { AssistantRulesSection } from "@/components/home/home-assistant"
import { Reminders } from "@/components/home/reminders"
import { useLedger } from "@/hooks/use-ledger"
import { useT } from "@/lib/i18n"

import { useNotifications } from "./use-notifications"

/**
 * Everything that needs attention right now (iOS' notifications, shown in place) and the payments an
 * assistant proposed. Home keeps only drafts; the rest lives here, behind the bell.
 */
export function NotificationsScreen() {
  const t = useT()
  const ledger = useLedger()
  const { reminders, proposed, count } = useNotifications()
  return (
    <Page>
      <KWLargeTitleHeader title={t.in("web", "Notifications")} />
      {!ledger ? null : count === 0 ? (
        <KWEmptyState
          icon="check"
          title={t.in("web", "You're all caught up")}
          message={t.in(
            "web",
            "Payment reminders, budget warnings and proposals from Claude show up here."
          )}
        />
      ) : (
        <div className="flex max-w-3xl flex-col gap-6">
          {reminders.length > 0 ? <Reminders reminders={reminders} /> : null}
          <AssistantRulesSection t={t} rules={proposed} />
        </div>
      )}
    </Page>
  )
}
