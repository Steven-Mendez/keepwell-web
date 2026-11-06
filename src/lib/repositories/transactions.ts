import { db, rowToTransaction, transactionToRow } from "@/lib/db"
import { Transaction } from "@/lib/schema"

import type { Draft } from "./accounts"
import { isAlive, softDelete, upsert } from "./shared"

/** Half-open `[start, end)`, as ISO instants. */
export interface Period {
  start: string
  end: string
}

export const transactionRepository = {
  /** Alive movements, newest first; `period` limits them by date (start included, end excluded). */
  async list(period?: Period): Promise<Transaction[]> {
    const byDate = period
      ? db.transactions.where("date").between(new Date(period.start).toISOString(), new Date(period.end).toISOString(), true, false)
      : db.transactions.orderBy("date")
    const rows = await byDate.reverse().filter(isAlive).toArray()
    return rows.map(rowToTransaction)
  },

  /** Validates the iOS rules (positive amount and bank charge, known currencies) before writing. */
  async save(draft: Draft<Transaction>): Promise<Transaction> {
    const transaction = Transaction.parse({ ...draft, id: draft.id ?? crypto.randomUUID() })
    await upsert(db.transactions, "transaction", transactionToRow(transaction))
    return transaction
  },

  async remove(id: string): Promise<void> {
    await softDelete(db.transactions, "transaction", id)
  },
}
