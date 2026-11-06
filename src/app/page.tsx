import { LocalDataOverview } from "@/components/app/local-data-overview"

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-(--gutter) py-8 md:px-8 md:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-title">Home</h1>
        <p className="text-body text-muted-foreground">Your data lives on this device and works offline.</p>
      </header>
      <LocalDataOverview />
    </div>
  )
}
