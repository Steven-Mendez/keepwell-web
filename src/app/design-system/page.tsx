import type { Metadata } from "next"

import { DesignSystemScreen } from "@/components/design-system/design-system-screen"

export const metadata: Metadata = { title: "Sistema de diseño" }

export default function Page() {
  return <DesignSystemScreen />
}
