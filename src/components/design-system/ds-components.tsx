"use client"

import { createElement, useState, type ReactNode } from "react"

import {
  KWActionButton,
  KWButton,
  KWChip,
  KWCircleButton,
  KWEmptyState,
  KWGroupedCard,
  KWLargeTitleHeader,
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
import { SkeletonList } from "@/components/kw/skeletons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { symbolIcon } from "@/lib/presentation/icons"
import { CardColor } from "@/lib/schema"
import { cn } from "@/lib/utils"

import {
  Block,
  Caption,
  Code,
  DocSection,
  DoDont,
  Frame,
  PropsTable,
} from "./ds-parts"

// Componentes: cada uno con su ejemplo vivo (el componente real de src/components/kw), sus
// variantes, la tabla de propiedades y el código para usarlo.

// MARK: - Botones

const VARIANTS: { variant: KWButtonVariant; use: string }[] = [
  {
    variant: "primary",
    use: "La acción principal de la pantalla o del diálogo. Una por vista.",
  },
  { variant: "secondary", use: "Acciones de apoyo junto a la principal." },
  {
    variant: "surface",
    use: "Acciones sobre el fondo negro (sobre bg-card no se distingue).",
  },
  { variant: "destructive", use: "Borrar, eliminar, cerrar sesión." },
  {
    variant: "link",
    use: "Acciones que llevan a otra parte, con el color de enlace.",
  },
  {
    variant: "plain",
    use: "Cancelar, acciones terciarias. Sin fondo hasta el hover.",
  },
]

const SIZES: { size: KWButtonSize; px: number }[] = [
  { size: "large", px: 48 },
  { size: "regular", px: 40 },
  { size: "small", px: 32 },
]

export function ButtonsSection() {
  return (
    <DocSection
      id="botones"
      eyebrow="Componentes"
      title="Botones"
      description="Todos los botones son píldoras (rounded-full) y responden al pulsar con una leve reducción. Nunca uses el Button de shadcn en pantalla: usa KWButton, KWCircleButton o KWActionButton."
    >
      <Block
        id="kwbutton"
        title="KWButton"
        meta="6 estilos · 3 alturas"
        source="@/components/kw/design"
      >
        <Frame columns>
          {SIZES.map(({ size, px }) => (
            <div key={size} className="flex flex-col gap-4 p-5">
              <Caption>
                size=&quot;{size}&quot; · {px} px
              </Caption>
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
              <div className="flex items-center gap-3">
                <KWButton size={size} icon="plus" disabled>
                  Botón
                </KWButton>
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-4 p-5">
            <Caption>variant</Caption>
            {VARIANTS.map(({ variant, use }) => (
              <div
                key={variant}
                className="flex h-12 max-w-64 flex-col justify-center"
              >
                <span className="font-mono type-caption text-foreground">
                  {variant}
                </span>
                <span
                  className="truncate type-caption-sm text-text-faint"
                  title={use}
                >
                  {use}
                </span>
              </div>
            ))}
            <div className="flex h-12 flex-col justify-center">
              <span className="font-mono type-caption text-foreground">
                disabled
              </span>
              <span className="type-caption-sm text-text-faint">
                40 % de opacidad
              </span>
            </div>
          </div>
        </Frame>
        <Frame className="flex flex-wrap items-center gap-3 p-5">
          <KWButton icon="plus" shortcut="N">
            Nuevo gasto
          </KWButton>
          <KWButton variant="surface" icon="search" shortcut="⌘K">
            Buscar
          </KWButton>
          <div className="w-full sm:w-72">
            <KWButton size="large" fill>
              Continuar
            </KWButton>
          </div>
        </Frame>
        <PropsTable
          rows={[
            {
              name: "variant",
              type: '"primary" | "secondary" | "surface" | "destructive" | "link" | "plain"',
              defaultValue: '"primary"',
              description: "El rol del botón (ver lista de arriba).",
            },
            {
              name: "size",
              type: '"large" | "regular" | "row" | "text" | "medium" | "small" | "mini"',
              defaultValue: '"regular"',
              description:
                "large = 48 px; regular, row, text y medium = 40 px; small y mini = 32 px.",
            },
            {
              name: "icon",
              type: "KWIconName",
              description: "Icono a la izquierda del texto.",
            },
            {
              name: "shortcut",
              type: "string",
              description: "Atajo de teclado que se muestra dentro del botón.",
            },
            {
              name: "fill",
              type: "boolean",
              defaultValue: "false",
              description: "Ocupa todo el ancho disponible.",
            },
          ]}
        />
        <Code
          code={`import { KWButton, KWButtonLink } from "@/components/kw/design"

<KWButton icon="plus" shortcut="N" onClick={openEditor}>Nuevo gasto</KWButton>
<KWButton variant="plain">Cancelar</KWButton>
<KWButtonLink href="/accounts" variant="link">Ver cuentas</KWButtonLink>`}
        />
      </Block>

      <Block
        id="circulares"
        title="KWCircleButton y KWActionButton"
        meta="40 px · 48 px con texto"
        description="El botón circular sirve para acciones con solo icono (buscar, cerrar, volver, «+»); siempre lleva una etiqueta accesible y un tooltip con su atajo. El botón de acción es un círculo de 48 px con su nombre debajo, como en la ficha de una cuenta."
      >
        <Frame columns>
          <div className="flex flex-col gap-4 p-5">
            <Caption>KWCircleButton · surface · white · translucent</Caption>
            <div className="flex items-center gap-3">
              <KWCircleButton
                icon="plus"
                label="Añadir"
                variant="white"
                shortcut="N"
              />
              <KWCircleButton icon="search" label="Buscar" shortcut="/" />
              <KWCircleButton icon="chevronLeft" label="Volver" />
              <KWCircleButton icon="close" label="Cerrar" shortcut="Esc" />
              <KWCircleButton icon="more" label="Más" size={32} />
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
                label="Mostrar saldos"
                variant="translucent"
              />
              <KWCircleButton
                icon="share"
                label="Compartir"
                variant="translucent"
              />
            </div>
          </div>
          <div className="flex flex-col gap-4 p-5">
            <Caption>KWActionButton · prominent · neutral · active</Caption>
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
        <Code
          code={`<KWCircleButton icon="search" label="Buscar" shortcut="/" onClick={openSearch} />
<KWCircleButton icon="plus" label="Añadir" variant="white" />
<KWActionButton icon="transfer" title="Transferir" onClick={transfer} />`}
        />
      </Block>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DoDont
          good
          note="Una sola acción principal blanca; las demás, secundarias o planas."
        >
          <KWButton variant="plain">Cancelar</KWButton>
          <KWButton>Guardar</KWButton>
        </DoDont>
        <DoDont
          good={false}
          note="No pongas dos botones principales juntos: compiten por la atención."
        >
          <KWButton>Guardar</KWButton>
          <KWButton>Enviar</KWButton>
        </DoDont>
        <DoDont
          good={false}
          note="No mezcles alturas en una misma fila (aquí 40 px junto a 36 px)."
        >
          <KWButton>Guardar</KWButton>
          <span
            className="inline-flex items-center rounded-md bg-secondary px-3 type-label text-foreground"
            style={{ height: 36 }}
          >
            Otro
          </span>
        </DoDont>
      </div>
    </DocSection>
  )
}

// MARK: - Selección

export function SelectionSection() {
  const [period, setPeriod] = useState<"week" | "month" | "year">("month")
  const [direction, setDirection] = useState<"out" | "in">("out")
  const [range, setRange] = useState<"1m" | "3m" | "6m" | "1y">("3m")
  const [filter, setFilter] = useState("todos")
  const [currency, setCurrency] = useState("NIO")
  const [highlight, setHighlight] = useState(true)
  return (
    <DocSection
      id="seleccion"
      eyebrow="Componentes"
      title="Segmentados y chips"
      description="Para elegir entre opciones. El segmentado es una elección única dentro de una cápsula; los chips filtran listas. En ambos, la selección se desliza de una opción a otra."
    >
      <Block
        title="KWSegmented"
        meta="large · compact · accent"
        source="@/components/kw/design"
      >
        <Frame className="flex flex-col gap-5 p-5">
          <div className="flex flex-col gap-2">
            <Caption>
              style=&quot;large&quot; · 40 px · anchos iguales, ocupa todo el
              ancho
            </Caption>
            <div className="max-w-md">
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
          </div>
          <div className="flex flex-wrap gap-8">
            <div className="flex flex-col gap-2">
              <Caption>style=&quot;compact&quot; · 32 px</Caption>
              <KWSegmented
                aria-label="Dirección"
                style="compact"
                value={direction}
                onChange={setDirection}
                options={[
                  { value: "out", title: "Salidas" },
                  { value: "in", title: "Entradas" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Caption>
                style=&quot;accent&quot; · 32 px · selección azul
              </Caption>
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
          </div>
        </Frame>
        <PropsTable
          rows={[
            {
              name: "options",
              type: "{ value: T; title: string; disabled?: boolean }[]",
              description: "Las opciones, en orden.",
            },
            {
              name: "value",
              type: "T",
              description: "La opción seleccionada.",
            },
            {
              name: "onChange",
              type: "(value: T) => void",
              description: "Se llama al elegir otra opción.",
            },
            {
              name: "style",
              type: '"large" | "compact" | "accent"',
              defaultValue: '"large"',
              description: "Tamaño y color de la selección.",
            },
            {
              name: "aria-label",
              type: "string",
              description: "Nombre del grupo para lectores de pantalla.",
            },
          ]}
        />
      </Block>

      <Block
        title="KWChip"
        meta="filled · outlined · extra"
        source="@/components/kw/design"
      >
        <Frame className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Caption className="w-24">filled</Caption>
            {["todos", "gastos", "ingresos", "transferencias"].map((value) => (
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
          <div className="flex flex-wrap items-center gap-2">
            <Caption className="w-24">outlined</Caption>
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
          <div className="flex flex-wrap items-center gap-2">
            <Caption className="w-24">extra</Caption>
            <KWChip
              look="extra"
              selected={highlight}
              onClick={() => setHighlight((value) => !value)}
            >
              <KWIcon name="bolt" size={14} /> Destacar
            </KWChip>
          </div>
        </Frame>
        <Code
          code={`const pillId = useId() // los chips con el mismo pillId deslizan la selección
<KWChip selected={filter === "gastos"} pillId={pillId} onClick={() => setFilter("gastos")}>
  Gastos
</KWChip>`}
        />
      </Block>
    </DocSection>
  )
}

// MARK: - Estados y píldoras

const PILL_TONES = [
  {
    tone: "accent",
    label: "Nuevo",
    tint: "bg-accent-tint text-link",
    ring: "ring-ring text-link",
  },
  {
    tone: "positive",
    label: "Pagado",
    tint: "bg-positive-tint text-positive",
    ring: "ring-positive text-positive",
  },
  {
    tone: "negative",
    label: "Vencido",
    tint: "bg-negative-tint text-negative",
    ring: "ring-negative text-negative",
  },
  {
    tone: "pending",
    label: "Pendiente",
    tint: "bg-pending-tint text-pending",
    ring: "ring-pending text-pending",
  },
  {
    tone: "extra",
    label: "Destacado",
    tint: "bg-extra-tint text-extra",
    ring: "ring-extra text-extra",
  },
  {
    tone: "neutral",
    label: "Archivado",
    tint: "bg-neutral-tint text-neutral",
    ring: "ring-neutral text-neutral",
  },
]

const MOVEMENTS: {
  style: KWTransactionStyle
  title: string
  amount: string
  note: string
}[] = [
  {
    style: "expense",
    title: "Gasto",
    amount: "−C$420.00",
    note: "Coral suave, nunca rojo de alarma.",
  },
  { style: "income", title: "Ingreso", amount: "+C$18,500.00", note: "Verde." },
  {
    style: "transfer",
    title: "Transferencia",
    amount: "C$2,000.00",
    note: "Neutro: el dinero no sale de tus cuentas.",
  },
  {
    style: "planned",
    title: "Planificado",
    amount: "−C$299.00",
    note: "Ámbar: aún no ha ocurrido.",
  },
]

const CATEGORY_SAMPLES = [
  { symbol: "fork.knife", name: "Restaurantes", color: "amber" },
  { symbol: "cart", name: "Compras", color: "orange" },
  { symbol: "bus", name: "Transporte", color: "purple" },
  { symbol: "bolt", name: "Servicios", color: "cyan" },
  { symbol: "gamecontroller", name: "Ocio", color: "pink" },
  { symbol: "book", name: "Educación", color: "yellow" },
]

export function StatusSection() {
  return (
    <DocSection
      id="estados"
      eyebrow="Componentes"
      title="Movimientos, categorías y estados"
      description="El color dice qué pasó con el dinero. Primero se lee la dirección (gasto, ingreso, transferencia) y después la categoría."
    >
      <Block
        title="KWTransactionIcon"
        meta="40 px · círculo con tinte"
        source="@/components/kw/design"
      >
        <Frame className="grid gap-5 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {MOVEMENTS.map((movement) => (
            <div key={movement.style} className="flex items-start gap-3">
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
                <span className="type-caption-sm text-text-faint">
                  {movement.note}
                </span>
              </div>
            </div>
          ))}
        </Frame>
        <Code
          code={`<KWTransactionIcon style="expense" />
<span className={transactionAmountClass("expense")}>−C$420.00</span>`}
        />
      </Block>

      <Block
        title="Insignia de categoría"
        meta="CategoryBadge · tinte al 16 %"
        description="El símbolo de la categoría sobre un círculo teñido con su color. Tamaños: xs 24, sm 32, md 40, lg 48 px."
      >
        <Frame className="flex flex-wrap gap-6 p-5">
          {CATEGORY_SAMPLES.map((category) => (
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
        </Frame>
      </Block>

      <Block
        title="Píldoras de estado"
        meta="patrón · 2 estilos · 2 tamaños"
        description="Etiquetas cortas de estado. Con tinte por defecto; con contorno cuando hay muchas juntas. Siempre texto + color, nunca solo color."
      >
        <Frame columns>
          {(["tint", "outline"] as const).map((look) =>
            ([32, 24] as const).map((height) => (
              <div
                key={`${look}-${height}`}
                className="flex flex-col gap-3 p-5"
              >
                <Caption>
                  {look === "tint" ? "tinte" : "contorno"} · {height} px
                </Caption>
                {PILL_TONES.map((pill) => (
                  <span
                    key={pill.tone}
                    className={cn(
                      "inline-flex items-center gap-1.5 self-start rounded-full font-semibold",
                      height === 32
                        ? "h-8 px-3 type-caption"
                        : "h-6 px-2.5 type-micro",
                      look === "tint"
                        ? pill.tint
                        : cn("ring-1 ring-inset", pill.ring)
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {pill.label}
                  </span>
                ))}
              </div>
            ))
          )}
        </Frame>
        <Code
          code={`<span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-positive-tint px-2.5 type-micro text-positive">
  Pagado
</span>`}
        />
      </Block>
    </DocSection>
  )
}

// MARK: - Formularios

const FIELD =
  "h-10 rounded-xl border-0 bg-secondary px-3 type-body shadow-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-secondary"

export function FormsSection() {
  return (
    <DocSection
      id="formularios"
      eyebrow="Componentes"
      title="Formularios"
      description="Campos de 40 px con esquinas de 12 px sobre bg-secondary. La etiqueta va arriba; el error, debajo y en coral. El foco se marca con el anillo azul."
    >
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
      <Code
        code={`<Label className="type-label text-text-secondary">Nombre</Label>
<Input className="h-10 rounded-xl border-0 bg-secondary px-3 type-body shadow-none
                  focus-visible:ring-2 focus-visible:ring-ring dark:bg-secondary" />`}
      />
    </DocSection>
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

// MARK: - Listas y tarjetas

export function ListsSection() {
  return (
    <DocSection
      id="listas"
      eyebrow="Componentes"
      title="Listas y tarjetas"
      description="El contenido se agrupa en tarjetas bg-card de 20 px de radio con filas separadas por líneas finas, como las listas agrupadas de iOS."
    >
      <Block
        title="KWSection + KWGroupedCard + KWValueRow"
        source="@/components/kw/design"
      >
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
              <KWValueRow label="Exportar CSV" tone="link" onClick={() => {}} />
              <KWValueRow
                label="Borrar todos los datos"
                tone="destructive"
                onClick={() => {}}
              />
            </KWGroupedCard>
          </KWSection>
          <div className="flex flex-col gap-2">
            <Caption>Cargando (SkeletonList)</Caption>
            <SkeletonList rows={4} />
          </div>
        </Frame>
        <PropsTable
          rows={[
            {
              name: "label",
              type: "ReactNode",
              description: "El texto de la fila.",
            },
            {
              name: "value",
              type: "ReactNode",
              description: "El valor a la derecha, en text-secondary.",
            },
            {
              name: "leading",
              type: "ReactNode",
              description: "Icono o miniatura a la izquierda.",
            },
            {
              name: "href | onClick",
              type: "string | () => void",
              description:
                "La convierte en fila navegable: chevron, hover y foco.",
            },
            {
              name: "tone",
              type: '"default" | "destructive" | "link"',
              defaultValue: '"default"',
              description: "Color del texto.",
            },
          ]}
        />
        <Code
          code={`<KWSection title="Preferencias" action={<KWTextAction>+ Añadir</KWTextAction>}>
  <KWGroupedCard>
    <KWValueRow label="Moneda" value="Córdoba (NIO)" href="/settings/currency" />
    <KWValueRow label="Borrar todos los datos" tone="destructive" onClick={confirm} />
  </KWGroupedCard>
</KWSection>`}
        />
      </Block>

      <Block
        title="CardArt y KWMiniCard"
        meta="9 paletas · proporción 1,586 (tarjeta ISO)"
        source="@/components/kw/primitives"
      >
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
        <Frame className="flex flex-wrap items-center gap-4 p-5">
          {CardColor.options.map((color) => (
            <KWMiniCard key={color} color={color} />
          ))}
          <KWMiniCard kind="cash" />
          <KWMiniCard kind="transfer" />
        </Frame>
        <Code
          code={`<CardArt color="azul" bank="BAC" kind="debit" network="visa" lastFour="4821" />
<KWMiniCard color="oro" size="tiny" />`}
        />
      </Block>
    </DocSection>
  )
}

// MARK: - Comunicación

export function FeedbackSection() {
  const [open, setOpen] = useState(false)
  return (
    <DocSection
      id="comunicacion"
      eyebrow="Componentes"
      title="Comunicación"
      description="Cómo la interfaz le habla a la persona: estados vacíos, avisos, diálogos y atajos."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Block
          title="KWEmptyState"
          description="Icono en un círculo, un título corto, una frase y el siguiente paso."
        >
          <Frame>
            <KWEmptyState
              icon="list"
              title="Aún no hay movimientos"
              message="Registra tu primer gasto o ingreso para verlo aquí."
              action={
                <KWButton icon="plus" shortcut="N">
                  Nuevo gasto
                </KWButton>
              }
            />
          </Frame>
        </Block>
        <div className="flex flex-col gap-6">
          <Block
            title="Avisos (toast)"
            description="Confirman una acción sin interrumpir. Abajo a la derecha; el de éxito dibuja su check."
          >
            <Frame className="flex flex-wrap gap-3 p-5">
              <KWButton
                variant="secondary"
                onClick={() =>
                  toast.add({ title: "Movimiento guardado", type: "success" })
                }
              >
                Aviso de éxito
              </KWButton>
              <KWButton
                variant="secondary"
                onClick={() =>
                  toast.add({
                    title: "Copia de seguridad descargada",
                    description: "Guárdala en un lugar seguro.",
                  })
                }
              >
                Aviso con descripción
              </KWButton>
            </Frame>
          </Block>
          <Block
            title="Diálogos"
            description="En escritorio, un diálogo centrado; la acción principal blanca a la derecha y la secundaria plana."
          >
            <Frame className="p-5">
              <KWButton variant="destructive" onClick={() => setOpen(true)}>
                Abrir diálogo de ejemplo
              </KWButton>
            </Frame>
          </Block>
          <Block
            title="Atajos y tooltips"
            description="Todo botón de solo icono tiene tooltip con su nombre y su atajo."
          >
            <Frame className="flex flex-wrap items-center gap-4 p-5">
              <KWCircleButton icon="search" label="Buscar" shortcut="⌘K" />
              <span className="flex items-center gap-1.5 type-caption text-text-secondary">
                <Kbd>G</Kbd> luego <Kbd>T</Kbd> va a Movimientos
              </span>
            </Frame>
          </Block>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-5 rounded-2xl bg-card p-6 ring-1 ring-border/60 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="type-heading">
              ¿Borrar esta cuenta?
            </DialogTitle>
            <DialogDescription className="type-body leading-relaxed text-muted-foreground">
              Se borrarán también sus movimientos. Esta acción no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-6 -mb-6 gap-2 rounded-b-2xl border-divider bg-transparent px-6 pb-6">
            <KWButton variant="plain" onClick={() => setOpen(false)}>
              Cancelar
            </KWButton>
            <KWButton variant="destructive" onClick={() => setOpen(false)}>
              Borrar cuenta
            </KWButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DocSection>
  )
}

// MARK: - Pantalla de ejemplo (anatomía)

export function AnatomySection() {
  return (
    <DocSection
      id="anatomia"
      eyebrow="Patrones"
      title="Anatomía de una pantalla"
      description="Toda pantalla sigue el mismo orden, para que los títulos se alineen de una pantalla a otra."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Frame className="flex flex-col gap-6 p-6">
          <Marked n={1} label="Page">
            <div className="flex flex-col gap-6">
              <Marked n={2} label="KWLargeTitleHeader">
                <KWLargeTitleHeader
                  title="Cuentas"
                  subtitle="3 cuentas · C$24,310"
                  trailing={
                    <KWCircleButton
                      icon="plus"
                      label="Añadir cuenta"
                      variant="white"
                    />
                  }
                />
              </Marked>
              <Marked n={3} label="KWSection">
                <KWSection
                  title="Tarjetas"
                  action={<KWTextAction>+ Añadir</KWTextAction>}
                >
                  <Marked n={4} label="KWGroupedCard + filas">
                    <KWGroupedCard>
                      <KWValueRow
                        label="BAC Débito"
                        leading={<KWMiniCard color="azul" size="tiny" />}
                        value="C$12,480"
                        onClick={() => {}}
                      />
                      <KWValueRow
                        label="Lafise Crédito"
                        leading={<KWMiniCard color="oro" size="tiny" />}
                        value="C$9,830"
                        onClick={() => {}}
                      />
                    </KWGroupedCard>
                  </Marked>
                </KWSection>
              </Marked>
            </div>
          </Marked>
        </Frame>
        <ol className="flex flex-col gap-3">
          {[
            [
              "Page",
              "El contenedor: un solo ancho (1400 px) y los mismos márgenes en todas las pantallas. Nunca cambies su ancho.",
            ],
            [
              "KWLargeTitleHeader",
              "Título de 30 px, subtítulo opcional y a la derecha botones circulares o un KWButton principal.",
            ],
            [
              "KWSection",
              "Un título pequeño y, opcionalmente, una acción de texto («+ Añadir») en color de enlace.",
            ],
            [
              "KWGroupedCard",
              "La tarjeta con las filas. Listas tipo ajustes con KWValueRow; movimientos con TransactionRow.",
            ],
          ].map(([name, text], index) => (
            <li key={name} className="flex gap-3 rounded-2xl bg-card p-4">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ring type-micro text-white">
                {index + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-mono type-label text-foreground">
                  {name}
                </span>
                <span className="type-caption leading-relaxed text-muted-foreground">
                  {text}
                </span>
              </span>
            </li>
          ))}
          <li className="rounded-2xl bg-card p-4 type-caption leading-relaxed text-muted-foreground">
            Desde <code className="font-mono text-foreground">lg</code> la
            pantalla pasa a dos columnas: la lista a la izquierda y el detalle
            en un panel lateral. En teléfono, los diálogos ocupan toda la
            pantalla.
          </li>
        </ol>
      </div>
    </DocSection>
  )
}

function Marked({
  n,
  label,
  children,
}: {
  n: number
  label: string
  children: ReactNode
}) {
  return (
    <div className="relative rounded-2xl p-3 ring-1 ring-ring/50 ring-inset">
      <span className="absolute -top-2.5 left-3 inline-flex items-center gap-1 rounded-full bg-ring px-2 type-micro text-white">
        {n} · {label}
      </span>
      <div className="pt-2">{children}</div>
    </div>
  )
}
