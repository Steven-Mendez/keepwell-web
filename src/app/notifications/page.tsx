import type { Metadata } from "next"
import { Suspense } from "react"

import { NotificationsScreen } from "@/components/notifications/notifications-screen"

export const metadata: Metadata = { title: "Notifications" }

export default function Page() {
  // useSearchParams (the ?open= a browser notification arrives with) needs a boundary for the static build.
  return (
    <Suspense>
      <NotificationsScreen />
    </Suspense>
  )
}
