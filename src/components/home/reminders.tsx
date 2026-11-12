import { KWButton } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { cn } from "@/lib/utils"

import type { Reminder } from "./home-reminders"

const REMINDER_TONES = {
  pending: "bg-pending-tint text-pending",
  accent: "bg-accent-tint text-link",
  negative: "bg-negative-tint text-negative",
} as const

/** iOS's notifications, shown in place as a grid of cards (the Notifications page). */
export function Reminders({ reminders }: { reminders: readonly Reminder[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {reminders.map((reminder) => (
        <div key={reminder.id} className="flex gap-3 rounded-2xl bg-card p-4">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              REMINDER_TONES[reminder.tone]
            )}
          >
            <KWIcon name={reminder.icon} size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="type-label text-foreground">{reminder.title}</p>
            <p className="type-caption text-muted-foreground">
              {reminder.body}
            </p>
            {reminder.action ? (
              <KWButton
                size="mini"
                variant="primary"
                className="mt-2 self-start"
                onClick={reminder.action.run}
              >
                {reminder.action.label}
              </KWButton>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
