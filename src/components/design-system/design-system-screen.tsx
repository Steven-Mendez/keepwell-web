"use client"

import { useState, useSyncExternalStore, type ReactNode } from "react"

import {
  KWActionButton,
  KWButton,
  KWChip,
  KWCircleButton,
  KWEmptyState,
  KWGroupedCard,
  KWLargeTitleHeader,
  KWSegmented,
  KWTransactionIcon,
  KWValueRow,
  type KWButtonSize,
  type KWButtonVariant,
  type KWTransactionStyle,
} from "@/components/kw/design"
import { transactionAmountClass } from "@/components/kw/design-styles"
import { KWAppIconTile, KWIcon, KWMiniCard } from "@/components/kw/kw-icon"
import { KW_ICONS, type KWIconName } from "@/components/kw/kw-icon-data"
import { CardArt, Page } from "@/components/kw/primitives"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CardColor } from "@/lib/schema"
import { cn } from "@/lib/utils"

// A living reference of the Keepwell design language: every value is read from the tokens the iOS
// DesignSystem generates (tokens.css), and every sample is the real kw/ component, so the sheet can
// never drift from what screens actually show. See src/components/kw/DESIGN.md.

/** The current value of a CSS custom property on :root (empty on the server). */
function useToken(name: string): string {
  return useSyncExternalStore(
    subscribeNever,
    () =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    () => ""
  )
}

function subscribeNever() {
  return () => {}
}

export function DesignSystemScreen() {
  return (
    <Page>
      <KWLargeTitleHeader
        title="Design system"
        subtitle="Keepwell's tokens and components, generated from the iOS DesignSystem."
        trailing={<KWAppIconTile size={40} />}
      />
      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-6">
          <TypographyCard />
          <ColorsCard />
        </div>
        <ComponentsCard />
      </div>
    </Page>
  )
}

// MARK: - Layout pieces

function Card({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-6 rounded-[var(--radius-surface)] bg-card p-6 md:p-8",
        className
      )}
    >
      {children}
    </section>
  )
}

function CardTitle({ title, tag }: { title: string; tag: string }) {
  return (
    <header className="flex flex-wrap items-center gap-3">
      <h2 className="type-title-sm text-foreground">{title}</h2>
      <Tag>{tag}</Tag>
    </header>
  )
}

/** The outlined pill beside a card title ("11 styles"). */
function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center rounded-full px-3.5 type-micro tracking-wider text-link uppercase ring-1 ring-ring/60 ring-inset">
      {children}
    </span>
  )
}

function Block({
  title,
  meta,
  children,
}: {
  title: string
  meta: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="type-heading text-foreground">{title}</h3>
        <span className="type-caption text-muted-foreground">{meta}</span>
      </div>
      {children}
    </div>
  )
}

/** The dashed frame that marks a component set, split into dashed columns. */
function Frame({
  columns,
  className,
  children,
}: {
  columns?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-xl border border-dashed border-ring/45 bg-background",
        columns && "flex divide-x divide-dashed divide-ring/45 [&>*]:shrink-0",
        className
      )}
    >
      {children}
    </div>
  )
}

function Caption({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn("type-caption-sm text-text-faint", className)}>
      {children}
    </span>
  )
}

// MARK: - Typography

const TYPE_STYLES = [
  { name: "display", className: "type-display", sample: "C$12,480" },
  { name: "amount-lg", className: "type-amount-lg", sample: "C$3,215.40" },
  { name: "title", className: "type-title", sample: "Summary" },
  { name: "title-sm", className: "type-title-sm", sample: "Accounts" },
  { name: "amount-sm", className: "type-amount-sm", sample: "−C$84.00" },
  { name: "heading", className: "type-heading", sample: "Recent movements" },
  {
    name: "body",
    className: "type-body",
    sample: "Personal finances on your device.",
  },
  { name: "label", className: "type-label", sample: "Add account" },
  {
    name: "caption",
    className: "type-caption",
    sample: "Yesterday · Groceries",
  },
  {
    name: "caption-sm",
    className: "type-caption-sm",
    sample: "Updated 2 min ago",
  },
  { name: "micro", className: "type-micro", sample: "LAST FOUR" },
] as const

