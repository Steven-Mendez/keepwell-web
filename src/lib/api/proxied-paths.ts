/**
 * The Keepwell API's paths, when the web app forwards them (no custom domain: the API has no host of
 * its own, so the browser sees one origin and the session cookie is first-party). Used by the
 * rewrites in next.config.ts and by the service worker, which must never cache them.
 */
export const API_PATHS = [
  "/api/auth/:path*",
  "/me",
  "/sync/:path*",
  "/mcp",
  "/mcp/:path*",
  "/entitlements/:path*",
  "/webhooks/:path*",
  "/invitations/:path*",
  "/health",
  "/openapi.json",
  "/.well-known/oauth-protected-resource/:path*",
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-authorization-server/:path*",
  "/.well-known/oauth-authorization-server",
  "/.well-known/openid-configuration",
] as const

const prefixes = API_PATHS.map((path) => path.replace("/:path*", ""))

/** Whether a same-origin path belongs to the API (the service worker's matcher). */
export function isApiPath(pathname: string): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
