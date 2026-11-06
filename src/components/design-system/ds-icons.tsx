"use client"

import { useState } from "react"

import { KWIcon } from "@/components/kw/kw-icon"
import { KW_ICONS, type KWIconName } from "@/components/kw/kw-icon-data"

import { Caption, DocSection, Frame } from "./ds-parts"

const NAMES = Object.keys(KW_ICONS) as KWIconName[]

export function IconsSection() {
  const [query, setQuery] = useState("")
  const visible = NAMES.filter((name) =>
    name.toLowerCase().includes(query.trim().toLowerCase())
  )
  return (
    <DocSection
      id="iconos"
      title="Iconos"
      description={`${NAMES.length} iconos propios de línea: retícula de 24 × 24, trazo de 2 px y extremos redondeados. Toman el color del texto que los rodea.`}
    >
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
      <Frame className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-1 p-3">
        {visible.map((name) => (
          <div
            key={name}
            className="flex flex-col items-center gap-2 rounded-xl px-1 py-4 text-foreground"
          >
            <KWIcon name={name} size={24} />
            <span className="w-full truncate text-center type-micro text-text-faint">
              {name}
            </span>
          </div>
        ))}
        {visible.length === 0 ? (
          <Caption className="col-span-full p-6 text-center">
            No hay iconos con ese nombre.
          </Caption>
        ) : null}
      </Frame>
    </DocSection>
  )
}
