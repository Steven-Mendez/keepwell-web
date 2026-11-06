import { LocalDataOverview } from "@/components/app/local-data-overview"

export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col gap-6 px-(--kw-gutter) py-14">
      <header className="flex flex-col gap-1">
        <h1 className="text-title">Keepwell</h1>
        <p className="text-body text-text-muted">
          Everything below lives in this browser and works offline. Backups open in Keepwell for iPhone too.
        </p>
      </header>
      <LocalDataOverview />
    </main>
  )
}
