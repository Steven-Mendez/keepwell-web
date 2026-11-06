"use client"

import { KWAppIconTile, KWLogoMark } from "@/components/kw/kw-icon"
import { cn } from "@/lib/utils"

import {
  Block,
  Caption,
  Code,
  Copyable,
  DocSection,
  DoDont,
  Frame,
  Panel,
} from "./ds-parts"

// La marca: el símbolo (cabeza y arco que sostiene), el icono de la app sobre el degradado de
// marca y el logotipo "keepwell". Geometría de keepwell-ios Components/KWLogo.swift.

const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" fill="none">
  <circle cx="36" cy="21" r="9" fill="currentColor"/>
  <path d="M15 34v7a21 21 0 0 0 42 0v-7" stroke="currentColor" stroke-width="7.5" stroke-linecap="round"/>
</svg>`

const ASSETS = [
  {
    file: "/icon.svg",
    label: "Icono de la app",
    format: "SVG · 1024×1024",
    note: "Vectorial, para cualquier tamaño",
  },
  {
    file: "/icon-512.png",
    label: "Icono de la app",
    format: "PNG · 512×512",
    note: "PWA, tiendas, presentaciones",
  },
  {
    file: "/icon-192.png",
    label: "Icono de la app",
    format: "PNG · 192×192",
    note: "Manifest de la PWA",
  },
  {
    file: "/icon-180.png",
    label: "Apple touch icon",
    format: "PNG · 180×180",
    note: "Pantalla de inicio en iOS",
  },
]

/** El logotipo: símbolo + "keepwell" en minúsculas, Inter ExtraBold con interletrado negativo. */
export function Wordmark({
  size = 32,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <span
      className={cn("inline-flex items-center text-foreground", className)}
      style={{ gap: size * 0.2 }}
      aria-label="keepwell"
    >
      <KWLogoMark size={size} />
      <span
        className="leading-none font-extrabold"
        style={{ fontSize: size * 0.92, letterSpacing: "-0.045em" }}
        aria-hidden
      >
        keepwell
      </span>
    </span>
  )
}

export function BrandSection() {
  return (
    <DocSection
      id="marca"
      eyebrow="Marca"
      title="Logo e identidad"
      description="El símbolo de Keepwell es una figura: una cabeza y un arco que la sostiene, la idea de cuidar tu dinero. Vive en tres formas: el símbolo solo, el icono de la app sobre el degradado azul y el logotipo con la palabra keepwell."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="items-center justify-center gap-6 py-10">
          <KWAppIconTile size={112} className="shadow-glow" />
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="type-label text-foreground">Icono de la app</span>
            <Copyable text={"<KWAppIconTile size={32} />"} />
          </div>
        </Panel>
        <Panel className="items-center justify-center gap-6 py-10">
          <span className="flex size-28 items-center justify-center text-foreground">
            <KWLogoMark size={96} />
          </span>
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="type-label text-foreground">Símbolo</span>
            <Copyable text={"<KWLogoMark size={24} />"} />
          </div>
        </Panel>
        <Panel className="items-center justify-center gap-6 py-10">
          <span className="flex h-28 items-center">
            <Wordmark size={44} />
          </span>
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="type-label text-foreground">Logotipo</span>
            <Caption>
              Símbolo + «keepwell» · Inter ExtraBold (800) · minúsculas
            </Caption>
          </div>
        </Panel>
      </div>

      <Block
        title="Construcción"
        meta="retícula de 72 × 72"
        description="El símbolo se dibuja en una retícula de 72 unidades: un círculo de radio 9 centrado en (36, 21) y un arco con trazo de 7,5 y extremos redondeados. En el icono, el símbolo ocupa 44/72 (61 %) del lado y la esquina mide 17/72 (23,6 %)."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Frame className="flex items-center justify-center p-8">
            <Construction />
          </Frame>
          <div className="flex flex-col gap-3">
            <SpecList
              rows={[
                ["Cabeza", "círculo r = 9 en (36, 21)"],
                ["Arco", "M15 34 v7 a21 21 0 0 0 42 0 v-7"],
                ["Trazo del arco", "7,5 unidades · extremos redondeados"],
                ["Símbolo en el icono", "44 / 72 del lado (61 %)"],
                ["Radio del icono", "17 / 72 del lado (23,6 %)"],
                [
                  "Degradado del icono",
                  "135° · brand-500 #4A74FF → brand-700 #1A33A8",
                ],
                [
                  "Brillo superior",
                  "blanco 30 % → transparente, en la mitad superior",
                ],
              ]}
            />
            <Code code={MARK_SVG} />
          </div>
        </div>
      </Block>

      <Block
        title="Sobre distintos fondos"
        description="El símbolo se usa en blanco sobre fondos oscuros o sobre el azul de marca, y en negro sobre superficies claras. Nunca en otros colores."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Backdrop
            label="Negro · bg-background"
            className="bg-background text-white ring-1 ring-border ring-inset"
          />
          <Backdrop
            label="Superficie · bg-card"
            className="bg-card text-white"
          />
          <Backdrop
            label="Marca · brand-500 → 700"
            className="text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--brand-500), var(--brand-700))",
            }}
          />
          <Backdrop
            label="Claro · surface-light"
            className="text-black"
            style={{ backgroundColor: "var(--kw-surface-light)" }}
          />
        </div>
      </Block>

      <Block
        title="Tamaños del icono"
        description="El radio de la esquina escala con el tamaño (17/72). 32 px en la barra lateral y la bienvenida; 72 pt en iOS."
      >
        <Frame className="flex flex-wrap items-end gap-8 p-6">
          {[112, 72, 48, 32, 24, 16].map((size) => (
            <div key={size} className="flex flex-col items-center gap-2">
              <KWAppIconTile size={size} />
              <Caption>{size}px</Caption>
            </div>
          ))}
        </Frame>
      </Block>

      <Block
        title="Uso correcto"
        description="Reglas básicas para que la marca se lea siempre igual."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DoDont
            good
            note="Usa el icono tal cual: degradado azul, símbolo blanco, esquina proporcional."
          >
            <KWAppIconTile size={56} />
          </DoDont>
          <DoDont
            good={false}
            note="No cambies el color del degradado ni del símbolo."
          >
            <span
              className="relative inline-flex size-14 items-center justify-center rounded-[13px] text-white"
              style={{
                backgroundImage: "linear-gradient(135deg, #FF7A50, #C93A12)",
              }}
            >
              <KWLogoMark size={34} />
            </span>
          </DoDont>
          <DoDont good={false} note="No lo deformes ni cambies su proporción.">
            <span
              className="inline-flex h-14 w-24 items-center justify-center overflow-hidden rounded-[13px] text-white"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, var(--brand-500), var(--brand-700))",
              }}
            >
              <span style={{ transform: "scaleX(1.7)" }}>
                <KWLogoMark size={34} />
              </span>
            </span>
          </DoDont>
          <DoDont
            good={false}
            note="No escribas KeepWell ni KEEPWELL: el logotipo va siempre en minúsculas."
          >
            <span className="type-amount-sm text-foreground">KeepWell</span>
          </DoDont>
        </div>
      </Block>

      <Block
        title="Archivos"
        description="Los archivos que publica la web, listos para descargar. El icono de iOS vive en keepwell-ios App/Resources/AppIcon.icon."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ASSETS.map((asset) => (
            <a
              key={asset.file}
              href={asset.file}
              download
              className="group flex press items-center gap-3 rounded-2xl bg-card p-4 outline-none hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- los archivos se muestran tal cual se descargan */}
              <img
                src={asset.file}
                alt=""
                width={48}
                height={48}
                className="size-12 rounded-xl"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate type-label text-foreground">
                  {asset.label}
                </span>
                <span className="truncate type-caption-sm text-text-secondary">
                  {asset.format}
                </span>
                <span className="truncate type-caption-sm text-text-faint">
                  {asset.note}
                </span>
              </span>
              <span className="text-text-faint transition-colors group-hover:text-foreground">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
                </svg>
              </span>
            </a>
          ))}
        </div>
      </Block>
    </DocSection>
  )
}

function Construction() {
  const lines = Array.from({ length: 9 }, (_, index) => index * 9)
  return (
    <svg
      viewBox="-6 -6 84 84"
      className="w-full max-w-80"
      aria-label="Construcción del símbolo sobre una retícula de 72 × 72"
    >
      <rect
        x="0"
        y="0"
        width="72"
        height="72"
        rx="17"
        fill="none"
        stroke="var(--border)"
        strokeWidth="0.4"
      />
      {lines.map((v) => (
        <g key={v} stroke="var(--divider)" strokeWidth="0.25">
          <line x1={v} y1="0" x2={v} y2="72" />
          <line x1="0" y1={v} x2="72" y2={v} />
        </g>
      ))}
      <g
        stroke="var(--ring)"
        strokeWidth="0.35"
        strokeDasharray="1.2 1"
        fill="none"
      >
        <circle cx="36" cy="41" r="21" />
        <line x1="36" y1="0" x2="36" y2="72" />
        <line x1="0" y1="21" x2="72" y2="21" />
      </g>
      <circle cx="36" cy="21" r="9" fill="var(--foreground)" />
      <path
        d="M15 34v7a21 21 0 0 0 42 0v-7"
        stroke="var(--foreground)"
        strokeWidth="7.5"
        strokeLinecap="round"
        fill="none"
      />
      <g fill="var(--link)" fontSize="3" fontFamily="var(--font-mono)">
        <text x="47" y="18">
          r 9
        </text>
        <text x="62" y="38">
          7,5
        </text>
        <text x="2" y="70">
          72 × 72
        </text>
      </g>
    </svg>
  )
}

function Backdrop({
  label,
  className,
  style,
}: {
  label: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "flex h-32 items-center justify-center rounded-2xl",
          className
        )}
        style={style}
      >
        <KWLogoMark size={56} />
      </div>
      <Caption>{label}</Caption>
    </div>
  )
}

export function SpecList({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-divider overflow-hidden rounded-xl bg-card">
      {rows.map(([term, value]) => (
        <div
          key={term}
          className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-4"
        >
          <dt className="type-caption text-text-faint sm:w-44 sm:shrink-0">
            {term}
          </dt>
          <dd className="font-mono type-caption text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
