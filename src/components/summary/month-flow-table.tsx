import type { Translator } from "@/lib/i18n"

export interface MonthFlowRow {
  key: string
  name: string
  income: string
  expense: string
  result: string
}

/** The charts' months as a table for screen readers, since the charts themselves are hidden from them. */
export function MonthFlowTable({
  t,
  caption,
  rows,
}: {
  t: Translator
  caption: string
  rows: readonly MonthFlowRow[]
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th>{t.in("summary", "Month")}</th>
          <th>{t.in("summary", "Came in")}</th>
          <th>{t.in("summary", "Went out")}</th>
          <th>{t.in("summary", "Result")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td>{row.name}</td>
            <td>{row.income}</td>
            <td>{row.expense}</td>
            <td>{row.result}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
