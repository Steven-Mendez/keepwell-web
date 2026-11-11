import type { Transaction } from "@/lib/schema"

export type RowMenuAction =
  | { kind: "showTag"; tag: string }
  | { kind: "split" }
  | { kind: "confirm" }
  | { kind: "delete" }

/** What a movement's row menu offers, in iOS TransactionsView's order. */
export function rowMenuActions(transaction: Pick<Transaction, "kind" | "status" | "tags">): RowMenuAction[] {
  const actions: RowMenuAction[] = (transaction.tags ?? []).map((tag) => ({ kind: "showTag", tag }))
  if (transaction.kind === "expense") actions.push({ kind: "split" })
  if (transaction.status === "planned") actions.push({ kind: "confirm" })
  actions.push({ kind: "delete" })
  return actions
}

/** "KW-" and the first eight characters of the id, as iOS TransactionDetailViewModel.reference. */
export function movementReference(id: string): string {
  return "KW-" + id.slice(0, 8).toUpperCase()
}
