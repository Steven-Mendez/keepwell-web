import type { UnconvertedMovements } from "@/lib/domain"
import type { Namespace, Translator } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/**
 * "Not including N movements in USD", one line per currency: what a total left out because the
 * rate those movements stored doesn't reach today's main currency. Nothing when it left nothing out.
 */
export function UnconvertedNote({
  t,
  ns,
  excluded,
  className,
}: {
  t: Translator
  ns: Extract<Namespace, "home" | "summary" | "transactions">
  excluded: readonly UnconvertedMovements[]
  className?: string
}) {
  if (excluded.length === 0) return null
  return (
    <div
      className={cn(
        "flex flex-col type-caption text-muted-foreground tabular-nums",
        className
      )}
    >
      {excluded.map(({ currency, count }) => (
        <span key={currency}>
          {t.in(ns, "Not including %lld movements in %@", count, currency)}
        </span>
      ))}
    </div>
  )
}
