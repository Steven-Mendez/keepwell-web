import type { Metadata } from "next"

import { docsPages } from "@/components/docs/content"
import { DocsShell } from "@/components/docs/docs-shell"

// Every page is known at build time; anything else is a 404.
export const dynamicParams = false

const pages = docsPages("en", { mcpUrl: undefined }).filter(
  (page) => page.slug !== ""
)

export function generateStaticParams() {
  return pages.map((page) => ({ slug: page.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = pages.find((candidate) => candidate.slug === slug)
  return page ? { title: page.title, description: page.description } : {}
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <DocsShell slug={slug} />
}
