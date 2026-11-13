import { db, merchantToRow, rowToMerchant } from "@/lib/db"
import { Merchant } from "@/lib/schema"

import { isAlive, softDelete, upsert } from "./shared"

export const merchantRepository = {
  /** Alive merchants, in no particular order: screens sort them with `orderedMerchants`. */
  async list(): Promise<Merchant[]> {
    const rows = await db.merchants.filter(isAlive).toArray()
    return rows.map(rowToMerchant)
  },

  async save(input: Merchant): Promise<Merchant> {
    const merchant = Merchant.parse(input)
    await upsert(db.merchants, "merchant", merchantToRow(merchant))
    return merchant
  },

  async remove(id: string): Promise<void> {
    await softDelete(db.merchants, "merchant", id)
  },
}
