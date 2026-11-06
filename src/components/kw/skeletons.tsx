import { Page } from "@/components/kw/primitives"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Loading states drawn with shadcn's Skeleton, each shaped like the screen it stands in for, so the
 * first IndexedDB read fills the layout in place instead of popping it in (iOS `.redacted`). Blocks
 * on the black page are `bg-card`; blocks inside a card keep shadcn's `bg-muted`, one step lighter.
 */

/** A movement row: icon, title and subtitle, the amount on the right (KWTransactionRow). */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-16 items-center gap-3 px-4 py-3", className)}>
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-2/5 max-w-56" />
        <Skeleton className="h-3 w-1/4 max-w-32" />
      </div>
      <Skeleton className="h-3.5 w-16 shrink-0" />
    </div>
  )
}

/** A grouped card of rows (KWGroupedCard). */
export function SkeletonList({ rows, className }: { rows: number; className?: string }) {
  return (
    <div className={cn("flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
    </div>
  )
}

/** A settings-style row: a leading glyph, a label and a trailing value. */
function SkeletonSettingRow() {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-3">
      <Skeleton className="size-7 shrink-0 rounded-lg" />
      <Skeleton className="h-3.5 w-1/3" />
      <Skeleton className="ml-auto h-3 w-14" />
    </div>
  )
}

function SkeletonGroup({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="ml-1 h-3.5 w-24 bg-card" />
      <div className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card">
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonSettingRow key={index} />
        ))}
      </div>
    </div>
  )
}

/** KWLargeTitleHeader: the title, an optional subtitle line, an optional circle button. */
export function SkeletonHeader({ subtitle = false, trailing = false }: { subtitle?: boolean; trailing?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-48 bg-card" />
        {subtitle ? <Skeleton className="h-4 w-36 bg-card" /> : null}
      </div>
      {trailing ? <Skeleton className="size-10 rounded-full bg-card" /> : null}
    </div>
  )
}

