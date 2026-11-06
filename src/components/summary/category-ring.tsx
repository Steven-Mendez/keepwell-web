"use client"

import {
  Cell,
  Pie,
  PieChart,
  Sector,
  Tooltip,
  type PieSectorShapeProps,
} from "recharts"

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
 * A category breakdown as a ring whose center shows the total. Hovering a slice lights it and shows
 * its name, amount and share in a tooltip; hovering its list row lights it too.
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
  const config: ChartConfig = Object.fromEntries(
    slices.map((slice) => [slice.id, { label: slice.name, color: slice.color }])
  )
  return (
    <div
      className={cn(
        "relative mx-auto aspect-square w-full shrink-0",
        className
      )}
      // On the wrapper, not the Pie: moving between slices fires the next slice's enter before the
      // last one's leave, which cleared the new slice.
      onMouseLeave={() => onActiveChange(undefined)}
    >
      <ChartContainer config={config} className="aspect-square w-full">
        <PieChart>
          <Tooltip
            isAnimationActive={false}
            allowEscapeViewBox={{ x: true, y: true }}
            wrapperStyle={{ zIndex: 20, pointerEvents: "none" }}
            content={({ active: shown, payload }) => {
              const slice = shown
                ? (payload?.[0]?.payload as RingSlice | undefined)
                : undefined
              if (!slice) return null
              return (
                <div className="grid min-w-36 gap-1 rounded-xl bg-secondary px-3 py-2 type-caption shadow-depth">
                  <span className="flex items-center gap-1.5 type-label">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.color }}
                    />
                    {slice.name}
                  </span>
                  <span className="flex items-center justify-between gap-4 tabular-nums">
                    <span>{slice.amount}</span>
                    <span className="text-text-secondary">{slice.percent}</span>
                  </span>
                </div>
              )
            }}
          />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius="68%"
            // Room for the lit slice to grow into.
            outerRadius="94%"
            shape={(props: PieSectorShapeProps, index: number) => {
              const lit = slices[index]?.id === active
              return (
                <Sector
                  cx={props.cx}
                  cy={props.cy}
                  startAngle={props.startAngle}
                  endAngle={props.endAngle}
                  innerRadius={props.innerRadius}
                  outerRadius={lit ? props.outerRadius + 6 : props.outerRadius}
                  cornerRadius={4}
                  fill={props.fill ?? "currentColor"}
                  fillOpacity={active && !lit ? 0.35 : 1}
                  stroke="var(--card)"
                  strokeWidth={2}
                  style={{ transition: "fill-opacity 160ms ease-out" }}
                />
              )
            }}
            paddingAngle={slices.length > 1 ? 2 : 0}
            stroke="var(--card)"
            strokeWidth={2}
            isAnimationActive="auto"
            animationDuration={280}
            animationEasing="ease-out"
            onMouseEnter={(_, index) => onActiveChange(slices[index]?.id)}
          >
            {slices.map((slice) => (
              <Cell key={slice.id} fill={slice.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-[19%] flex flex-col items-center justify-center text-center">
        <AnimatedNumber value={total} className="type-amount-sm" />
        <span className="max-w-full truncate type-caption text-muted-foreground">
          {totalCaption}
        </span>
      </div>
    </div>
  )
}