function TypographyCard() {
  return (
    <Card>
      <CardTitle title="Typography" tag={`${TYPE_STYLES.length} styles`} />
      <p className="type-body leading-relaxed text-muted-foreground">
        Inter, the variable family iOS bundles, on the KWTextStyle scale.
        Amounts use tabular figures so columns of numbers line up.
      </p>
      <div className="flex items-end gap-3 text-foreground" aria-hidden>
        <span
          className="leading-none font-extrabold tracking-tighter"
          style={{ fontSize: "8rem" }}
        >
          Aa
        </span>
        <span className="pb-3 type-title">Aa</span>
        <span className="pb-4 type-heading">Aa</span>
      </div>
      <ul className="flex flex-col divide-y divide-divider">
        {TYPE_STYLES.map((style) => (
          <TypeRow key={style.name} {...style} />
        ))}
      </ul>
    </Card>
  )
}

function TypeRow({
  name,
  className,
  sample,
}: {
  name: string
  className: string
  sample: string
}) {
  const size = useToken(`--type-${name}-size`)
  const weight = useToken(`--type-${name}-weight`)
  const px = size.endsWith("rem")
    ? `${Math.round(parseFloat(size) * 16)}`
    : size
  return (
    <li className="flex flex-col gap-1 py-3">
      <span className={cn("truncate text-foreground", className)}>
        {sample}
      </span>
      <Caption>
        type-{name} · {px}/{weight}
      </Caption>
    </li>
  )
}

// MARK: - Colors

const RAMPS: { name: string; tokens: string[] }[] = [
  {
    name: "Surface",
    tokens: [
      "--kw-surface-bg",
      "--kw-surface-nav",
      "--kw-surface-surface",
      "--kw-surface-divider",
      "--kw-surface-surface2",
      "--kw-surface-border",
      "--kw-surface-control-off",
      "--kw-surface-light",
    ],
  },
  {
    name: "Text",
    tokens: [
      "--kw-text-faint",
      "--kw-text-muted",
      "--kw-text-secondary",
      "--kw-text-on-brand",
      "--kw-text-primary",
    ],
  },
  {
    name: "Brand",
    tokens: [
      "--kw-brand-b900",
      "--kw-brand-b700",
      "--kw-brand-b600",
      "--kw-brand-b500",
      "--kw-brand-accent",
      "--kw-brand-link",
      "--kw-brand-link-hover",
    ],
  },
  {
    name: "State",
    tokens: [
      "--kw-state-negative",
      "--kw-state-pending",
      "--kw-state-extra",
      "--kw-state-positive",
    ],
  },
  {
    name: "Tints",
    tokens: [
      "--negative-tint",
      "--pending-tint",
      "--extra-tint",
      "--positive-tint",
      "--neutral-tint",
      "--accent-tint",
    ],
  },
  {
    name: "Category",
    tokens: [
      "--category-blue",
      "--category-purple",
      "--category-pink",
      "--category-orange",
      "--category-amber",
      "--category-yellow",
      "--category-lime",
      "--category-green",
      "--category-cyan",
      "--category-gray",
    ],
  },
]

