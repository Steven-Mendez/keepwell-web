import type { Metadata } from "next"

import { SharedSplit } from "@/components/shared-split/shared-split"

// A private link: never indexed, never sent on as a referrer.
export const metadata: Metadata = {
  title: "Shared expense",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <SharedSplit token={token} />
}
