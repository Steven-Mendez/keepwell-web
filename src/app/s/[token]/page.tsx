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
  searchParams,
}: {
  params: Promise<{ token: string }>
  /** `?p=Mario`: the link was sent to Mario, so the page leads with his share. */
  searchParams: Promise<{ p?: string | string[] }>
}) {
  const { token } = await params
  const { p } = await searchParams
  return (
    <SharedSplit token={token} person={typeof p === "string" ? p : undefined} />
  )
}
