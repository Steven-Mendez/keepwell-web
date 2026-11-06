"use client"

import { useEffect, useState } from "react"

import { KWIcon } from "@/components/kw/kw-icon"
import { KW_ICONS } from "@/components/kw/kw-icon-data"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"

import { BrandSection, Wordmark } from "./ds-brand"
import {
  AnatomySection,
  ButtonsSection,
  FeedbackSection,
  FormsSection,
  ListsSection,
  SelectionSection,
  StatusSection,
} from "./ds-components"
import {
  ColorSection,
  LayoutSection,
  MotionSection,
  ShapeSection,
  TypographySection,
} from "./ds-foundations"
import { IconsSection } from "./ds-icons"
import { DocSection, DoDont } from "./ds-parts"

// El sistema de diseño de Keepwell, como página propia (sin la barra lateral de la app): marca,
// fundamentos, componentes y patrones, cada uno dibujado con los componentes reales.

const NAV: { group: string; items: { id: string; title: string }[] }[] = [
  { group: "Introducción", items: [{ id: "principios", title: "Principios" }] },
  { group: "Marca", items: [{ id: "marca", title: "Logo e identidad" }] },
  {
    group: "Fundamentos",
    items: [
      { id: "color", title: "Color" },
      { id: "tipografia", title: "Tipografía" },
      { id: "espaciado", title: "Espaciado y maquetación" },
      { id: "formas", title: "Radios y elevación" },
      { id: "movimiento", title: "Movimiento" },
      { id: "iconos", title: "Iconografía" },
    ],
  },
  {
    group: "Componentes",
    items: [
      { id: "botones", title: "Botones" },
      { id: "seleccion", title: "Segmentados y chips" },
      { id: "estados", title: "Movimientos y estados" },
      { id: "formularios", title: "Formularios" },
      { id: "listas", title: "Listas y tarjetas" },
      { id: "comunicacion", title: "Comunicación" },
    ],
  },
  {
    group: "Patrones",
    items: [
      { id: "anatomia", title: "Anatomía de una pantalla" },
      { id: "accesibilidad", title: "Accesibilidad" },
    ],
  },
]

const IDS = NAV.flatMap((group) => group.items.map((item) => item.id))

