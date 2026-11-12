"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo } from "react"

import { KWButton, KWEmptyState, KWLargeTitleHeader } from "@/components/kw/design"
import { KWIcon } from "@/components/kw/kw-icon"
import { Page } from "@/components/kw/primitives"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/toast"
import { useLedger } from "@/hooks/use-ledger"
import { deleteRecurringRule, setRecurringRulePaused, startOfDay, type NotificationTarget } from "@/lib/domain"
import { useT, type Translator } from "@/lib/i18n"
import { ledgerStore, notificationStateRepository } from "@/lib/repositories"
import { cn } from "@/lib/utils"


import { BrowserNotificationsCard } from "./browser-notifications-card"
import type { InboxEntry } from "./notifications"
import { useNotifications } from "./use-notifications"

const TONES = {
  pending: "bg-pending-tint text-pending",
  accent: "bg-accent-tint text-link",
  negative: "bg-negative-tint text-negative",
} as const

/** Where a notification leads on the web. */
export function targetHref(target: NotificationTarget): string {
  switch (target.screen) {
    case "transaction":
      return `/transactions?id=${target.id}`
    case "creditCard":
    case "account":
      return `/accounts?id=${target.accountId}`
    case "debts":
      return "/debts"
    case "recurring":
      return "/recurring"
    case "summary":
      return "/summary"
  }
}

