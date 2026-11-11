import type { Metadata } from "next"
import { Suspense } from "react"

import { DocsShell } from "@/components/docs/docs-shell"

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Connect Claude to Keepwell and ask about your money in plain words.",
}

export default function Page() {
  // useSearchParams (?lang=) needs a boundary for the static build.
  return (
    <Suspense>
      <DocsShell slug="" />
    </Suspense>
  )
}
