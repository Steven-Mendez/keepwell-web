"use client"

import { BellIcon } from "lucide-react"
import { useLiveQuery } from "dexie-react-hooks"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { KWCircleButton } from "@/components/kw/design"
import { useT } from "@/lib/i18n"
import { closeHandledNotifications, refreshBrowserPush } from "@/lib/push/web-push"
import { notificationStateRepository } from "@/lib/repositories"

import { useNotifications } from "./use-notifications"

/**
 * The way into Notifications, with how many there are: in the sidebar header, and in the top bar
 * when the sidebar is hidden or on a phone. The count is in the accessible label too, since the
 * badge alone says nothing to a screen reader.
 */
export function NotificationsBell({ size = 32 }: { size?: number }) {
  const t = useT()
  const router = useRouter()
  const { unread: count } = useNotifications()
  useBrowserBanners()
  const label =
    count > 0
      ? t.in("web", "Notifications, %lld unread", count)
      : t.in("web", "Notifications")
  return (
    <span className="relative inline-flex shrink-0">
      <KWCircleButton
        icon={
          <BellIcon
            className={size >= 40 ? "size-5" : "size-[18px]"}
            strokeWidth={2}
            aria-hidden
          />
        }
        label={label}
        size={size}
        variant={size >= 40 ? "surface" : "translucent"}
        onClick={() => router.push("/notifications")}
      />
      {count > 0 ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-negative px-1 type-caption leading-none font-semibold text-white"
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </span>
  )
}

/**
 * Keeps the browser's banners in step with the inbox: one read or deleted here, in another tab or on
 * the iPhone (once synced) is closed. Also re-registers this browser's push subscription on launch.
 */
function useBrowserBanners() {
  const handled = useLiveQuery(
    async () =>
      new Set(
        (await notificationStateRepository.list())
          .filter((state) => state.readAt || state.dismissedAt)
          .map((state) => state.id)
      ),
    []
  )
  useEffect(() => {
    void refreshBrowserPush()
  }, [])
  useEffect(() => {
    if (handled) void closeHandledNotifications(handled).catch(() => undefined)
  }, [handled])
}
