"use client"

import { useSyncExternalStore, type ReactNode } from "react"

import { KWIcon } from "@/components/kw/kw-icon"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

// Piezas de maquetación de la documentación del sistema de diseño: secciones con ancla, marcos
// punteados para los ejemplos, tablas de propiedades, fragmentos de código y botones de copiar.

/** El valor actual de una variable CSS de :root (vacío en el servidor). */
export function useToken(name: string): string {
  return useSyncExternalStore(
    subscribeNever,
    () =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    () => ""
  )
}

function subscribeNever() {
  return () => {}
}

export function copyText(text: string) {
  void navigator.clipboard
    .writeText(text)
    .then(() =>
      toast.add({
        title: `Copiado: ${text.length > 48 ? `${text.slice(0, 48)}…` : text}`,
        type: "success",
      })
    )
    .catch(() => toast.add({ title: "No se pudo copiar al portapapeles" }))
}

/** Un texto de código que se copia al hacer clic (clase, variable, nombre de icono…). */
export function Copyable({
  text,
  className,
  children,
}: {
  text: string
  className?: string
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => copyText(text)}
      title="Copiar"
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded-md bg-secondary px-1.5 py-0.5 text-left font-mono type-caption-sm text-text-secondary transition-colors outline-none hover:bg-secondary/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      {children ?? text}
    </button>
  )
}

/** Una sección principal con ancla para la navegación lateral. */
export function DocSection({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className="flex scroll-mt-8 flex-col gap-8 border-t border-divider pt-12 first:border-t-0 first:pt-0"
    >
      <header className="flex max-w-3xl flex-col gap-2">
        <span className="type-micro tracking-widest text-link uppercase">
          {eyebrow}
        </span>
        <h2 className="type-title text-foreground">{title}</h2>
        {description ? (
          <p className="type-body leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  )
}

/** Un bloque dentro de una sección: título, metadatos y, opcionalmente, el componente que lo dibuja. */
export function Block({
  id,
  title,
  meta,
  source,
  description,
  children,
}: {
  id?: string
  title: string
  meta?: string
  source?: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <div id={id} className="flex scroll-mt-8 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="type-heading text-foreground">{title}</h3>
          {meta ? (
            <span className="type-caption text-muted-foreground">{meta}</span>
          ) : null}
          {source ? <Copyable text={source} /> : null}
        </div>
        {description ? (
          <p className="max-w-3xl type-body leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  )
}

/** El marco punteado que delimita un ejemplo; con `columns`, dividido en columnas punteadas. */
export function Frame({
  columns,
  className,
  children,
}: {
  columns?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-dashed border-ring/40 bg-background",
        columns && "flex divide-x divide-dashed divide-ring/40 [&>*]:shrink-0",
        className
      )}
    >
      {children}
    </div>
  )
}

/** Una tarjeta de superficie (bg-card) para agrupar contenido de la documentación. */
export function Panel({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[var(--radius-surface)] bg-card p-5",
        className
      )}
    >
      {children}
    </div>
  )
}

export function Caption({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn("type-caption-sm text-text-faint", className)}>
      {children}
    </span>
  )
}

/** La píldora con borde que acompaña a un título ("11 estilos"). */
export function Tag({
  children,
  tone = "accent",
}: {
  children: ReactNode
  tone?: "accent" | "positive" | "negative" | "neutral"
}) {
  const look = {
    accent: "text-link ring-ring/60",
    positive: "text-positive ring-positive/60",
    negative: "text-negative ring-negative/60",
    neutral: "text-text-secondary ring-border",
  }[tone]
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 type-micro tracking-wider whitespace-nowrap uppercase ring-1 ring-inset",
        look
      )}
    >
      {children}
    </span>
  )
}

/** Un fragmento de código con botón de copiar. */
export function Code({
  code,
  className,
}: {
  code: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "group/code relative min-w-0 rounded-xl bg-nav ring-1 ring-border ring-inset",
        className
      )}
    >
      <pre className="overflow-x-auto p-4 pr-12 font-mono type-caption leading-relaxed text-text-secondary">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => copyText(code)}
        aria-label="Copiar código"
        className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-secondary text-text-secondary opacity-0 transition-opacity outline-none group-hover/code:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:opacity-100"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
        </svg>
      </button>
    </div>
  )
}

export interface PropRow {
  name: string
  type: string
  defaultValue?: string
  description: string
}

/** La tabla de propiedades de un componente. */
export function PropsTable({ rows }: { rows: PropRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-border ring-inset">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="border-b border-divider type-caption-sm text-text-faint">
            <th className="px-4 py-2.5 font-semibold">Propiedad</th>
            <th className="px-4 py-2.5 font-semibold">Tipo</th>
            <th className="px-4 py-2.5 font-semibold">Por defecto</th>
            <th className="px-4 py-2.5 font-semibold">Descripción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {rows.map((row) => (
            <tr key={row.name} className="align-top">
              <td className="px-4 py-2.5">
                <code className="font-mono type-caption text-foreground">
                  {row.name}
                </code>
              </td>
              <td className="px-4 py-2.5">
                <code className="font-mono type-caption-sm break-words text-link">
                  {row.type}
                </code>
              </td>
              <td className="px-4 py-2.5">
                <code className="font-mono type-caption-sm text-text-secondary">
                  {row.defaultValue ?? "—"}
                </code>
              </td>
              <td className="px-4 py-2.5 type-caption text-muted-foreground">
                {row.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Un par "Sí / No" con ejemplo visual y explicación. */
export function DoDont({
  good,
  children,
  note,
}: {
  good: boolean
  children: ReactNode
  note: ReactNode
}) {
  return (
    <figure className="flex flex-col overflow-hidden rounded-2xl bg-card">
      <div className="flex min-h-32 items-center justify-center gap-3 bg-background p-6">
        {children}
      </div>
      <figcaption
        className={cn(
          "flex flex-col gap-1 border-t-2 p-4",
          good ? "border-positive" : "border-negative"
        )}
      >
        <span
          className={cn(
            "inline-flex items-center gap-1.5 type-label",
            good ? "text-positive" : "text-negative"
          )}
        >
          <KWIcon name={good ? "check" : "close"} size={14} strokeWidth={2.6} />
          {good ? "Sí" : "No"}
        </span>
        <span className="type-caption leading-relaxed text-muted-foreground">
          {note}
        </span>
      </figcaption>
    </figure>
  )
}

// MARK: - Contraste (WCAG 2.1)

function channel(value: number) {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const digits =
    match[1]!.length === 3
      ? [...match[1]!].map((d) => d + d).join("")
      : match[1]!
  const n = parseInt(digits, 16)
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  )
}

/** La relación de contraste entre dos colores hex, o null si alguno no es hex. */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a)
  const lb = luminance(b)
  if (la === null || lb === null) return null
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export function ContrastBadge({ ratio }: { ratio: number | null }) {
  if (ratio === null) return <Caption>—</Caption>
  const level =
    ratio >= 7
      ? "AAA"
      : ratio >= 4.5
        ? "AA"
        : ratio >= 3
          ? "AA grande"
          : "Falla"
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono type-caption-sm text-text-secondary tabular-nums">
        {ratio.toFixed(1)}:1
      </span>
      <Tag
        tone={ratio >= 4.5 ? "positive" : ratio >= 3 ? "neutral" : "negative"}
      >
        {level}
      </Tag>
    </span>
  )
}
