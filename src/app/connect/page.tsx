import type { Metadata } from "next"

import { ConnectSignIn } from "@/components/connect/connect-screen"

export const metadata: Metadata = { title: "Connect" }

export default function Page() {
  return <ConnectSignIn />
}
