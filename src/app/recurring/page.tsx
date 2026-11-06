import type { Metadata } from "next"

import { RecurringScreen } from "@/components/recurring/recurring-screen"

export const metadata: Metadata = { title: "Recurring" }

export default function Page() {
  return <RecurringScreen />
}
