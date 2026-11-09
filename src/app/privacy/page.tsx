import type { Metadata } from "next"
import { Suspense } from "react"

import { PrivacyPolicy } from "@/components/legal/privacy-policy"

export const metadata: Metadata = { title: "Privacy" }

export default function Page() {
  // useSearchParams (?lang=) needs a boundary for the static build.
  return (
    <Suspense>
      <PrivacyPolicy />
    </Suspense>
  )
}
