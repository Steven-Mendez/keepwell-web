import type { Metadata } from "next"

import { DocsShell } from "@/components/docs/docs-shell"

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Connect Claude to Keepwell and ask about your money in plain words.",
}

export default function Page() {
  return <DocsShell slug="" />
}
