import type { Metadata } from "next"
import { Suspense } from "react"

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"

export const metadata: Metadata = { title: "Welcome" }

export default function Page() {
  // useSearchParams (Apple's ?error= on the welcome's sign-in) needs a boundary for the static build.
  return (
    <Suspense>
      <OnboardingFlow />
    </Suspense>
  )
}
