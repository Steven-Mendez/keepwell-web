import type { Metadata } from "next"

import { ConnectConsent } from "@/components/connect/connect-screen"

export const metadata: Metadata = { title: "Allow access" }

export default function Page() {
  return <ConnectConsent />
}
