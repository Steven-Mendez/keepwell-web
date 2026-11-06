import { db, accountToRow, cardToRow, rowToAccount, rowToCard } from "@/lib/db"
import { Account, Card } from "@/lib/schema"

import { isAlive, softDelete, upsert } from "./shared"

/** A record to save: without `id` it is new and gets a client-generated UUID. */
export type Draft<T extends { id: string }> = Omit<T, "id"> & { id?: string }

function withId<T extends { id: string }>(draft: Draft<T>): Draft<T> & { id: string } {
  return { ...draft, id: draft.id ?? crypto.randomUUID() }
}

export const accountRepository = {
  /** Alive accounts, oldest first. */
  async list(): Promise<Account[]> {
    const rows = await db.accounts.orderBy("created_at").filter(isAlive).toArray()
    return rows.map(rowToAccount)
  },

  async save(draft: Draft<Account>): Promise<Account> {
    const account = Account.parse(withId(draft))
    await upsert(db.accounts, "account", accountToRow(account))
    return account
  },

  /** Soft delete. Its cards and movements are deleted by the caller, as on iOS. */
  async remove(id: string): Promise<void> {
    await softDelete(db.accounts, "account", id)
  },
}

export const cardRepository = {
  async list(): Promise<Card[]> {
    const rows = await db.cards.orderBy("created_at").filter(isAlive).toArray()
    return rows.map(rowToCard)
  },

  async save(draft: Draft<Card>): Promise<Card> {
    const card = Card.parse(withId(draft))
    const row = await upsert(db.cards, "card", cardToRow(card))
    return rowToCard(row)
  },

  async remove(id: string): Promise<void> {
    await softDelete(db.cards, "card", id)
  },
}
