"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { Block, copyText, DocSection, Frame, Panel, useToken } from "./ds-parts"

// Color, tipografía y formas. Los valores se leen de los tokens de la app, así que esta página
// siempre muestra lo que la app usa de verdad.

// MARK: - Color

const PALETTE: {
  name: string
  description: string
  tokens: { token: string; name: string }[]
}[] = [
  {
    name: "Fondos y superficies",
    description:
      "La app es solo modo oscuro. Pantallas en negro, tarjetas un poco más claras y controles encima.",
    tokens: [
      { token: "--kw-surface-bg", name: "Fondo" },
      { token: "--kw-surface-nav", name: "Barra lateral" },
      { token: "--kw-surface-surface", name: "Tarjeta" },
      { token: "--kw-surface-surface2", name: "Control" },
      { token: "--kw-surface-border", name: "Borde" },
      { token: "--kw-surface-control-off", name: "Interruptor apagado" },
    ],
  },
  {
    name: "Texto",
    description: "Blanco para lo importante y grises para lo secundario.",
    tokens: [
      { token: "--kw-text-primary", name: "Principal" },
      { token: "--kw-text-secondary", name: "Secundario" },
      { token: "--kw-text-muted", name: "Atenuado" },
      { token: "--kw-text-faint", name: "Tenue" },
    ],
  },
  {
    name: "Marca",
    description:
      "El azul de Keepwell. Para el logo, los enlaces, el foco y los gráficos.",
    tokens: [
      { token: "--kw-brand-b900", name: "Azul 900" },
      { token: "--kw-brand-b700", name: "Azul 700" },
      { token: "--kw-brand-b600", name: "Azul 600" },
      { token: "--kw-brand-b500", name: "Azul 500" },
      { token: "--kw-brand-accent", name: "Acento" },
      { token: "--kw-brand-link", name: "Enlace" },
    ],
  },
  {
    name: "Dinero",
    description:
      "El color dice qué pasó con el dinero. El gasto es un coral suave, nunca un rojo de alarma.",
    tokens: [
      { token: "--kw-state-negative", name: "Gasto" },
      { token: "--kw-state-positive", name: "Ingreso" },
      { token: "--kw-state-pending", name: "Planificado" },
      { token: "--kw-state-extra", name: "Destacado" },
    ],
  },
  {
    name: "Categorías",
    description:
      "La paleta que cada persona elige para sus categorías. También colorea los gráficos.",
    tokens: [
      ["blue", "Azul"],
      ["purple", "Morado"],
      ["pink", "Rosa"],
      ["orange", "Naranja"],
      ["amber", "Ámbar"],
      ["yellow", "Amarillo"],
      ["lime", "Lima"],
      ["green", "Verde"],
      ["cyan", "Cian"],
      ["gray", "Gris"],
    ].map(([key, name]) => ({ token: `--category-${key}`, name: name! })),
  },
]

const CARD_ARTS = [
  "azul",
  "grafito",
  "platino",
  "verde",
  "violeta",
  "coral",
  "rojo",
  "oro",
  "lima",
]

export function ColorSection() {
  return (
    <DocSection
      id="color"
      title="Color"
      description="Haz clic en un color para copiar su código hex."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {PALETTE.map((group) => (
          <Panel
            key={group.name}
            className={cn(group.tokens.length > 6 && "md:col-span-2")}
          >
            <div className="flex flex-col gap-0.5">
              <span className="type-heading text-foreground">{group.name}</span>
              <span className="type-caption text-muted-foreground">
                {group.description}
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-3">
              {group.tokens.map((item) => (
                <ColorChip key={item.token} {...item} />
              ))}
            </div>
          </Panel>
        ))}
      </div>
      <Block
        title="Tarjetas de pago"
        description="Cada tarjeta lleva un degradado diagonal entre dos colores."
      >
        <Frame className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-5">
          {CARD_ARTS.map((art) => (
            <CardArtChip key={art} art={art} />
          ))}
        </Frame>
      </Block>
    </DocSection>
  )
}

