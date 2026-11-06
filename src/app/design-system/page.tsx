import type { Metadata } from "next"

import { DesignSystemScreen } from "@/components/design-system/design-system-screen"

export const metadata: Metadata = { title: "Design system" }

export default function Page() {
  return <DesignSystemScreen />
}
