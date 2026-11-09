import type { Metadata } from "next"

import { PrivacyPolicy } from "@/components/legal/privacy-policy"

export const metadata: Metadata = { title: "Privacy" }

export default function Page() {
  return <PrivacyPolicy />
}
