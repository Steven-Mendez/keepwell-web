"use client"

import { useSyncExternalStore, type ReactNode } from "react"

import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

// Piezas de maquetación de la página del sistema de diseño.

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
    .then(() => toast.add({ title: `Copiado: ${text}`, type: "success" }))
    .catch(() => toast.add({ title: "No se pudo copiar al portapapeles" }))
}

/** Una sección principal con ancla para la navegación lateral. */
export function DocSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className="flex scroll-mt-8 flex-col gap-6 border-t border-divider pt-12"
    >
      <header className="flex max-w-3xl flex-col gap-2">
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

/** Un bloque dentro de una sección: título y, opcionalmente, una frase que lo explica. */
export function Block({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="type-heading text-foreground">{title}</h3>
        {description ? (
          <p className="max-w-3xl type-caption leading-relaxed text-muted-foreground">
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

/** Una tarjeta de superficie para agrupar contenido. */
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
