import type { Metadata } from "next"

import { AccountsScreen } from "@/components/accounts/accounts-screen"

export const metadata: Metadata = { title: "Accounts" }

export default function Page() {
  return <AccountsScreen />
}