function ColorChip({ token, name }: { token: string; name: string }) {
  const value = useToken(token).toUpperCase()
  return (
    <button
      type="button"
      className="group flex flex-col gap-2 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => value && copyText(value)}
    >
      <span
        className="h-16 rounded-xl ring-1 ring-white/10 transition-transform ring-inset group-hover:scale-[1.03]"
        style={{ backgroundColor: `var(${token})` }}
      />
      <span className="flex flex-col px-0.5">
        <span className="type-label text-foreground">{name}</span>
        <span className="font-mono type-caption-sm text-text-secondary">
          {value || "…"}
        </span>
      </span>
    </button>
  )
}

function CardArtChip({ art }: { art: string }) {
  const from = useToken(`--card-art-${art}-from`).toUpperCase()
  const to = useToken(`--card-art-${art}-to`).toUpperCase()
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
        <span className="font-mono type-caption-sm text-text-secondary">
          {from} → {to}
        </span>
      </span>
    </div>
  )
}

// MARK: - Tipografía

const TYPE_STYLES = [
  { name: "display", label: "Saldo principal", sample: "C$12,480" },
  { name: "amount-lg", label: "Saldo de cuenta", sample: "C$3,215.40" },
  { name: "title", label: "Título de pantalla", sample: "Resumen" },
  { name: "title-sm", label: "Título de tarjeta", sample: "Cuentas" },
  { name: "amount-sm", label: "Importe", sample: "−C$84.00" },
  { name: "heading", label: "Encabezado", sample: "Movimientos recientes" },
  {
    name: "body",
    label: "Texto",
    sample: "Tus finanzas viven en tu dispositivo.",
  },
  { name: "label", label: "Botón y etiqueta", sample: "Añadir cuenta" },
  { name: "caption", label: "Subtítulo", sample: "Ayer · Supermercado" },
  { name: "caption-sm", label: "Nota", sample: "Actualizado hace 2 min" },
  { name: "micro", label: "Micro", sample: "ÚLTIMOS CUATRO" },
] as const

const WEIGHTS = [
  { weight: 400, name: "Regular" },
  { weight: 500, name: "Medium" },
  { weight: 600, name: "SemiBold" },
  { weight: 700, name: "Bold" },
  { weight: 800, name: "ExtraBold" },
]

export function TypographySection() {
  const [text, setText] = useState("")
  return (
    <DocSection
      id="tipografia"
      title="Tipografía"
      description="Una sola familia en toda la app, web e iPhone."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel className="gap-5 p-8">
          <span className="type-caption text-text-faint">
            Familia tipográfica
          </span>
          <span
            className="leading-none font-extrabold tracking-tighter text-foreground"
            style={{ fontSize: "clamp(4rem, 10vw, 7.5rem)" }}
          >
            Inter
          </span>
          <p className="type-amount-sm leading-snug break-words text-foreground">
            ABCDEFGHIJKLMNÑOPQRSTUVWXYZ
            <br />
            abcdefghijklmnñopqrstuvwxyz
            <br />
            <span className="tabular-nums">0123456789</span> ¿?¡!$C$%&amp;@
          </p>
          <a
            href="https://fonts.google.com/specimen/Inter"
            target="_blank"
            rel="noreferrer"
            className="self-start type-label text-link hover:text-link-hover"
          >
            Descargar en Google Fonts (gratis) ↗
          </a>
        </Panel>
        <Panel className="justify-center gap-3">
          <span className="type-caption text-text-faint">
            Pesos que se usan
          </span>
          {WEIGHTS.map((weight) => (
            <div
              key={weight.weight}
              className="flex items-baseline justify-between gap-3"
            >
              <span
                className="type-title-sm text-foreground"
                style={{ fontWeight: weight.weight }}
              >
                {weight.name}
              </span>
              <span className="font-mono type-caption text-text-faint">
                {weight.weight}
              </span>
            </div>
          ))}
        </Panel>
      </div>

      <Block
        title="Tamaños"
        description="Los once estilos de texto de la app. Escribe abajo para probar tu propio texto."
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
  label,
  sample,
}: {
  name: string
  label: string
  sample: string
}) {
  const size = useToken(`--type-${name}-size`)
  const weight = useToken(`--type-${name}-weight`)
  const px = size.endsWith("rem") ? Math.round(parseFloat(size) * 16) : null
  return (
    <div className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center">
      <span className={cn("min-w-0 truncate text-foreground", `type-${name}`)}>
        {sample}
      </span>
      <span className="flex flex-col sm:text-right">
        <span className="type-label text-text-secondary">{label}</span>
        <span className="type-caption-sm text-text-faint">
          {px ?? "…"} px ·{" "}
          {WEIGHTS.find((w) => String(w.weight) === weight)?.name ?? weight}
        </span>
      </span>
    </div>
  )
}

