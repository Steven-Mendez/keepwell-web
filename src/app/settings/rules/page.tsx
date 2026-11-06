import type { Metadata } from "next"

import { RulesScreen } from "@/components/settings/rules-screen"

export const metadata: Metadata = { title: "Rules" }

export default function Page() {
  return <RulesScreen />
}
