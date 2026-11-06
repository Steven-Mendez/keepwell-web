import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Offline",
}

/** Shown only for a page that was never opened online; everything already visited works offline. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-2 px-(--kw-gutter) text-center">
      <h1 className="text-title">You&apos;re offline</h1>
      <p className="text-body text-text-muted">
        This page hasn&apos;t been opened on this device yet. Your data is safe here and syncs nothing until you&apos;re back.
      </p>
    </main>
  )
}
