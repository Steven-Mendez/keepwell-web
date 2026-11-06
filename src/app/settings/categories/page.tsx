import type { Metadata } from "next"

import { CategoriesScreen } from "@/components/settings/categories-screen"

export const metadata: Metadata = { title: "Categories" }

export default function Page() {
  return <CategoriesScreen />
}