function ColorsCard() {
  const count = RAMPS.reduce((total, ramp) => total + ramp.tokens.length, 0)
  return (
    <Card>
      <CardTitle title="Colors" tag={`${count} tokens`} />
      <p className="type-body leading-relaxed text-muted-foreground">
        Dark only, like iOS. Screens never use raw hex: hover a swatch for its
        token.
      </p>
      <div className="flex flex-col gap-4">
        {RAMPS.map((ramp) => (
          <div key={ramp.name} className="flex flex-col gap-1.5">
            <Caption>{ramp.name}</Caption>
            <div className="flex h-14 overflow-hidden rounded-xl ring-1 ring-border ring-inset">
              {ramp.tokens.map((token) => (
                <Swatch key={token} token={token} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function Swatch({ token }: { token: string }) {
  const value = useToken(token)
  const label = `${token.replace(/^--(kw-)?/, "")} ${value}`
  return (
    <span
      className="min-w-0 flex-1 transition-[flex-grow] duration-(--duration-base) hover:grow-[2.5]"
      style={{ backgroundColor: `var(${token})` }}
      title={label}
      aria-label={label}
    />
  )
}

// MARK: - Components

function ComponentsCard() {
  return (
    <Card className="min-w-0 gap-10">
      <CardTitle title="Components" tag="src/components/kw" />
      <ButtonsBlock />
      <CircleBlock />
      <SelectionBlock />
      <PillsBlock />
      <MovementsBlock />
      <FormsBlock />
      <RowsBlock />
      <CardArtBlock />
      <IconsBlock />
      <SpacingBlock />
    </Card>
  )
}

const BUTTON_VARIANTS: KWButtonVariant[] = [
  "primary",
  "secondary",
  "surface",
  "destructive",
  "link",
  "plain",
]
const BUTTON_SIZES: { size: KWButtonSize; px: number }[] = [
  { size: "large", px: 48 },
  { size: "regular", px: 40 },
  { size: "small", px: 32 },
]

function ButtonsBlock() {
  return (
    <Block
      title="Button"
      meta={`${BUTTON_SIZES.length} heights / ${BUTTON_VARIANTS.length} roles + disabled`}
    >
      <Frame columns>
        {BUTTON_SIZES.map(({ size, px }) => (
          <div key={size} className="flex flex-col gap-4 p-5">
            <Caption>
              {size} · {px}px
            </Caption>
            {BUTTON_VARIANTS.map((variant) => (
              <div key={variant} className="flex items-center gap-3">
                <KWButton variant={variant} size={size} icon="plus">
                  Button
                </KWButton>
                <KWButton
                  variant={variant}
                  size={size}
                  aria-label="Next"
                  className="aspect-square px-0"
                >
                  <KWIcon
                    name="arrowRight"
                    size={size === "small" ? 16 : 18}
                    strokeWidth={2.2}
                  />
                </KWButton>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <KWButton size={size} icon="plus" disabled>
                Button
              </KWButton>
              <KWButton
                size={size}
                aria-label="Next"
                className="aspect-square px-0"
                disabled
              >
                <KWIcon
                  name="arrowRight"
                  size={size === "small" ? 16 : 18}
                  strokeWidth={2.2}
                />
              </KWButton>
            </div>
          </div>
        ))}
      </Frame>
      <Caption>
        Rows, top to bottom: {[...BUTTON_VARIANTS, "disabled"].join(" · ")}
      </Caption>
      <Frame className="flex flex-wrap items-center gap-3 p-5">
        <KWButton shortcut="N" icon="plus">
          New expense
        </KWButton>
        <KWButton variant="surface" shortcut="⌘K" icon="search">
          Search
        </KWButton>
        <KWButton size="large" fill className="sm:w-auto">
          Continue
        </KWButton>
      </Frame>
    </Block>
  )
}

function CircleBlock() {
  return (
    <Block title="Circle & action buttons" meta="40px circles / 48px actions">
      <Frame columns>
        <div className="flex flex-col gap-4 p-5">
          <Caption>KWCircleButton</Caption>
          <div className="flex items-center gap-3">
            <KWCircleButton
              icon="plus"
              label="Add"
              variant="white"
              shortcut="N"
            />
            <KWCircleButton icon="search" label="Search" shortcut="/" />
            <KWCircleButton icon="chevronLeft" label="Back" />
            <KWCircleButton icon="close" label="Close" />
            <KWCircleButton icon="more" label="More" size={32} />
          </div>
          <div
            className="flex items-center gap-3 rounded-xl p-3"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--brand-500), var(--brand-700))",
            }}
          >
            <KWCircleButton
              icon="eye"
              label="Show balances"
              variant="translucent"
            />
            <KWCircleButton icon="share" label="Share" variant="translucent" />
          </div>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <Caption>KWActionButton</Caption>
          <div className="flex items-start gap-2">
            <KWActionButton
              icon="arrowUpRight"
              title="Expense"
              variant="prominent"
            />
            <KWActionButton icon="arrowDownLeft" title="Income" />
            <KWActionButton icon="transfer" title="Transfer" />
            <KWActionButton icon="freeze" title="Freeze" variant="active" />
          </div>
        </div>
      </Frame>
    </Block>
  )
}

function SelectionBlock() {
  const [period, setPeriod] = useState<"week" | "month" | "year">("month")
  const [compact, setCompact] = useState<"in" | "out">("out")
  const [accent, setAccent] = useState<"1m" | "3m" | "6m" | "1y">("3m")
  const [filter, setFilter] = useState("all")
  const [currency, setCurrency] = useState("NIO")
  return (
    <Block title="Segmented & chip" meta="3 segmented styles / 3 chip looks">
      <Frame columns>
        <div className="flex w-80 flex-col gap-4 p-5">
          <Caption>KWSegmented large · compact · accent</Caption>
          <KWSegmented
            aria-label="Period"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "week", title: "Week" },
              { value: "month", title: "Month" },
              { value: "year", title: "Year" },
            ]}
          />
          <div className="flex flex-wrap gap-3">
            <KWSegmented
              aria-label="Direction"
              style="compact"
              value={compact}
              onChange={setCompact}
              options={[
                { value: "out", title: "Money out" },
                { value: "in", title: "Money in" },
              ]}
            />
            <KWSegmented
              aria-label="Range"
              style="accent"
              value={accent}
              onChange={setAccent}
              options={[
                { value: "1m", title: "1M" },
                { value: "3m", title: "3M" },
                { value: "6m", title: "6M" },
                { value: "1y", title: "1Y" },
              ]}
            />
          </div>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <Caption>KWChip filled · outlined · extra</Caption>
          <div className="flex gap-2">
            {["all", "expenses", "income"].map((value) => (
              <KWChip
                key={value}
                selected={filter === value}
                onClick={() => setFilter(value)}
                pillId="ds-filter"
                className="capitalize"
              >
                {value}
              </KWChip>
            ))}
          </div>
          <div className="flex gap-2">
            {["NIO", "USD", "EUR"].map((value) => (
              <KWChip
                key={value}
                look="outlined"
                selected={currency === value}
                onClick={() => setCurrency(value)}
              >
                {value}
              </KWChip>
            ))}
          </div>
          <div className="flex gap-2">
            <KWChip look="extra" selected>
              <KWIcon name="bolt" size={14} /> Highlight
            </KWChip>
            <KWChip look="extra" selected={false}>
              Off
            </KWChip>
          </div>
        </div>
      </Frame>
    </Block>
  )
}

const PILL_TONES = [
  { tone: "accent", className: "bg-accent-tint text-link", ring: "ring-ring" },
  {
    tone: "positive",
    className: "bg-positive-tint text-positive",
    ring: "ring-positive",
  },
  {
    tone: "negative",
    className: "bg-negative-tint text-negative",
    ring: "ring-negative",
  },
  {
    tone: "pending",
    className: "bg-pending-tint text-pending",
    ring: "ring-pending",
  },
  { tone: "extra", className: "bg-extra-tint text-extra", ring: "ring-extra" },
  {
    tone: "neutral",
    className: "bg-neutral-tint text-neutral",
    ring: "ring-neutral",
  },
] as const

function PillsBlock() {
  return (
    <Block title="Badge & chip" meta="2 sizes / 2 styles / 6 tones">
      <Frame columns>
        {(["tint", "outline"] as const).map((style) =>
          ([32, 24] as const).map((height) => (
            <div key={`${style}-${height}`} className="flex flex-col gap-3 p-5">
              <Caption>
                {style} · {height}px
              </Caption>
              {PILL_TONES.map((pill) => (
                <div key={pill.tone} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full font-semibold capitalize",
                      height === 32
                        ? "h-8 px-3 type-caption"
                        : "h-6 px-2.5 type-micro",
                      style === "tint"
                        ? pill.className
                        : cn(
                            "ring-1 ring-inset",
                            pill.ring,
                            pill.className.split(" ")[1]
                          )
                    )}
                  >
                    <KWIcon
                      name="check"
                      size={height === 32 ? 14 : 12}
                      strokeWidth={2.4}
                    />
                    {pill.tone}
                    <KWIcon
                      name="close"
                      size={height === 32 ? 12 : 10}
                      strokeWidth={2.4}
                      className="opacity-70"
                    />
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-full",
                      height === 32 ? "size-8" : "size-6",
                      style === "tint"
                        ? pill.className
                        : cn(
                            "ring-1 ring-inset",
                            pill.ring,
                            pill.className.split(" ")[1]
                          )
                    )}
                  >
                    <KWIcon
                      name="heart"
                      size={height === 32 ? 14 : 12}
                      strokeWidth={2.2}
                    />
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </Frame>
    </Block>
  )
}

const MOVEMENTS: {
  style: KWTransactionStyle
  title: string
  amount: string
}[] = [
  { style: "expense", title: "Expense", amount: "−C$420.00" },
  { style: "income", title: "Income", amount: "+C$18,500.00" },
  { style: "transfer", title: "Transfer", amount: "C$2,000.00" },
  { style: "planned", title: "Planned", amount: "−C$299.00" },
]

function MovementsBlock() {
  return (
    <Block title="Movement styles" meta="KWTransactionIcon / amount colors">
      <Frame className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
        {MOVEMENTS.map((movement) => (
          <div key={movement.style} className="flex items-center gap-3">
            <KWTransactionIcon style={movement.style} />
            <div className="flex min-w-0 flex-col">
              <span className="type-label text-foreground">
                {movement.title}
              </span>
              <span
                className={cn(
                  "type-body font-semibold tabular-nums",
                  transactionAmountClass(movement.style)
                )}
              >
                {movement.amount}
              </span>
            </div>
          </div>
        ))}
      </Frame>
    </Block>
  )
}

const INPUT =
  "h-10 rounded-xl border-0 bg-secondary px-3 type-body shadow-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-secondary"

function FormsBlock() {
  return (
    <Block title="Forms" meta="40px fields / 12px radius">
      <Frame className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Placeholder">
          <Input className={INPUT} placeholder="Account name" />
        </Field>
        <Field label="Filled">
          <Input className={INPUT} defaultValue="BAC Credomatic" />
        </Field>
        <Field
          label="Invalid"
          hint={
            <span className="text-negative">Enter the last four digits.</span>
          }
        >
          <Input
            className={cn(
              INPUT,
              "ring-2 ring-negative focus-visible:ring-negative"
            )}
            defaultValue="12"
            aria-invalid
          />
        </Field>
        <Field label="Disabled">
          <Input className={INPUT} defaultValue="NIO" disabled />
        </Field>
      </Frame>
    </Block>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="type-label text-text-secondary">{label}</Label>
      {children}
      {hint ? <span className="type-caption">{hint}</span> : null}
    </div>
  )
}

function RowsBlock() {
  return (
    <Block
      title="Grouped card & rows"
      meta="KWGroupedCard / KWValueRow / KWEmptyState"
    >
      <Frame className="grid gap-5 p-5 lg:grid-cols-2">
        <KWGroupedCard>
          <KWValueRow
            label="Currency"
            value="Córdoba (NIO)"
            onClick={() => {}}
          />
          <KWValueRow
            label="Reminders"
            value="3 days before"
            onClick={() => {}}
          />
          <KWValueRow
            label="Main card"
            leading={<KWMiniCard color="azul" size="tiny" />}
            value="•••• 4821"
          />
          <KWValueRow label="Export CSV" tone="link" onClick={() => {}} />
          <KWValueRow
            label="Erase all data"
            tone="destructive"
            onClick={() => {}}
          />
        </KWGroupedCard>
        <div className="rounded-[var(--radius-surface)] bg-card">
          <KWEmptyState
            icon="list"
            title="No movements yet"
            message="Record your first expense or income to see it here."
            action={
              <KWButton icon="plus" shortcut="N">
                New expense
              </KWButton>
            }
          />
        </div>
      </Frame>
    </Block>
  )
}

function CardArtBlock() {
  const colors = CardColor.options
  return (
    <Block title="Card art" meta={`${colors.length} palettes / 135° gradients`}>
      <Frame className="grid gap-5 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {colors.map((color, index) => (
          <CardArt
            key={color}
            color={color}
            bank={color.charAt(0).toUpperCase() + color.slice(1)}
            kind="debit"
            network={(["visa", "mastercard", "amex"] as const)[index % 3]}
            lastFour={String(4821 + index * 111).slice(-4)}
            kindLabel="Debit"
            holder="KEEPWELL"
          />
        ))}
      </Frame>
    </Block>
  )
}

function IconsBlock() {
  const names = Object.keys(KW_ICONS) as KWIconName[]
  return (
    <Block
      title="Icons"
      meta={`${names.length} KWIcon glyphs / 24×24 / 2px stroke`}
    >
      <Frame className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1 p-3">
        {names.map((name) => (
          <div
            key={name}
            className="flex flex-col items-center gap-2 rounded-xl px-1 py-3 text-foreground transition-colors hover:bg-secondary/50"
          >
            <KWIcon name={name} size={24} />
            <span className="w-full truncate text-center type-micro text-text-faint">
              {name}
            </span>
          </div>
        ))}
      </Frame>
    </Block>
  )
}

const SPACING = [4, 8, 12, 16, 24, 32, 48]
const RADII = [
  { name: "mini", token: "--radius-mini" },
  { name: "input", token: "--radius-input" },
  { name: "card", token: "--radius-card" },
  { name: "surface", token: "--radius-surface" },
  { name: "full", token: "--radius-full" },
]
const SHADOWS = [
  { name: "glow", token: "--shadow-glow" },
  { name: "depth", token: "--shadow-depth" },
  { name: "elevated", token: "--shadow-elevated" },
  { name: "popover", token: "--shadow-popover" },
]

function SpacingBlock() {
  return (
    <Block
      title="Spacing, radius & elevation"
      meta="4px grid / KWRadius / KWShadow"
    >
      <Frame columns>
        <div className="flex flex-col gap-3 p-5">
          <Caption>spacing</Caption>
          {SPACING.map((px) => (
            <div key={px} className="flex items-center gap-4">
              <span className="flex w-12 justify-center">
                <span
                  className="bg-accent-tint ring-1 ring-ring ring-inset"
                  style={{ width: px, height: px, borderRadius: 2 }}
                />
              </span>
              <span className="type-caption text-text-secondary tabular-nums">
                {px}px
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 p-5">
          <Caption>radius</Caption>
          {RADII.map((radius) => (
            <RadiusRow key={radius.name} {...radius} />
          ))}
        </div>
        <div className="flex flex-col gap-5 p-5 pb-8">
          <Caption>elevation</Caption>
          <div className="grid grid-cols-2 gap-6">
            {SHADOWS.map((shadow) => (
              <div
                key={shadow.name}
                className="flex flex-col items-center gap-3"
              >
                <span
                  className="size-16 rounded-2xl bg-card"
                  style={{ boxShadow: `var(${shadow.token})` }}
                />
                <span className="type-caption text-text-secondary">
                  {shadow.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Frame>
    </Block>
  )
}

function RadiusRow({ name, token }: { name: string; token: string }) {
  const value = useToken(token)
  return (
    <div className="flex items-center gap-4">
      <span
        className="size-12 border-2 border-ring bg-accent-tint"
        style={{ borderRadius: `var(${token})` }}
      />
      <span className="flex flex-col">
        <span className="type-label text-foreground">{name}</span>
        <Caption>{value === "9999px" ? "pill" : value}</Caption>
      </span>
    </div>
  )
}
