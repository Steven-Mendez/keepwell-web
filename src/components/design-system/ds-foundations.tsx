"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { SpecList } from "./ds-brand"
import {
  Block,
  Caption,
  Code,
  ContrastBadge,
  contrastRatio,
  Copyable,
  copyText,
  DocSection,
  Frame,
  Panel,
  Tag,
  useToken,
} from "./ds-parts"

// Fundamentos: color, tipografía, espaciado y maquetación, radios, elevación y movimiento. Cada valor
// se lee en vivo de tokens.css (generado desde el DesignSystem de iOS), así que nunca se desfasa.

// MARK: - Color

const PALETTE: {
  name: string
  description: string
  tokens: { token: string; name: string }[]
}[] = [
  {
    name: "Superficies",
    description:
      "De la pantalla negra a los controles. Cada nivel se apila sobre el anterior.",
    tokens: [
      { token: "--kw-surface-bg", name: "bg" },
      { token: "--kw-surface-nav", name: "nav" },
      { token: "--kw-surface-surface", name: "surface" },
      { token: "--kw-surface-divider", name: "divider" },
      { token: "--kw-surface-surface2", name: "surface2" },
      { token: "--kw-surface-border", name: "border" },
      { token: "--kw-surface-control-off", name: "control-off" },
      { token: "--kw-surface-light", name: "light" },
    ],
  },
  {
    name: "Texto",
    description: "Cuatro niveles de jerarquía sobre fondos oscuros.",
    tokens: [
      { token: "--kw-text-primary", name: "primary" },
      { token: "--kw-text-secondary", name: "secondary" },
      { token: "--kw-text-muted", name: "muted" },
      { token: "--kw-text-faint", name: "faint" },
      { token: "--kw-text-on-brand", name: "on-brand" },
    ],
  },
  {
    name: "Marca",
    description: "Solo para el logo, acentos (foco, enlaces) y gráficos.",
    tokens: [
      { token: "--kw-brand-b900", name: "b900" },
      { token: "--kw-brand-b700", name: "b700" },
      { token: "--kw-brand-b600", name: "b600" },
      { token: "--kw-brand-b500", name: "b500" },
      { token: "--kw-brand-accent", name: "accent" },
      { token: "--kw-brand-link", name: "link" },
      { token: "--kw-brand-link-hover", name: "link-hover" },
    ],
  },
  {
    name: "Estados",
    description:
      "El significado del dinero: gastos, ingresos, pendientes y destacados.",
    tokens: [
      { token: "--kw-state-negative", name: "negative" },
      { token: "--kw-state-positive", name: "positive" },
      { token: "--kw-state-pending", name: "pending" },
      { token: "--kw-state-extra", name: "extra" },
    ],
  },
  {
    name: "Categorías",
    description:
      "La paleta que la persona elige para sus categorías; también colorea los gráficos.",
    tokens: [
      "blue",
      "purple",
      "pink",
      "orange",
      "amber",
      "yellow",
      "lime",
      "green",
      "cyan",
      "gray",
    ].map((name) => ({ token: `--category-${name}`, name })),
  },
]

