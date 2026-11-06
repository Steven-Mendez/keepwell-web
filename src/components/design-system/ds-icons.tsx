"use client"

import { useState } from "react"

import { KWIcon } from "@/components/kw/kw-icon"
import { KW_ICONS, type KWIconName } from "@/components/kw/kw-icon-data"
import { cn } from "@/lib/utils"

import { SpecList } from "./ds-brand"
import { Block, Caption, Code, copyText, DocSection, Frame } from "./ds-parts"

const NAMES = Object.keys(KW_ICONS) as KWIconName[]
const SIZES = [16, 18, 20, 24, 28]

export function IconsSection() {
  const [query, setQuery] = useState("")
  const [size, setSize] = useState(24)
  const visible = NAMES.filter((name) =>
    name.toLowerCase().includes(query.trim().toLowerCase())
  )
  return (
    <DocSection
      id="iconos"
      eyebrow="Fundamentos"
      title="Iconografía"
      description={`${NAMES.length} iconos de trazo propios, dibujados en una retícula de 24 × 24 con trazo de 2 unidades, idénticos a los de iOS. Lucide solo se usa para los símbolos de categoría o cuando no hay un icono equivalente. Haz clic en un icono para copiar su código.`}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SpecList
          rows={[
            ["Componente", '<KWIcon name="…" size={20} />'],
            ["Retícula", "24 × 24"],
            ["Trazo", "2 (2,2 en botones principales)"],
            ["Color", "currentColor: hereda el color del texto"],
            [
              "Tamaños habituales",
              "16 filas compactas · 18 botones · 20 filas · 24 navegación",
            ],
            ["Origen", "keepwell-ios Icons/KWIcon.swift"],
          ]}
        />
        <Code
          code={`import { KWIcon } from "@/components/kw/kw-icon"

<KWIcon name="plus" size={18} strokeWidth={2.2} />
<span className="text-negative">
  <KWIcon name="arrowUpRight" />
</span>`}
        />
      </div>

      <Block title="Catálogo" meta={`${visible.length} de ${NAMES.length}`}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative w-full max-w-xs">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-faint">
              <KWIcon name="search" size={16} />
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar icono…"
              aria-label="Buscar icono"
              className="h-10 w-full rounded-xl bg-secondary pr-3 pl-9 type-body text-foreground outline-none placeholder:text-text-faint focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <div
            role="radiogroup"
            aria-label="Tamaño"
            className="inline-flex rounded-full bg-card p-1"
          >
            {SIZES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={size === value}
                onClick={() => setSize(value)}
                className={cn(
                  "h-8 rounded-full px-3 type-caption font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  size === value
                    ? "bg-white text-black"
                    : "text-text-secondary hover:text-foreground"
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <Frame className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-1 p-3">
          {visible.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => copyText(`<KWIcon name="${name}" />`)}
              title={`Copiar <KWIcon name="${name}" />`}
              className="flex flex-col items-center gap-2 rounded-xl px-1 py-4 text-foreground transition-colors outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-8 items-center">
                <KWIcon name={name} size={size} />
              </span>
              <span className="w-full truncate text-center font-mono type-micro text-text-faint">
                {name}
              </span>
            </button>
          ))}
          {visible.length === 0 ? (
            <Caption className="col-span-full p-6 text-center">
              No hay iconos con ese nombre.
            </Caption>
          ) : null}
        </Frame>
      </Block>
    </DocSection>
  )
}
