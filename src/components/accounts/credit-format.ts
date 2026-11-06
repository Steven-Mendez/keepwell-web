import type { Translator } from "@/lib/i18n"

// Texts of the credit card detail, apart from its markup in account-detail.tsx.

/** "Day 15 · next Mar 15", or "Not set" for a day the card doesn't have yet. */
export function creditDayValue(
  t: Translator,
  day: number | undefined,
  next: Date | undefined
) {
  if (day === undefined) return t.in("creditcard", "Not set")
  if (!next) return t.in("creditcard", "Day %lld", day)
  const short = next.toLocaleDateString(t.locale, {
    day: "numeric",
    month: "short",
  })
  return t.in("creditcard", "Day %lld · next %@", day, short)
}
