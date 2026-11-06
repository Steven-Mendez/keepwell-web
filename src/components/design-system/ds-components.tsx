"use client"

import { createElement, useState, type ReactNode } from "react"

import {
  KWActionButton,
  KWButton,
  KWChip,
  KWCircleButton,
  KWEmptyState,
  KWGroupedCard,
  KWSection,
  KWSegmented,
  KWTextAction,
  KWTransactionIcon,
  KWValueRow,
  type KWButtonSize,
  type KWButtonVariant,
  type KWTransactionStyle,
} from "@/components/kw/design"
import { transactionAmountClass } from "@/components/kw/design-styles"
import { KWIcon, KWMiniCard } from "@/components/kw/kw-icon"
import { CardArt } from "@/components/kw/primitives"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { symbolIcon } from "@/lib/presentation/icons"
import { CardColor } from "@/lib/schema"
import { cn } from "@/lib/utils"

import { Block, Caption, DocSection, Frame } from "./ds-parts"

// Cómo se ven los componentes de la app, dibujados con los componentes reales.

const VARIANTS: { variant: KWButtonVariant; name: string }[] = [
  { variant: "primary", name: "Principal" },
  { variant: "secondary", name: "Secundario" },
  { variant: "surface", name: "Superficie" },
  { variant: "destructive", name: "Destructivo" },
  { variant: "link", name: "Enlace" },
  { variant: "plain", name: "Plano" },
]

const SIZES: { size: KWButtonSize; px: number }[] = [
  { size: "large", px: 48 },
  { size: "regular", px: 40 },
  { size: "small", px: 32 },
]

const MOVEMENTS: {
  style: KWTransactionStyle
  title: string
  amount: string
}[] = [
  { style: "expense", title: "Gasto", amount: "−C$420.00" },
  { style: "income", title: "Ingreso", amount: "+C$18,500.00" },
  { style: "transfer", title: "Transferencia", amount: "C$2,000.00" },
  { style: "planned", title: "Planificado", amount: "−C$299.00" },
]

const CATEGORIES = [
  { symbol: "fork.knife", name: "Restaurantes", color: "amber" },
  { symbol: "cart", name: "Compras", color: "orange" },
  { symbol: "bus", name: "Transporte", color: "purple" },
  { symbol: "bolt", name: "Servicios", color: "cyan" },
  { symbol: "gamecontroller", name: "Ocio", color: "pink" },
  { symbol: "book", name: "Educación", color: "yellow" },
]

const PILLS = [
  { label: "Pagado", look: "bg-positive-tint text-positive" },
  { label: "Vencido", look: "bg-negative-tint text-negative" },
  { label: "Pendiente", look: "bg-pending-tint text-pending" },
  { label: "Nuevo", look: "bg-accent-tint text-link" },
  { label: "Archivado", look: "bg-neutral-tint text-neutral" },
]

