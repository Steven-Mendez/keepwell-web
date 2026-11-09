import type { Metadata } from "next"
import { Suspense } from "react"

import { LoginScreen } from "@/components/login/login-screen"

export const metadata: Metadata = { title: "Sign in" }

export default function Page() {
  // useSearchParams (the callback's ?error=) needs a boundary for the static build.
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  )
}