export function HomeSkeleton() {
  return (
    <div className="flex flex-col" aria-busy>
      {/* The hero keeps its brand gradient; only the words in it wait. */}
      <section className="mt-[calc(var(--topbar-h)*-1)] bg-[linear-gradient(to_bottom,var(--brand-600)_0%,var(--brand-900)_55%,var(--background)_100%)] pt-(--topbar-h)">
        <div className="mx-auto grid w-full max-w-[1400px] justify-items-center gap-5 px-(--gutter) pt-6 pb-10 md:px-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:justify-items-stretch lg:gap-x-6 lg:gap-y-4 lg:pt-4 lg:pb-6">
          <div className="flex flex-col items-center gap-2 lg:col-start-1 lg:row-start-1 lg:items-start lg:self-center">
            <Skeleton className="h-3.5 w-36 bg-white/15" />
            <Skeleton className="h-7 w-56 bg-white/15" />
          </div>
          <div className="flex w-full flex-col items-center gap-5 lg:col-span-2 lg:row-start-2 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center lg:gap-x-6 xl:grid-cols-[auto_minmax(0,1fr)] xl:gap-x-12">
          <div className="flex flex-col items-center gap-3 lg:items-start">
            <Skeleton className="h-4 w-32 bg-white/15" />
            <Skeleton className="h-14 w-64 bg-white/15" />
            <Skeleton className="h-8 w-40 rounded-full bg-white/15" />
          </div>
          <Skeleton className="hidden h-52 w-full rounded-2xl bg-white/8 lg:block xl:h-36" />
          </div>
          <div className="grid w-full max-w-md grid-cols-4 gap-2 lg:hidden">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <Skeleton className="size-12 rounded-full bg-white/15" />
                <Skeleton className="h-3 w-12 bg-white/15" />
              </div>
            ))}
          </div>
        </div>
      </section>
      <Page className="pt-2 md:pt-2">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex flex-col gap-3">
            <Skeleton className="ml-1 h-4 w-20 bg-card" />
            <SkeletonList rows={8} />
          </div>
          <aside className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 rounded-2xl bg-card p-[18px] lg:hidden">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-7 w-36" />
                </div>
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
              {[0, 1].map((index) => (
                <div key={index} className="flex flex-col gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              <Skeleton className="ml-1 h-4 w-24 bg-card" />
              <SkeletonGroup rows={4} />
            </div>
          </aside>
        </div>
      </Page>
    </div>
  )
}

export function TransactionsSkeleton() {
  return (
    <Page aria-busy>
      <SkeletonHeader trailing />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Skeleton className="h-10 w-full rounded-full bg-card lg:max-w-md" />
        <div className="flex gap-2">
          {[64, 80, 72, 88].map((width) => (
            <Skeleton key={width} className="h-9 rounded-full bg-card" style={{ width }} />
          ))}
        </div>
      </div>
      {[5, 3, 4].map((rows, index) => (
        <div key={index} className="flex flex-col gap-3">
          <div className="flex justify-between px-1">
            <Skeleton className="h-4 w-28 bg-card" />
            <Skeleton className="h-4 w-16 bg-card" />
          </div>
          <SkeletonList rows={rows} />
        </div>
      ))}
    </Page>
  )
}

/** Summary on a wide screen fits the window, so its skeleton takes the same grid and height. */
export function SummarySkeleton() {
  return (
    <Page aria-busy className="lg:h-[calc(100svh-var(--topbar-h))] lg:min-h-[640px] lg:gap-4 lg:py-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-44 bg-card" />
        <div className="flex items-center gap-2">
          <Skeleton className="size-10 rounded-full bg-card" />
          <Skeleton className="h-6 w-32 bg-card" />
          <Skeleton className="size-10 rounded-full bg-card" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex flex-col gap-2 rounded-2xl bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-36 max-w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-3 lg:grid-rows-2">
        {[0, 1].map((index) => (
          <div key={index} className="flex min-h-64 flex-col gap-4 rounded-2xl bg-card p-5 lg:col-span-2 lg:min-h-0">
            <div className="flex justify-between">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="min-h-32 flex-1 rounded-xl" />
          </div>
        ))}
        <div className="flex flex-col gap-5 rounded-2xl bg-card p-5 lg:col-start-3 lg:row-span-2 lg:row-start-1">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-8 w-36 rounded-full" />
          </div>
          <Skeleton className="mx-auto aspect-square w-full max-w-44 rounded-full" />
          <div className="flex flex-col gap-4">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3.5 w-14" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Page>
  )
}

/** Accounts: the wallet deck beside the detail panel, as wide as the real columns. */
export function AccountsSkeleton() {
  return (
    <Page aria-busy className="lg:h-[calc(100svh-var(--topbar-h))] lg:min-h-0 lg:gap-5 lg:py-6">
      <SkeletonHeader subtitle trailing />
      <div className="flex flex-col gap-6 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="flex flex-col">
          {[0, 1, 2].map((index) => (
            // Each card hides under the next, leaving its top strip like the deck does.
            <Skeleton key={index} className={cn("aspect-[1.586] rounded-[var(--radius-card)] bg-card ring-1 ring-background", index > 0 && "-mt-[44%]")} />
          ))}
        </div>
        <div className="hidden flex-col gap-5 rounded-3xl bg-nav p-5 ring-1 ring-divider lg:flex">
          <div className="flex gap-5">
            <Skeleton className="aspect-[1.586] w-56 shrink-0 rounded-[var(--radius-card)]" />
            <div className="flex flex-col gap-3 pt-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-9 w-44" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-9 w-full rounded-full" />
          <div className="flex flex-col divide-y divide-divider">
            {[0, 1, 2, 3, 4].map((index) => (
              <SkeletonRow key={index} className="px-0" />
            ))}
          </div>
        </div>
      </div>
    </Page>
  )
}

/** Settings: preferences on the left, organization and data on the right. */
export function SettingsSkeleton() {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-2" aria-busy>
      <div className="flex flex-col gap-8">
        <SkeletonGroup rows={2} />
        <SkeletonGroup rows={1} />
        <SkeletonGroup rows={3} />
      </div>
      <div className="flex flex-col gap-8">
        <SkeletonGroup rows={2} />
        <SkeletonGroup rows={3} />
      </div>
    </div>
  )
}

/** A list of categories: glyph and name rows in one grouped card. */
export function CategoriesSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card" aria-busy>
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="flex min-h-14 items-center gap-3 px-4 py-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="ml-auto size-5 rounded" />
        </div>
      ))}
    </div>
  )
}

/** The sidebar's accounts card: net worth, then a few account rows with their card thumbnails. */
export function SidebarAccountsSkeleton() {
  return (
    <div className="flex flex-col gap-0.5" aria-busy>
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex h-8 items-center gap-2.5 px-3">
          <Skeleton className="h-2.5 w-3.5 shrink-0 rounded-[3px]" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </div>
  )
}