export function ComponentsSection() {
  const [period, setPeriod] = useState<"week" | "month" | "year">("month")
  const [range, setRange] = useState<"1m" | "3m" | "6m" | "1y">("3m")
  const [filter, setFilter] = useState("todos")
  return (
    <DocSection id="componentes" title="Componentes">
      <Block title="Botones">
        <Frame columns>
          {SIZES.map(({ size, px }) => (
            <div key={size} className="flex flex-col gap-4 p-5">
              <Caption>{px} px de alto</Caption>
              {VARIANTS.map(({ variant }) => (
                <div key={variant} className="flex items-center gap-3">
                  <KWButton variant={variant} size={size} icon="plus">
                    Botón
                  </KWButton>
                  <KWButton
                    variant={variant}
                    size={size}
                    aria-label="Siguiente"
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
              <KWButton size={size} icon="plus" disabled className="self-start">
                Botón
              </KWButton>
            </div>
          ))}
        </Frame>
        <Caption>
          De arriba abajo:{" "}
          {[...VARIANTS.map((v) => v.name), "deshabilitado"]
            .join(" · ")
            .toLowerCase()}
        </Caption>
        <Frame columns>
          <div className="flex flex-col gap-4 p-5">
            <Caption>Botones redondos</Caption>
            <div className="flex items-center gap-3">
              <KWCircleButton icon="plus" label="Añadir" variant="white" />
              <KWCircleButton icon="search" label="Buscar" />
              <KWCircleButton icon="chevronLeft" label="Volver" />
              <KWCircleButton icon="close" label="Cerrar" />
            </div>
          </div>
          <div className="flex flex-col gap-4 p-5">
            <Caption>Botones de acción</Caption>
            <div className="flex items-start gap-2">
              <KWActionButton
                icon="arrowUpRight"
                title="Gasto"
                variant="prominent"
              />
              <KWActionButton icon="arrowDownLeft" title="Ingreso" />
              <KWActionButton icon="transfer" title="Transferir" />
              <KWActionButton icon="freeze" title="Congelar" variant="active" />
            </div>
          </div>
        </Frame>
      </Block>

      <Block title="Selectores y filtros">
        <Frame className="flex flex-wrap items-start gap-8 p-5">
          <div className="flex w-full max-w-sm flex-col gap-2">
            <Caption>Selector</Caption>
            <KWSegmented
              aria-label="Periodo"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "week", title: "Semana" },
                { value: "month", title: "Mes" },
                { value: "year", title: "Año" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Caption>Selector compacto</Caption>
            <KWSegmented
              aria-label="Rango"
              style="accent"
              value={range}
              onChange={setRange}
              options={[
                { value: "1m", title: "1M" },
                { value: "3m", title: "3M" },
                { value: "6m", title: "6M" },
                { value: "1y", title: "1A" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Caption>Filtros</Caption>
            <div className="flex flex-wrap gap-2">
              {["todos", "gastos", "ingresos"].map((value) => (
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
          </div>
        </Frame>
      </Block>

      <Block title="Movimientos, categorías y estados">
        <Frame className="flex flex-col gap-6 p-5">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {MOVEMENTS.map((movement) => (
              <div key={movement.style} className="flex items-center gap-3">
                <KWTransactionIcon style={movement.style} />
                <div className="flex flex-col">
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
          </div>
          <div className="flex flex-wrap gap-6">
            {CATEGORIES.map((category) => (
              <div
                key={category.symbol}
                className="flex flex-col items-center gap-2"
              >
                <span
                  className="inline-flex size-10 items-center justify-center rounded-full"
                  style={{
                    color: `var(--category-${category.color})`,
                    backgroundColor: `color-mix(in srgb, var(--category-${category.color}) 16%, transparent)`,
                  }}
                >
                  {createElement(symbolIcon(category.symbol), {
                    className: "size-5",
                    strokeWidth: 2,
                  })}
                </span>
                <Caption>{category.name}</Caption>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {PILLS.map((pill) => (
              <span
                key={pill.label}
                className={cn(
                  "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 type-micro",
                  pill.look
                )}
              >
                <span className="size-1.5 rounded-full bg-current" />
                {pill.label}
              </span>
            ))}
          </div>
        </Frame>
      </Block>

      <Block title="Campos de texto">
        <Frame className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Vacío">
            <Input className={FIELD} placeholder="Nombre de la cuenta" />
          </Field>
          <Field label="Con valor">
            <Input className={FIELD} defaultValue="BAC Credomatic" />
          </Field>
          <Field
            label="Con error"
            hint={
              <span className="text-negative">
                Escribe los últimos cuatro dígitos.
              </span>
            }
          >
            <Input
              className={cn(
                FIELD,
                "ring-2 ring-negative focus-visible:ring-negative"
              )}
              defaultValue="12"
              aria-invalid
            />
          </Field>
          <Field label="Deshabilitado">
            <Input className={FIELD} defaultValue="NIO" disabled />
          </Field>
        </Frame>
      </Block>

      <Block title="Listas y estado vacío">
        <Frame className="grid gap-6 p-5 lg:grid-cols-2">
          <KWSection
            title="Preferencias"
            action={<KWTextAction>+ Añadir</KWTextAction>}
          >
            <KWGroupedCard>
              <KWValueRow
                label="Moneda"
                value="Córdoba (NIO)"
                onClick={() => {}}
              />
              <KWValueRow
                label="Recordatorios"
                value="3 días antes"
                onClick={() => {}}
              />
              <KWValueRow
                label="Tarjeta principal"
                leading={<KWMiniCard color="azul" size="tiny" />}
                value="•••• 4821"
              />
              <KWValueRow
                label="Borrar todos los datos"
                tone="destructive"
                onClick={() => {}}
              />
            </KWGroupedCard>
          </KWSection>
          <div className="rounded-[var(--radius-surface)] bg-card">
            <KWEmptyState
              icon="list"
              title="Aún no hay movimientos"
              message="Registra tu primer gasto o ingreso para verlo aquí."
              action={<KWButton icon="plus">Nuevo gasto</KWButton>}
            />
          </div>
        </Frame>
      </Block>

      <Block title="Tarjetas de pago">
        <Frame className="grid gap-5 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {CardColor.options.map((color, index) => (
            <CardArt
              key={color}
              color={color}
              bank={color.charAt(0).toUpperCase() + color.slice(1)}
              kind="debit"
              network={(["visa", "mastercard", "amex"] as const)[index % 3]}
              lastFour={String(4821 + index * 111).slice(-4)}
              kindLabel="Débito"
              holder="KEEPWELL"
            />
          ))}
        </Frame>
      </Block>
    </DocSection>
  )
}

const FIELD =
  "h-10 rounded-xl border-0 bg-secondary px-3 type-body shadow-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-secondary"

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