const ROLES: { utility: string; token: string; use: string }[] = [
  {
    utility: "bg-background",
    token: "--background",
    use: "El fondo de toda pantalla (negro, como iOS).",
  },
  {
    utility: "bg-card",
    token: "--card",
    use: "Tarjetas agrupadas, secciones, diálogos.",
  },
  {
    utility: "bg-secondary",
    token: "--secondary",
    use: "Controles dentro de una tarjeta: campos, chips, botones secundarios.",
  },
  {
    utility: "bg-nav",
    token: "--nav",
    use: "La barra lateral y la barra de pestañas.",
  },
  {
    utility: "divide-divider",
    token: "--divider",
    use: "Separadores entre filas de una tarjeta.",
  },
  {
    utility: "border-border",
    token: "--border",
    use: "Bordes de campos y contornos.",
  },
  {
    utility: "text-foreground",
    token: "--foreground",
    use: "Texto principal y totales destacados.",
  },
  {
    utility: "text-text-secondary",
    token: "--text-secondary",
    use: "Valores de filas, texto de apoyo.",
  },
  {
    utility: "text-muted-foreground",
    token: "--muted-foreground",
    use: "Subtítulos, descripciones.",
  },
  {
    utility: "text-text-faint",
    token: "--text-faint",
    use: "Metadatos, iconos guía, chevrons.",
  },
  {
    utility: "text-negative",
    token: "--negative",
    use: "Gastos: coral suave, nunca rojo de alarma.",
  },
  {
    utility: "text-positive",
    token: "--positive",
    use: "Ingresos y confirmaciones.",
  },
  {
    utility: "text-pending",
    token: "--pending",
    use: "Movimientos planificados o pendientes.",
  },
  {
    utility: "text-extra",
    token: "--extra",
    use: "Resaltado lima (chips destacados).",
  },
  {
    utility: "text-link",
    token: "--link",
    use: "Enlaces y acciones de texto («+ Añadir»).",
  },
  {
    utility: "ring-ring",
    token: "--ring",
    use: "Anillo de foco y acento (segmentado acento).",
  },
  {
    utility: "bg-primary",
    token: "--primary",
    use: "Botón principal: píldora blanca con texto negro.",
  },
]

const TINTS = [
  {
    utility: "bg-negative-tint",
    token: "--negative-tint",
    text: "text-negative",
    name: "negative",
  },
  {
    utility: "bg-positive-tint",
    token: "--positive-tint",
    text: "text-positive",
    name: "positive",
  },
  {
    utility: "bg-pending-tint",
    token: "--pending-tint",
    text: "text-pending",
    name: "pending",
  },
  {
    utility: "bg-extra-tint",
    token: "--extra-tint",
    text: "text-extra",
    name: "extra",
  },
  {
    utility: "bg-neutral-tint",
    token: "--neutral-tint",
    text: "text-neutral",
    name: "neutral",
  },
  {
    utility: "bg-accent-tint",
    token: "--accent-tint",
    text: "text-link",
    name: "accent",
  },
]

const CONTRAST_TEXTS = [
  { name: "primary", token: "--kw-text-primary" },
  { name: "secondary", token: "--kw-text-secondary" },
  { name: "muted", token: "--kw-text-muted" },
  { name: "faint", token: "--kw-text-faint" },
  { name: "link", token: "--kw-brand-link" },
  { name: "negative", token: "--kw-state-negative" },
  { name: "positive", token: "--kw-state-positive" },
  { name: "pending", token: "--kw-state-pending" },
]

