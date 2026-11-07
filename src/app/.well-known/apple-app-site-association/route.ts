// The iPhone app's associated domain (webcredentials): it lets the app use passkeys made for this
// site, whose host is the relying party. App ids are "<TEAM ID>.<bundle id>", set at build time in
// KEEPWELL_APPLE_APP_IDS (comma-separated: one per configuration that should share passkeys).
export const dynamic = "force-static"

export function GET() {
  const apps = (process.env.KEEPWELL_APPLE_APP_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
  return Response.json(
    { webcredentials: { apps } },
    { headers: { "content-type": "application/json" } }
  )
}
