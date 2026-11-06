import type { Metadata } from "next"

import { DebtsScreen } from "@/components/debts/debts-screen"

export const metadata: Metadata = { title: "Debts" }

export default function Page() {
  return <DebtsScreen />
}