/** La sección que se está leyendo, para resaltarla en la navegación. */
function useActiveSection() {
  const [active, setActive] = useState(IDS[0]!)
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
    for (const id of IDS) {
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
      <div className="mx-auto grid w-full max-w-[1600px] gap-10 px-(--gutter) md:px-8 lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav
            aria-label="Secciones"
            className="sticky top-0 flex max-h-svh flex-col gap-6 overflow-y-auto py-10"
          >
            <a
              href="#inicio"
              className="self-start rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Wordmark size={26} />
            </a>
            {NAV.map((group) => (
              <div key={group.group} className="flex flex-col gap-1">
                <span className="px-3 pb-1 type-micro tracking-widest text-text-faint uppercase">
                  {group.group}
                </span>
                {group.items.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    aria-current={active === item.id ? "location" : undefined}
                    className={cn(
                      "rounded-lg px-3 py-1.5 type-label transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active === item.id
                        ? "bg-card text-foreground"
                        : "text-text-secondary hover:text-foreground"
                    )}
                  >
                    {item.title}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-col gap-16 py-10">
          <Hero />
          <MobileNav />
          <PrinciplesSection />
          <BrandSection />
          <ColorSection />
          <TypographySection />
          <LayoutSection />
          <ShapeSection />
          <MotionSection />
          <IconsSection />
          <ButtonsSection />
          <SelectionSection />
          <StatusSection />
          <FormsSection />
          <ListsSection />
          <FeedbackSection />
          <AnatomySection />
          <AccessibilitySection />
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-6 type-caption text-text-faint">
            <Wordmark size={18} className="text-text-faint" />
            <span>Sistema de diseño de Keepwell</span>
          </footer>
        </main>
      </div>
    </div>
  )
}

function Hero() {
  const stats = [
    { value: "Inter", label: "familia tipográfica" },
    { value: "11", label: "estilos de texto" },
    { value: String(Object.keys(KW_ICONS).length), label: "iconos" },
    { value: "32 · 40 · 48", label: "alturas de control" },
  ]
  return (
    <header
      id="inicio"
      className="flex scroll-mt-8 flex-col gap-8 overflow-hidden rounded-[var(--radius-surface)] p-8 md:p-12"
      style={{
        backgroundImage:
          "linear-gradient(135deg, var(--brand-600), var(--brand-900) 60%, var(--kw-surface-surface))",
      }}
    >
      <Wordmark size={36} className="text-white" />
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="type-display text-white">Sistema de diseño</h1>
        <p className="type-heading font-medium text-brand-foreground">
          Este es el sistema de diseño de Keepwell.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col rounded-2xl bg-black/25 p-4 backdrop-blur-sm"
          >
            <dt className="order-2 type-caption text-brand-foreground">
              {stat.label}
            </dt>
            <dd className="type-amount-sm text-white">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  )
}

/** En pantallas estrechas la navegación lateral se convierte en una fila de enlaces desplazable. */
function MobileNav() {
  return (
    <nav
      aria-label="Secciones"
      className="-mx-(--gutter) flex gap-2 overflow-x-auto px-(--gutter) md:-mx-8 md:px-8 lg:hidden"
    >
      {NAV.flatMap((group) => group.items).map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="inline-flex h-8 shrink-0 items-center rounded-full bg-card px-3.5 type-label whitespace-nowrap text-text-secondary outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {item.title}
        </a>
      ))}
    </nav>
  )
}

const PRINCIPLES = [
  {
    icon: "list",
    title: "Construye con kw/",
    text: "Las pantallas se arman con los componentes de src/components/kw. shadcn queda debajo para el comportamiento, nunca con su aspecto.",
  },
  {
    icon: "droplet",
    title: "Color por rol",
    text: "Nunca hex sueltos: bg-card, text-negative, text-link… El gasto es coral suave, nunca rojo de alarma.",
  },
  {
    icon: "pencil",
    title: "Una escala de texto",
    text: "Solo las clases type-* (display, title, heading, body, label, caption, micro). Nunca los tamaños de texto de Tailwind.",
  },
  {
    icon: "barsBaseline",
    title: "Tres alturas",
    text: "32, 40 y 48 px. Los controles de una misma fila comparten altura.",
  },
  {
    icon: "creditCard",
    title: "Formas constantes",
    text: "Píldoras para botones y chips; 20 px para tarjetas; 12 px para campos; 18 px para el arte de tarjetas.",
  },
  {
    icon: "home",
    title: "Misma estructura",
    text: "Page → KWLargeTitleHeader → KWSection → KWGroupedCard. Los títulos se alinean de pantalla a pantalla.",
  },
  {
    icon: "bolt",
    title: "Pensado para escritorio",
    text: "Hover y foco visibles en todo lo clicable, tooltips con atajos, dos columnas desde lg y diálogos en lugar de hojas.",
  },
  {
    icon: "phone",
    title: "iOS es la referencia",
    text: "Colores, tipografía, radios e iconos vienen del DesignSystem de iOS y se sincronizan con pnpm tokens:sync.",
  },
] as const

function PrinciplesSection() {
  return (
    <DocSection
      id="principios"
      eyebrow="Introducción"
      title="Principios"
      description="Ocho reglas que mantienen la web y la app de iPhone como un mismo producto. La guía para el código está en src/components/kw/DESIGN.md."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PRINCIPLES.map((principle, index) => (
          <div
            key={principle.title}
            className="flex flex-col gap-3 rounded-[var(--radius-surface)] bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-full bg-accent-tint text-link">
                <KWIcon name={principle.icon} size={20} />
              </span>
              <span className="font-mono type-caption-sm text-text-faint">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <span className="type-heading text-foreground">
              {principle.title}
            </span>
            <span className="type-caption leading-relaxed text-muted-foreground">
              {principle.text}
            </span>
          </div>
        ))}
      </div>
    </DocSection>
  )
}

function AccessibilitySection() {
  return (
    <DocSection
      id="accesibilidad"
      eyebrow="Patrones"
      title="Accesibilidad"
      description="Lo mínimo que debe cumplir cualquier pantalla nueva."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Foco visible",
            text: "Todo elemento interactivo muestra el anillo azul (ring-2 ring-ring) al navegar con teclado. Pulsa Tab en esta página para verlo.",
          },
          {
            title: "Contraste",
            text: "Revisa la tabla de contraste en Color. text-faint se reserva para metadatos, nunca para información esencial.",
          },
          {
            title: "Etiquetas",
            text: "Los botones de solo icono llevan label (aria-label) y tooltip. Los iconos decorativos van con aria-hidden.",
          },
          {
            title: "No solo color",
            text: "Un estado nunca se comunica solo con color: el gasto lleva el signo «−» y su icono; las píldoras, texto.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="flex flex-col gap-2 rounded-[var(--radius-surface)] bg-card p-5"
          >
            <span className="type-heading text-foreground">{item.title}</span>
            <span className="type-caption leading-relaxed text-muted-foreground">
              {item.text}
            </span>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <DoDont
          good
          note="Importe con signo, color e icono: se entiende aunque no se distinga el color."
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-negative-tint text-negative">
            <KWIcon name="arrowUpRight" />
          </span>
          <span className="type-amount-sm text-negative">−C$420.00</span>
        </DoDont>
        <DoDont
          good={false}
          note="Solo color, sin signo ni icono, y en rojo de alarma: ambiguo y alarmista."
        >
          <span className="type-amount-sm" style={{ color: "#FF3B30" }}>
            C$420.00
          </span>
        </DoDont>
      </div>
      <p className="flex flex-wrap items-center gap-1.5 type-caption text-text-secondary">
        Atajos de la app: <Kbd>⌘K</Kbd> paleta de comandos, <Kbd>N</Kbd> nuevo
        movimiento, <Kbd>/</Kbd> buscar, <Kbd>G</Kbd> + letra para ir a una
        sección, <Kbd>?</Kbd> ver todos.
      </p>
    </DocSection>
  )
}