// MARK: - Formas y espaciado

const RADII = [
  { token: "--radius-full", name: "Píldora", use: "Botones y chips" },
  { token: "--radius-surface", name: "20 px", use: "Tarjetas y ventanas" },
  { token: "--radius-card", name: "18 px", use: "Tarjetas de pago" },
  { token: "--radius-input", name: "12 px", use: "Campos de texto" },
]

const SHADOWS = [
  { token: "--shadow-glow", name: "Resplandor", use: "Bajo la tarjeta azul" },
  {
    token: "--shadow-depth",
    name: "Profundidad",
    use: "Bajo tarjetas oscuras",
  },
  { token: "--shadow-elevated", name: "Ventana", use: "Diálogos" },
]

export function ShapeSection() {
  return (
    <DocSection
      id="formas"
      title="Formas y espaciado"
      description="Todo es redondeado. Los espacios siguen múltiplos de 4 px y los controles solo tienen tres alturas."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <span className="type-heading text-foreground">Esquinas</span>
          <div className="grid grid-cols-2 gap-4">
            {RADII.map((radius) => (
              <div key={radius.token} className="flex flex-col gap-2">
                <span
                  className="h-16 border-2 border-ring bg-accent-tint"
                  style={{ borderRadius: `var(${radius.token})` }}
                />
                <span className="flex flex-col">
                  <span className="type-label text-foreground">
                    {radius.name}
                  </span>
                  <span className="type-caption-sm text-text-faint">
                    {radius.use}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <span className="type-heading text-foreground">
            Alturas de botones y campos
          </span>
          {[
            { h: 48, use: "Botón principal grande" },
            { h: 40, use: "Botones y campos normales" },
            { h: 32, use: "Chips y botones pequeños" },
          ].map((row) => (
            <div key={row.h} className="flex items-center gap-4">
              <span
                className="flex w-24 shrink-0 items-center justify-center rounded-full bg-white type-label text-black"
                style={{ height: row.h }}
              >
                {row.h} px
              </span>
              <span className="type-caption text-muted-foreground">
                {row.use}
              </span>
            </div>
          ))}
        </Panel>
        <Panel>
          <span className="type-heading text-foreground">Espaciado</span>
          <div className="flex flex-col gap-2">
            {[4, 8, 12, 16, 24, 32, 48].map((px) => (
              <div key={px} className="flex items-center gap-3">
                <span className="w-12 font-mono type-caption text-text-secondary tabular-nums">
                  {px} px
                </span>
                <span
                  className="h-3 rounded-sm bg-ring/70"
                  style={{ width: px * 2.5 }}
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Block title="Sombras">
        <Frame className="grid grid-cols-1 gap-8 p-8 sm:grid-cols-3">
          {SHADOWS.map((shadow) => (
            <div
              key={shadow.token}
              className="flex flex-col items-center gap-3 text-center"
            >
              <span
                className="h-20 w-full max-w-36 rounded-2xl bg-card"
                style={{ boxShadow: `var(${shadow.token})` }}
              />
              <span className="flex flex-col">
                <span className="type-label text-foreground">
                  {shadow.name}
                </span>
                <span className="type-caption-sm text-text-faint">
                  {shadow.use}
                </span>
              </span>
            </div>
          ))}
        </Frame>
      </Block>
    </DocSection>
  )
}
