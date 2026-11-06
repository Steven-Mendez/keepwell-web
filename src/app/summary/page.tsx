import type { Metadata } from "next"

import { SummaryScreen } from "@/components/summary/summary-screen"

export const metadata: Metadata = { title: "Summary" }

export default function Page() {
  return <SummaryScreen />
}