export function ColorSection() {
  return (
    <DocSection
      id="color"
      eyebrow="Fundamentos"
      title="Color"
      description="Keepwell es solo modo oscuro, como la app de iOS. Las pantallas nunca usan hex sueltos: se usan los roles semánticos (bg-card, text-negative…), que apuntan a la paleta. Haz clic en cualquier token o clase para copiarlo."
    >
      <Block title="Paleta" meta="KWColor.Hex" source="src/app/tokens.css">
        <div className="grid gap-4 md:grid-cols-2">
          {PALETTE.map((group) => (
            <Panel
              key={group.name}
              className={cn(group.tokens.length > 7 && "md:col-span-2")}
            >
              <div className="flex flex-col gap-0.5">
                <span className="type-heading text-foreground">
                  {group.name}
                </span>
                <span className="type-caption text-muted-foreground">
                  {group.description}
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3">
                {group.tokens.map((item) => (
                  <ColorChip key={item.token} {...item} />
                ))}
              </div>
            </Panel>
          ))}
        </div>
      </Block>

      <Block
        title="Roles semánticos"
        meta={`${ROLES.length} roles`}
        description="Lo que se escribe en el código. Cada rol dice para qué sirve un color, no cómo se ve."
      >
        <div className="overflow-x-auto rounded-2xl bg-card">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-divider type-caption-sm text-text-faint">
                <th className="px-4 py-3 font-semibold">Muestra</th>
                <th className="px-4 py-3 font-semibold">Clase de Tailwind</th>
                <th className="px-4 py-3 font-semibold">Variable</th>
                <th className="px-4 py-3 font-semibold">Uso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {ROLES.map((role) => (
                <tr key={role.utility}>
                  <td className="px-4 py-2.5">
                    <span
                      className="block size-8 rounded-lg ring-1 ring-white/10 ring-inset"
                      style={{ backgroundColor: `var(${role.token})` }}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <Copyable text={role.utility} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Copyable text={`var(${role.token})`} />
                  </td>
                  <td className="px-4 py-2.5 type-caption text-muted-foreground">
                    {role.use}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Block
        title="Tintes"
        meta="14 % (18 % el acento)"
        description="Fondos translúcidos detrás de iconos de estado y píldoras. Siempre con el texto de su mismo color."
      >
        <Frame className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-6">
          {TINTS.map((tint) => (
            <div key={tint.name} className="flex flex-col gap-2">
              <span
                className={cn(
                  "flex h-16 items-center justify-center rounded-xl type-label",
                  tint.text
                )}
                style={{ backgroundColor: `var(${tint.token})` }}
              >
                {tint.name}
              </span>
              <Copyable text={tint.utility} />
            </div>
          ))}
        </Frame>
      </Block>

      <Block
        title="Contraste"
        meta="WCAG 2.1"
        description="Relación de contraste de cada color de texto sobre el fondo negro y sobre una tarjeta. AA pide 4,5:1 para texto normal y 3:1 para texto grande."
      >
        <div className="overflow-x-auto rounded-2xl bg-card">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="border-b border-divider type-caption-sm text-text-faint">
                <th className="px-4 py-3 font-semibold">Texto</th>
                <th className="px-4 py-3 font-semibold">Sobre bg-background</th>
                <th className="px-4 py-3 font-semibold">Sobre bg-card</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {CONTRAST_TEXTS.map((item) => (
                <ContrastRow key={item.name} {...item} />
              ))}
            </tbody>
          </table>
        </div>
      </Block>

      <Block
        title="Arte de tarjetas"
        meta="KWColor.CardArt · 9 paletas"
        description="Los degradados de 135° de las tarjetas de pago. Cada uno tiene dos paradas: --card-art-<nombre>-from y -to."
      >
        <Frame className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-5">
          {[
            "azul",
            "grafito",
            "platino",
            "verde",
            "violeta",
            "coral",
            "rojo",
            "oro",
            "lima",
          ].map((art) => (
            <CardArtChip key={art} art={art} />
          ))}
        </Frame>
      </Block>
    </DocSection>
  )
}

function ColorChip({ token, name }: { token: string; name: string }) {
  const value = useToken(token)
  return (
    <button
      type="button"
      className="group flex flex-col gap-2 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => copyHex(value)}
    >
      <span
        className="h-16 rounded-xl ring-1 ring-white/10 transition-transform ring-inset group-hover:scale-[1.03]"
        style={{ backgroundColor: `var(${token})` }}
      />
      <span className="flex flex-col px-0.5">
        <span className="type-label text-foreground">{name}</span>
        <span className="font-mono type-caption-sm text-text-secondary uppercase">
          {value || "…"}
        </span>
        <span className="truncate font-mono type-micro text-text-faint">
          {token}
        </span>
      </span>
    </button>
  )
}

function copyHex(value: string) {
  if (value) copyText(value.toUpperCase())
}

function ContrastRow({ name, token }: { name: string; token: string }) {
  const color = useToken(token)
  const bg = useToken("--kw-surface-bg")
  const card = useToken("--kw-surface-surface")
  return (
    <tr>
      <td className="px-4 py-2.5">
        <span className="type-label" style={{ color: `var(${token})` }}>
          {name}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <ContrastBadge ratio={contrastRatio(color, bg)} />
      </td>
      <td className="px-4 py-2.5">
        <ContrastBadge ratio={contrastRatio(color, card)} />
      </td>
    </tr>
  )
}

function CardArtChip({ art }: { art: string }) {
  const from = useToken(`--card-art-${art}-from`)
  const to = useToken(`--card-art-${art}-to`)
  return (
    <div className="flex flex-col gap-2">
      <span
        className="aspect-[1.586] rounded-xl shadow-depth"
        style={{
          backgroundImage: `linear-gradient(135deg, var(--card-art-${art}-from), var(--card-art-${art}-to))`,
        }}
      />
      <span className="flex flex-col px-0.5">
        <span className="type-label text-foreground capitalize">{art}</span>
        <span className="font-mono type-caption-sm text-text-secondary uppercase">
          {from} → {to}
        </span>
      </span>
    </div>
  )
}

// MARK: - Tipografía

const TYPE_STYLES = [
  {
    name: "display",
    sample: "C$12,480",
    ios: "display",
    use: "El saldo protagonista de Inicio.",
  },
  {
    name: "amount-lg",
    sample: "C$3,215.40",
    ios: "amountLg",
    use: "El saldo de una cuenta o el total de un resumen.",
  },
  {
    name: "title",
    sample: "Resumen",
    ios: "title",
    use: "El título grande de cada pantalla (KWLargeTitleHeader).",
  },
  {
    name: "title-sm",
    sample: "Cuentas",
    ios: "titleSm",
    use: "Títulos de tarjetas grandes y paneles.",
  },
  {
    name: "amount-sm",
    sample: "−C$84.00",
    ios: "amountSm",
    use: "Totales de filas, título del estado vacío.",
  },
  {
    name: "heading",
    sample: "Movimientos recientes",
    ios: "heading",
    use: "Encabezados de sección y de diálogos.",
  },
  {
    name: "body",
    sample: "Tus finanzas viven en tu dispositivo.",
    ios: "body",
    use: "Texto corrido, etiquetas de filas.",
  },
  {
    name: "label",
    sample: "Añadir cuenta",
    ios: "label",
    use: "Botones, chips, etiquetas de campos.",
  },
  {
    name: "caption",
    sample: "Ayer · Supermercado",
    ios: "caption",
    use: "Subtítulos bajo una fila.",
  },
  {
    name: "caption-sm",
    sample: "Actualizado hace 2 min",
    ios: "captionSm",
    use: "Notas pequeñas, títulos de botones de acción.",
  },
  {
    name: "micro",
    sample: "ÚLTIMOS CUATRO",
    ios: "micro",
    use: "Atajos de teclado, metadatos en mayúsculas.",
  },
] as const

const WEIGHTS = [
  { weight: 400, name: "Regular", use: "body" },
  { weight: 500, name: "Medium", use: "caption, caption-sm" },
  { weight: 600, name: "SemiBold", use: "label, micro" },
  { weight: 700, name: "Bold", use: "heading" },
  { weight: 800, name: "ExtraBold", use: "títulos e importes, logotipo" },
]

export function TypographySection() {
  const [text, setText] = useState("")
  return (
    <DocSection
      id="tipografia"
      eyebrow="Fundamentos"
      title="Tipografía"
      description="Toda la interfaz usa una sola familia: Inter. Es la misma que la app de iOS incluye en su paquete, así que web e iPhone se leen igual."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel className="gap-6 p-8">
          <div className="flex flex-wrap items-center gap-3">
            <Tag>Familia tipográfica</Tag>
            <Tag tone="neutral">Sans serif · variable</Tag>
          </div>
          <div className="flex flex-col gap-1">
            <span
              className="leading-none font-extrabold tracking-tighter text-foreground"
              style={{ fontSize: "clamp(4rem, 10vw, 7.5rem)" }}
            >
              Inter
            </span>
            <span className="type-body text-muted-foreground">
              Diseñada por Rasmus Andersson para pantallas. Licencia SIL Open
              Font License.
            </span>
          </div>
          <p className="type-amount-sm leading-snug break-words text-foreground">
            ABCDEFGHIJKLMNÑOPQRSTUVWXYZ
            <br />
            abcdefghijklmnñopqrstuvwxyz
            <br />
            <span className="tabular-nums">0123456789</span> ¿?¡!€$C$%&amp;@
          </p>
        </Panel>
        <div className="flex flex-col gap-4">
          <SpecList
            rows={[
              ["Familia", "Inter"],
              ["Variable CSS", "--font-sans"],
              ["Clase", "font-sans (por defecto en <html>)"],
              [
                "Carga en web",
                "next/font/google · autoalojada, funciona sin conexión",
              ],
              ["Carga en iOS", "KWFonts · incluida en el paquete DesignSystem"],
              ["Cifras", "tabular-nums en importes (alineadas en columnas)"],
              ["Monoespaciada", "Geist Mono · --font-mono (solo código)"],
            ]}
          />
          <Panel className="gap-2">
            <span className="type-label text-foreground">
              Pesos que se usan
            </span>
            {WEIGHTS.map((weight) => (
              <div
                key={weight.weight}
                className="flex items-baseline justify-between gap-3"
              >
                <span
                  className="type-heading text-foreground"
                  style={{ fontWeight: weight.weight }}
                >
                  Aa {weight.name}
                </span>
                <span className="text-right type-caption-sm text-text-faint">
                  {weight.weight} · {weight.use}
                </span>
              </div>
            ))}
          </Panel>
        </div>
      </div>

      <Block
        title="Escala tipográfica"
        meta={`${TYPE_STYLES.length} estilos · KWTextStyle`}
        description="Solo se usan estas clases type-*; nunca los tamaños de texto de Tailwind. Cada estilo fija tamaño, peso e interletrado. Escribe abajo para probar tu propio texto."
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Escribe un texto de prueba…"
          className="h-10 w-full max-w-md rounded-xl bg-secondary px-3 type-body text-foreground outline-none placeholder:text-text-faint focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card">
          {TYPE_STYLES.map((style) => (
            <TypeRow
              key={style.name}
              {...style}
              sample={text || style.sample}
            />
          ))}
        </div>
      </Block>
    </DocSection>
  )
}

function TypeRow({
  name,
  sample,
  ios,
  use,
}: {
  name: string
  sample: string
  ios: string
  use: string
}) {
  const size = useToken(`--type-${name}-size`)
  const weight = useToken(`--type-${name}-weight`)
  const tracking = useToken(`--type-${name}-tracking`)
  const px = size.endsWith("rem") ? Math.round(parseFloat(size) * 16) : null
  return (
    <div className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
      <span className={cn("min-w-0 truncate text-foreground", `type-${name}`)}>
        {sample}
      </span>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Copyable text={`type-${name}`} />
          <Caption>iOS .{ios}</Caption>
        </div>
        <span className="font-mono type-caption-sm text-text-secondary">
          {px ?? "…"} px · peso {weight || "…"} · interletrado {tracking || "0"}
        </span>
        <span className="type-caption-sm text-text-faint">{use}</span>
      </div>
    </div>
  )
}

// MARK: - Espaciado y maquetación

const SPACING = [
  { px: 4, tw: "1" },
  { px: 8, tw: "2" },
  { px: 12, tw: "3" },
  { px: 16, tw: "4" },
  { px: 20, tw: "5" },
  { px: 24, tw: "6" },
  { px: 32, tw: "8" },
  { px: 48, tw: "12" },
  { px: 64, tw: "16" },
]

const BREAKPOINTS = [
  {
    name: "base",
    min: "0",
    use: "Teléfono: barra de pestañas abajo, todo a una columna, márgenes de 16 px.",
  },
  {
    name: "sm",
    min: "640px",
    use: "Rejillas de 2 columnas en tarjetas pequeñas.",
  },
  {
    name: "md",
    min: "768px",
    use: "Aparece la barra lateral; márgenes de 32 px.",
  },
  {
    name: "lg",
    min: "1024px",
    use: "Dos columnas: lista + panel lateral (como Revolut web).",
  },
  { name: "xl", min: "1280px", use: "Rejillas más densas (3–4 columnas)." },
]

export function LayoutSection() {
  return (
    <DocSection
      id="espaciado"
      eyebrow="Fundamentos"
      title="Espaciado y maquetación"
      description="La escala de espaciado es la de Tailwind (múltiplos de 4 px), la misma que KWSpacing en iOS. Los controles solo tienen tres alturas para que nada en una fila se vea más pequeño que su vecino."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Block title="Escala de espaciado" meta="base 4 px">
          <div className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card">
            {SPACING.map((space) => (
              <div
                key={space.px}
                className="flex items-center gap-4 px-4 py-2.5"
              >
                <span className="w-14 font-mono type-caption text-foreground tabular-nums">
                  {space.px} px
                </span>
                <span
                  className="h-4 rounded-sm bg-ring/70"
                  style={{ width: space.px * 2 }}
                />
                <span className="ml-auto">
                  <Copyable text={`gap-${space.tw}`} />
                </span>
              </div>
            ))}
          </div>
        </Block>

        <Block title="Alturas de control" meta="solo 32 · 40 · 48 px">
          <Frame className="flex flex-col gap-5 p-5">
            {[
              {
                h: 48,
                cls: "h-12",
                use: "Una sola llamada a la acción a todo el ancho (bienvenida, estado vacío).",
              },
              {
                h: 40,
                cls: "h-10",
                use: "Todo control normal: botones, campos, selects, segmentado grande, botón circular.",
              },
              {
                h: 32,
                cls: "h-8",
                use: "Acciones compactas dentro de filas, chips, segmentado compacto.",
              },
            ].map((row) => (
              <div key={row.h} className="flex items-center gap-4">
                <span
                  className="flex w-24 shrink-0 items-center justify-center rounded-full bg-white type-label text-black"
                  style={{ height: row.h }}
                >
                  {row.h} px
                </span>
                <span className="flex flex-col gap-1">
                  <Copyable text={row.cls} className="self-start" />
                  <span className="type-caption text-muted-foreground">
                    {row.use}
                  </span>
                </span>
              </div>
            ))}
          </Frame>
          <SpecList
            rows={[
              ["Margen lateral (gutter)", "16 px en teléfono · 32 px desde md"],
              ["Ancho máximo de página", "1400 px (componente Page)"],
              ["Separación entre secciones", "24 px (gap-6)"],
              ["Área táctil mínima", "44 px (--layout-min-touch)"],
              ["Fila de lista", "mín. 48 px (KWValueRow), 64 px con icono"],
            ]}
          />
        </Block>
      </div>

      <Block
        title="Puntos de corte"
        meta="breakpoints de Tailwind"
        description="Diseña primero para teléfono y añade columnas al crecer."
      >
        <div className="overflow-x-auto rounded-2xl bg-card">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="border-b border-divider type-caption-sm text-text-faint">
                <th className="px-4 py-3 font-semibold">Prefijo</th>
                <th className="px-4 py-3 font-semibold">Desde</th>
                <th className="px-4 py-3 font-semibold">Qué cambia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {BREAKPOINTS.map((bp) => (
                <tr key={bp.name}>
                  <td className="px-4 py-2.5 font-mono type-caption text-foreground">
                    {bp.name}
                  </td>
                  <td className="px-4 py-2.5 font-mono type-caption text-text-secondary">
                    {bp.min}
                  </td>
                  <td className="px-4 py-2.5 type-caption text-muted-foreground">
                    {bp.use}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>
    </DocSection>
  )
}

// MARK: - Radios y elevación

const RADII = [
  {
    name: "mini",
    token: "--radius-mini",
    cls: "rounded-mini",
    use: "Miniaturas de tarjeta (KWMiniCard).",
  },
  {
    name: "input",
    token: "--radius-input",
    cls: "rounded-xl",
    use: "Campos de texto y selects.",
  },
  {
    name: "card",
    token: "--radius-card",
    cls: "rounded-[var(--radius-card)]",
    use: "Arte de tarjetas de pago.",
  },
  {
    name: "surface",
    token: "--radius-surface",
    cls: "rounded-2xl",
    use: "Tarjetas agrupadas, diálogos, paneles.",
  },
  {
    name: "full",
    token: "--radius-full",
    cls: "rounded-full",
    use: "Botones, chips, segmentados (píldoras).",
  },
]

const SHADOWS = [
  {
    name: "glow",
    token: "--shadow-glow",
    use: "Resplandor azul bajo la tarjeta de marca.",
  },
  {
    name: "depth",
    token: "--shadow-depth",
    use: "Profundidad bajo tarjetas oscuras.",
  },
  {
    name: "elevated",
    token: "--shadow-elevated",
    use: "Diálogos y hojas: borde de luz de 1 px y dos capas de sombra.",
  },
  {
    name: "popover",
    token: "--shadow-popover",
    use: "Menús, popovers y selects desplegados.",
  },
]

export function ShapeSection() {
  return (
    <DocSection
      id="formas"
      eyebrow="Fundamentos"
      title="Radios y elevación"
      description="Botones y chips son píldoras; las tarjetas tienen esquinas de 20 px; los campos, de 12 px. Sobre negro la elevación se nota por un borde de luz, no solo por la sombra."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Block title="Radios" meta="KWRadius">
          <div className="flex flex-col divide-y divide-divider overflow-hidden rounded-2xl bg-card">
            {RADII.map((radius) => (
              <RadiusRow key={radius.name} {...radius} />
            ))}
          </div>
        </Block>
        <Block title="Elevación" meta="KWShadow">
          <Frame className="grid grid-cols-2 gap-6 p-6">
            {SHADOWS.map((shadow) => (
              <div
                key={shadow.name}
                className="flex flex-col items-center gap-3 text-center"
              >
                <span
                  className="h-20 w-full max-w-32 rounded-2xl bg-card"
                  style={{ boxShadow: `var(${shadow.token})` }}
                />
                <Copyable text={`shadow-${shadow.name}`} />
                <span className="type-caption-sm text-text-faint">
                  {shadow.use}
                </span>
              </div>
            ))}
          </Frame>
        </Block>
      </div>
    </DocSection>
  )
}

function RadiusRow({
  name,
  token,
  cls,
  use,
}: {
  name: string
  token: string
  cls: string
  use: string
}) {
  const value = useToken(token)
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <span
        className="size-12 shrink-0 border-2 border-ring bg-accent-tint"
        style={{ borderRadius: `var(${token})` }}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="type-label text-foreground">{name}</span>
          <span className="font-mono type-caption-sm text-text-secondary">
            {value === "9999px" ? "píldora" : value}
          </span>
        </span>
        <span className="type-caption-sm text-text-faint">{use}</span>
      </span>
      <Copyable text={cls} />
    </div>
  )
}

// MARK: - Movimiento

const EASINGS = [
  {
    name: "out-ios",
    token: "--ease-out-ios",
    use: "Entrada de elementos y modales: rápida al salir, aterrizaje largo y suave.",
  },
  {
    name: "spring",
    token: "--ease-spring",
    use: "El resorte estándar de la app (rigidez 450, amortiguación 32).",
  },
  { name: "exit", token: "--ease-exit", use: "Salidas: acelera hacia fuera." },
]

const DURATIONS = [
  {
    name: "press",
    token: "--duration-press",
    use: "Respuesta al pulsar (opacidad 0,75 y escala 0,98).",
  },
  {
    name: "fast",
    token: "--duration-fast",
    use: "Cambios de color, salidas de menús.",
  },
  {
    name: "base",
    token: "--duration-base",
    use: "Menús, fundidos, salidas de diálogos.",
  },
  {
    name: "slow",
    token: "--duration-slow",
    use: "Entradas de diálogos, hojas y filas.",
  },
]

export function MotionSection() {
  const [played, setPlayed] = useState(false)
  return (
    <DocSection
      id="movimiento"
      eyebrow="Fundamentos"
      title="Movimiento"
      description="Las curvas de SwiftUI llevadas a CSS. Las acciones frecuentes nunca pasan de 300 ms. Pulsa «Reproducir» para comparar las curvas."
    >
      <Block title="Curvas" meta="--ease-*">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setPlayed((value) => !value)}
            className="inline-flex h-10 press items-center gap-2 self-start rounded-full bg-white px-5 type-label text-black outline-none hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {played ? "Volver" : "Reproducir"}
          </button>
          <div className="grid gap-4 lg:grid-cols-3">
            {EASINGS.map((easing) => (
              <EasingCard key={easing.name} {...easing} played={played} />
            ))}
          </div>
        </div>
      </Block>
      <Block title="Duraciones" meta="--duration-*">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DURATIONS.map((duration) => (
            <DurationCard key={duration.name} {...duration} />
          ))}
        </div>
      </Block>
      <Code
        code={`/* Pulsación de botón, como configuration.isPressed en iOS */
<button className="press …" />

/* Transición con las curvas del sistema */
transition: opacity var(--duration-base) var(--ease-out-ios);

/* JS (motion/react): el mismo resorte */
import { spring } from "@/lib/motion"`}
      />
    </DocSection>
  )
}

/** Puntos (x, y) de una curva cubic-bezier() o linear() para dibujarla. */
function curvePoints(value: string): [number, number][] {
  const bezier = /cubic-bezier\(([^)]+)\)/.exec(value)
  if (bezier) {
    const [x1, y1, x2, y2] = bezier[1]!.split(",").map(Number) as [
      number,
      number,
      number,
      number,
    ]
    return Array.from({ length: 41 }, (_, i) => {
      const t = i / 40
      const u = 1 - t
      return [
        3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3,
        3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3,
      ]
    })
  }
  const linear = /linear\((.+)\)/.exec(value)
  if (linear) {
    const stops = linear[1]!.split(",").map((stop) => stop.trim().split(/\s+/))
    return stops.map(([y, x], index) => [
      x ? parseFloat(x) / 100 : index / (stops.length - 1),
      Number(y),
    ])
  }
  return [
    [0, 0],
    [1, 1],
  ]
}

function EasingCard({
  name,
  token,
  use,
  played,
}: {
  name: string
  token: string
  use: string
  played: boolean
}) {
  const value = useToken(token)
  const points = curvePoints(value)
  const path = points
    .map(
      ([x, y], i) =>
        `${i ? "L" : "M"}${(x * 100).toFixed(1)} ${(100 - y * 80 - 10).toFixed(1)}`
    )
    .join(" ")
  return (
    <Panel>
      <div className="flex items-center justify-between gap-2">
        <Copyable text={`ease-${name}`} />
        <Caption>var({token})</Caption>
      </div>
      <svg
        viewBox="-4 -4 108 108"
        className="h-36 w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        <line
          x1="0"
          y1="90"
          x2="100"
          y2="90"
          stroke="var(--divider)"
          strokeWidth="0.6"
        />
        <line
          x1="0"
          y1="10"
          x2="100"
          y2="10"
          stroke="var(--divider)"
          strokeWidth="0.6"
          strokeDasharray="2 2"
        />
        <path
          d={path}
          fill="none"
          stroke="var(--ring)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="relative h-8 rounded-full bg-secondary">
        <span
          className="absolute top-1 size-6 rounded-full bg-white"
          style={{
            left: played ? "calc(100% - 1.75rem)" : "0.25rem",
            transition: `left 700ms var(${token})`,
          }}
        />
      </div>
      <span className="type-caption text-muted-foreground">{use}</span>
    </Panel>
  )
}

function DurationCard({ token, use }: { token: string; use: string }) {
  const value = useToken(token)
  return (
    <Panel className="gap-2">
      <span className="type-amount-sm text-foreground">
        {value
          ? `${Math.round(parseFloat(value) * (value.endsWith("ms") ? 1 : 1000))} ms`
          : "…"}
      </span>
      <Copyable text={`duration-(${token})`} className="self-start" />
      <span className="type-caption text-muted-foreground">{use}</span>
    </Panel>
  )
}
