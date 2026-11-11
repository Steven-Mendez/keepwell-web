import type { Metadata } from "next"
import { Suspense } from "react"

import { McpGuide } from "@/components/docs/mcp-guide"

export const metadata: Metadata = { title: "Connect Claude" }

export default function Page() {
  // useSearchParams (?lang=) needs a boundary for the static build.
  return (
    <Suspense>
      <McpGuide />
    </Suspense>
  )
}
