"use client"

import { useRef, useState } from "react"
import {
  Cell,
  Pie,
  PieChart,
  Sector,
  type PieSectorDataItem,
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

/** Where the tooltip opens: just outside the ring at the slice's middle, so it never covers the ring. */
type TipPlace = { slice: RingSlice; x: number; y: number; cos: number; sin: number }

/** Clear of the lit slice, which grows 6px. */
const TIP_GAP = 14
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
  const [tip, setTip] = useState<TipPlace>()
  // The slice under the pointer, set synchronously: moving between slices fires the next slice's
  // enter before the last one's leave, and that leave must not clear the new slice.
  const pointed = useRef<string>(undefined)
  const clear = () => {
    pointed.current = undefined
    setTip(undefined)
    onActiveChange(undefined)
  }
  const config: ChartConfig = Object.fromEntries(
    slices.map((slice) => [slice.id, { label: slice.name, color: slice.color }])
  )
  return (
    <div
      className={cn(
        "relative mx-auto aspect-square w-full shrink-0",
        className
      )}
      onMouseLeave={clear}
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
            onMouseEnter={(sector: PieSectorDataItem, index: number) => {
              const slice = slices[index]
              pointed.current = slice?.id
              onActiveChange(slice?.id)
              // Recharts angles run counter-clockwise from 3 o'clock, with y pointing down on screen.
              const angle = -((sector.midAngle ?? 0) * Math.PI) / 180
              const radius = (sector.outerRadius ?? 0) + TIP_GAP
              const cos = Math.cos(angle)
              const sin = Math.sin(angle)
              setTip(
                slice && {
                  slice,
                  x: (sector.cx ?? 0) + radius * cos,
                  y: (sector.cy ?? 0) + radius * sin,
                  cos,
                  sin,
                }
              )
            }}
            onMouseLeave={(_: PieSectorDataItem, index: number) => {
              if (pointed.current === slices[index]?.id) clear()
            }}
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
      {tip && tip.slice.id === active && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 grid min-w-36 gap-1 rounded-xl bg-secondary px-3 py-2 type-caption whitespace-nowrap shadow-depth"
          style={{
            left: tip.x,
            top: tip.y,
            // Grows away from the ring: right of a right-hand slice, left of a left-hand one, above
            // a top one, below a bottom one, and in between for the slices around them.
            transform: `translate(${(tip.cos - 1) * 50}%, ${(tip.sin - 1) * 50}%)`,
          }}
        >
          <span className="flex items-center gap-1.5 type-label">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: tip.slice.color }}
            />
            {tip.slice.name}
          </span>
          <span className="flex items-center justify-between gap-4 tabular-nums">
            <span>{tip.slice.amount}</span>
            <span className="text-text-secondary">{tip.slice.percent}</span>
          </span>
        </div>
      )}
    </div>
  )
}
