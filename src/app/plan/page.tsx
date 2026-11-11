import type { Metadata } from "next"

import { PlanScreen } from "@/components/plan/plan-screen"

export const metadata: Metadata = { title: "Plan" }

export default function Page() {
  return <PlanScreen />
}
