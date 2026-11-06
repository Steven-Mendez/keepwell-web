"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

import { BrandSection, Wordmark } from "./ds-brand"
import { ComponentsSection } from "./ds-components"
import { ColorSection, ShapeSection, TypographySection } from "./ds-foundations"
import { IconsSection } from "./ds-icons"

// El sistema de diseño de Keepwell como página propia (sin la barra lateral de la app), pensada para
// diseñadores: marca, color, tipografía, formas, iconos y el aspecto de los componentes.

const NAV = [
  { id: "marca", title: "Logo" },
  { id: "color", title: "Color" },
  { id: "tipografia", title: "Tipografía" },
  { id: "formas", title: "Formas y espaciado" },
  { id: "iconos", title: "Iconos" },
  { id: "componentes", title: "Componentes" },
]

/** La sección que se está leyendo, para resaltarla en la navegación. */
function useActiveSection() {
  const [active, setActive] = useState(NAV[0]!.id)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: "-10% 0px -75% 0px" }
    )
    for (const { id } of NAV) {
      const node = document.getElementById(id)
      if (node) observer.observe(node)
    }
    return () => observer.disconnect()
  }, [])
  return active
}

export function DesignSystemScreen() {
  const active = useActiveSection()
  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto grid w-full max-w-[1500px] gap-10 px-(--gutter) md:px-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav
            aria-label="Secciones"
            className="sticky top-0 flex flex-col gap-1 py-10"
          >
            <a
              href="#inicio"
              className="mb-6 self-start rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Wordmark size={26} />
            </a>
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                aria-current={active === item.id ? "location" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 type-label transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active === item.id
                    ? "bg-card text-foreground"
                    : "text-text-secondary hover:text-foreground"
                )}
              >
                {item.title}
              </a>
            ))}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-col gap-16 py-10">
          <header
            id="inicio"
            className="flex scroll-mt-8 flex-col gap-6 rounded-[var(--radius-surface)] p-8 md:p-12"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--brand-600), var(--brand-900) 60%, var(--kw-surface-surface))",
            }}
          >
            <Wordmark size={36} className="text-white" />
            <div className="flex flex-col gap-2">
              <h1 className="type-display text-white">Sistema de diseño</h1>
              <p className="type-heading font-medium text-brand-foreground">
                Este es el sistema de diseño de Keepwell.
              </p>
            </div>
          </header>
          <nav
            aria-label="Secciones"
            className="-mx-(--gutter) flex gap-2 overflow-x-auto px-(--gutter) md:-mx-8 md:px-8 lg:hidden"
          >
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="inline-flex h-8 shrink-0 items-center rounded-full bg-card px-3.5 type-label whitespace-nowrap text-text-secondary hover:text-foreground"
              >
                {item.title}
              </a>
            ))}
          </nav>
          <BrandSection />
          <ColorSection />
          <TypographySection />
          <ShapeSection />
          <IconsSection />
          <ComponentsSection />
        </main>
      </div>
    </div>
  )
}
