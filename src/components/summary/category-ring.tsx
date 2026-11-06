"use client"

import { Cell, Pie, PieChart } from "recharts"

import { AnimatedNumber } from "@/components/kw/animated-number"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

export interface RingSlice {
  id: string
  name: string
  value: number
  amount: string
  percent: string
  color: string
}

/**
 * A category breakdown as a ring whose center shows the total, or the hovered slice (or list row)
 * since the ring is too small for a floating tooltip.
 */
export function CategoryRing({
  slices,
  active,
  onActiveChange,
  total,
  totalCaption,
  className,
}: {
  slices: RingSlice[]
  active: string | undefined
  onActiveChange: (id: string | undefined) => void
  total: string
  /** What the total is ("spent", "received"), under it. */
  totalCaption: string
  /** The ring's width cap, which differs per card. */
  className: string
}) {
  const hovered = slices.find((slice) => slice.id === active)
  const config: ChartConfig = Object.fromEntries(
    slices.map((slice) => [slice.id, { label: slice.name, color: slice.color }])
  )
  return (
    <div
      className={cn(
        "relative mx-auto aspect-square w-full shrink-0",
        className
      )}
    >
      <ChartContainer
        config={config}
        className="aspect-square w-full"
        aria-hidden
      >
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius="68%"
            outerRadius="100%"
            paddingAngle={slices.length > 1 ? 2 : 0}
            cornerRadius={4}
            stroke="var(--card)"
            strokeWidth={2}
            isAnimationActive="auto"
            animationDuration={280}
            animationEasing="ease-out"
            onMouseLeave={() => onActiveChange(undefined)}
          >
            {slices.map((slice) => (
              <Cell
                key={slice.id}
                fill={slice.color}
                fillOpacity={active && active !== slice.id ? 0.35 : 1}
                onMouseEnter={() => onActiveChange(slice.id)}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      {/* Kept inside the hole (68% of the ring): the hovered slice's name sits above the amount,
          wrapping to two lines instead of truncating, with its share under it. */}
      <div
        className="pointer-events-none absolute inset-[19%] flex flex-col items-center justify-center gap-0.5 text-center"
        aria-live="polite"
      >
        {hovered && (
          <span className="flex max-w-full items-center gap-1.5 type-caption-sm text-foreground">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: hovered.color }}
            />
            <span className="line-clamp-2 leading-tight break-words">
              {hovered.name}
            </span>
          </span>
        )}
        <AnimatedNumber
          value={hovered ? hovered.amount : total}
          className="type-amount-sm"
        />
        <span className="max-w-full truncate type-caption text-muted-foreground">
          {hovered ? hovered.percent : totalCaption}
        </span>
      </div>
    </div>
  )
}
