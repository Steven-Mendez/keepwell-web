import type { Metadata } from "next"

import { MerchantsScreen } from "@/components/settings/merchants-screen"

export const metadata: Metadata = { title: "Businesses" }

export default function Page() {
  return <MerchantsScreen />
}
