"use client"

import type { CSSProperties } from "react"

import { KWAppIconTile, KWLogoMark } from "@/components/kw/kw-icon"
import { cn } from "@/lib/utils"

import { Block, Caption, DocSection, Panel } from "./ds-parts"

// La marca: el símbolo (cabeza y arco que la sostiene), el icono de la app sobre el degradado azul
// y el logotipo "keepwell". Geometría de keepwell-ios Components/KWLogo.swift.

const ASSETS = [
  { file: "/icon.svg", format: "SVG · 1024 × 1024" },
  { file: "/icon-512.png", format: "PNG · 512 × 512" },
  { file: "/icon-192.png", format: "PNG · 192 × 192" },
  { file: "/icon-180.png", format: "PNG · 180 × 180" },
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
    <DocSection id="marca" title="Logo">
      <div className="grid gap-4 lg:grid-cols-3">
        <Showcase label="Icono de la app">
          <KWAppIconTile size={112} className="shadow-glow" />
        </Showcase>
        <Showcase label="Símbolo">
          <KWLogoMark size={96} className="text-foreground" />
        </Showcase>
        <Showcase label="Logotipo">
          <Wordmark size={44} />
        </Showcase>
      </div>

      <Block title="Sobre distintos fondos">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Backdrop
            label="Negro"
            className="bg-background text-white ring-1 ring-border ring-inset"
          />
          <Backdrop label="Tarjeta" className="bg-card text-white" />
          <Backdrop
            label="Azul de marca"
            className="text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--brand-500), var(--brand-700))",
            }}
          />
          <Backdrop
            label="Claro"
            className="text-black"
            style={{ backgroundColor: "var(--kw-surface-light)" }}
          />
        </div>
      </Block>

      <Block title="Construcción">
        <div className="flex flex-wrap items-center gap-6 rounded-2xl bg-card p-6">
          <Construction />
          <div className="flex flex-wrap items-end gap-6">
            {[96, 64, 40, 24, 16].map((size) => (
              <div key={size} className="flex flex-col items-center gap-2">
                <KWAppIconTile size={size} />
                <Caption>{size} px</Caption>
              </div>
            ))}
          </div>
        </div>
      </Block>

      <Block title="Archivos">
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
                width={40}
                height={40}
                className="size-10 rounded-lg"
              />
              <span className="min-w-0 flex-1 truncate type-label text-foreground">
                {asset.format}
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

function Showcase({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Panel className="items-center justify-center gap-6 py-10 text-center">
      <span className="flex h-28 items-center">{children}</span>
      <span className="type-label text-foreground">{label}</span>
    </Panel>
  )
}

function Construction() {
  const lines = Array.from({ length: 9 }, (_, index) => index * 9)
  return (
    <svg
      viewBox="-4 -4 80 80"
      className="size-56 shrink-0"
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
  style?: CSSProperties
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
