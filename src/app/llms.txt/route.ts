import { docsPages } from "@/components/docs/content"
import { API_URL } from "@/lib/api/client"

/**
 * The docs index for AI assistants (llmstxt.org): what Keepwell's connector is and a link to every
 * page, so an assistant asked about Keepwell can find the page it needs. Each page's HTML carries
 * its full text; ?lang=es gives the Spanish one.
 */
export function GET(request: Request) {
  const origin = new URL(request.url).origin
  // The API's /mcp: its own host, or this deployment forwarding it (src/lib/api/proxied-paths.ts).
  const mcpUrl = `${API_URL ?? origin}/mcp`
  const pages = docsPages("en", { mcpUrl })
  const groups = [...new Set(pages.map((page) => page.group))]
  const lines = [
    "# Keepwell",
    "",
    "> Keepwell is a personal finance app for one or two currencies (iPhone and web). Its MCP connector lets Claude and other assistants read accounts, balances, spending, budgets, trends and upcoming payments, show them as interactive views, and propose movements that wait for the person's confirmation.",
    "",
    `Connector URL: ${mcpUrl} (remote MCP over Streamable HTTP, OAuth sign-in).`,
    "",
    ...groups.flatMap((group) => [
      `## ${group}`,
      "",
      ...pages
        .filter((page) => page.group === group)
        .map(
          (page) =>
            `- [${page.title}](${origin}${page.slug ? `/docs/${page.slug}` : "/docs"}): ${page.description}`
        ),
      "",
    ]),
    "## Optional",
    "",
    `- [Privacy policy](${origin}/privacy): what Keepwell stores and for how long.`,
    "",
  ]
  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  })
}