function dayTitle(t: Translator, day: Date, now: Date): string {
  const today = startOfDay(now).getTime()
  if (day.getTime() === today) return t.in("sharedpresentation", "Today")
  if (day.getTime() === today - 86_400_000) return t.in("web", "Yesterday")
  return new Intl.DateTimeFormat(t.locale, {
    day: "numeric",
    month: "long",
    ...(day.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(day)
}

const failed = (t: Translator) => () =>
  toast.add({ title: t.in("web", "Couldn't save the change. Try again."), type: "error" })

/** Deletes and offers "Undo" for a few seconds, like Mail; deleting is undoable anyway. */
function dismiss(t: Translator, ids: readonly string[]) {
  notificationStateRepository
    .dismiss(ids)
    .then(() =>
      toast.add({
        title: ids.length === 1 ? t.in("web", "Notification deleted") : t.in("web", "%lld notifications deleted", ids.length),
        timeout: 6000,
        actionProps: {
          children: t.in("web", "Undo"),
          onClick: () => void notificationStateRepository.restore(ids).catch(failed(t)),
        },
      })
    )
    .catch(failed(t))
}

/**
 * The inbox (ADR 0012): what applies now, grouped by day, newest first. Unread ones carry a dot;
 * opening one reads it. Read and deleted travel to the iPhone and every other browser through sync.
 */
export function NotificationsScreen() {
  const t = useT()
  const ledger = useLedger()
  const router = useRouter()
  const params = useSearchParams()
  const { days, entries, unread } = useNotifications()
  const now = new Date()
  const readIds = entries.filter((entry) => entry.read).map((entry) => entry.notification.id)

  // Arriving from a browser notification (`?open=<id>`, see sw.ts): read it and go where it leads.
  const opening = params.get("open")
  const openedEntry = useMemo(() => entries.find((entry) => entry.notification.id === opening), [entries, opening])
  useEffect(() => {
    if (!opening || !ledger) return
    void notificationStateRepository.markRead([opening]).catch(() => undefined)
    router.replace(openedEntry ? targetHref(openedEntry.notification.target) : "/notifications")
  }, [opening, openedEntry, ledger, router])

  const menu =
    entries.length > 0 ? (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t.in("web", "Notification options")}
          className="inline-flex size-10 shrink-0 press items-center justify-center rounded-full bg-card text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <KWIcon name="more" size={20} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="min-w-52 rounded-xl p-1.5">
          <DropdownMenuItem
            className="px-2 py-1.5"
            disabled={unread === 0}
            onClick={() =>
              void notificationStateRepository
                .markRead(entries.filter((entry) => !entry.read).map((entry) => entry.notification.id))
                .catch(failed(t))
            }
          >
            {t.in("web", "Mark all as read")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="px-2 py-1.5"
            variant="destructive"
            disabled={readIds.length === 0}
            onClick={() => dismiss(t, readIds)}
          >
            {t.in("web", "Delete read")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null

  return (
    <Page>
      <KWLargeTitleHeader
        title={t.in("web", "Notifications")}
        subtitle={unread > 0 ? `${unread} ${t.in("web", "Unread").toLowerCase()}` : undefined}
        trailing={menu}
      />
      <div className="flex max-w-3xl flex-col gap-6">
        <BrowserNotificationsCard />
        {!ledger ? null : entries.length === 0 ? (
          <KWEmptyState
            icon="check"
            title={t.in("web", "You're all caught up")}
            message={t.in("web", "Payment reminders, budget warnings and proposals from Claude show up here.")}
          />
        ) : (
          days.map(({ day, entries: dayEntries }) => (
            <section key={day.getTime()} className="flex flex-col gap-2">
              <h2 className="px-1 type-label text-muted-foreground">{dayTitle(t, day, now)}</h2>
              <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl bg-card">
                {dayEntries.map((entry) => (
                  <NotificationRow key={entry.notification.id} t={t} entry={entry} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </Page>
  )
}

function NotificationRow({ t, entry }: { t: Translator; entry: InboxEntry }) {
  const router = useRouter()
  const { notification, read } = entry
  const id = notification.id
  const open = () => {
    if (!read) void notificationStateRepository.markRead([id]).catch(failed(t))
    router.push(targetHref(notification.target))
  }
  const act = (work: Promise<void>) => void work.then(() => notificationStateRepository.markRead([id])).catch(failed(t))

  return (
    <li className="group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
      <span
        aria-hidden
        className={cn("mt-4 size-2 shrink-0 rounded-full", read ? "bg-transparent" : "bg-link")}
      />
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", TONES[entry.tone])}>
        <KWIcon name={entry.icon} size={20} />
      </span>
      <button
        type="button"
        onClick={open}
        className="flex min-w-0 flex-1 flex-col gap-0.5 text-left outline-none after:absolute after:inset-0 focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
      >
        <span className={cn("type-body text-foreground", read ? "font-normal" : "font-semibold")}>
          {!read ? <span className="sr-only">{`${t.in("web", "Unread")}: `}</span> : null}
          {entry.title}
        </span>
        <span className="type-caption text-muted-foreground">{entry.body}</span>
      </button>
      {notification.kind === "proposal" ? (
        <div className="relative z-10 flex shrink-0 items-center gap-2 self-center">
          <KWButton size="mini" variant="secondary" onClick={() => act(deleteRecurringRule(ledgerStore, notification.params.ruleId))}>
            {t.in("home", "Discard")}
          </KWButton>
          <KWButton size="mini" onClick={() => act(setRecurringRulePaused(ledgerStore, notification.params.ruleId, false))}>
            {t.in("home", "Confirm")}
          </KWButton>
        </div>
      ) : null}
      {/* On hover or focus, like Gmail's row actions; always there on touch screens. */}
      <div className="relative z-10 flex shrink-0 items-center gap-1 self-center opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
        <RowAction
          label={read ? t.in("web", "Mark as unread") : t.in("web", "Mark as read")}
          icon={read ? "eyeOff" : "check"}
          onClick={() =>
            void (read ? notificationStateRepository.markUnread([id]) : notificationStateRepository.markRead([id])).catch(failed(t))
          }
        />
        <RowAction label={t.in("web", "Delete notification")} icon="trash" onClick={() => dismiss(t, [id])} />
      </div>
    </li>
  )
}

function RowAction({ label, icon, onClick }: { label: string; icon: "check" | "eyeOff" | "trash"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <KWIcon name={icon} size={18} />
    </button>
  )
}
