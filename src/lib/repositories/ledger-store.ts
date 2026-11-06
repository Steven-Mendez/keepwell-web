import { db } from "@/lib/db"
import type { LedgerStore, ProfileStore } from "@/lib/domain/store"

import { accountRepository, cardRepository } from "./accounts"
import { categoryRepository } from "./categories"
import { settingsRepository } from "./settings"
import { transactionRepository } from "./transactions"

const allTables = () => [db.accounts, db.cards, db.categories, db.transactions, db.settings, db.sync_outbox]

/** The domain's storage contract over IndexedDB: every write goes through the repositories (audit + outbox). */
export const ledgerStore: LedgerStore = {
  fetchAccounts: () => accountRepository.list(),
  saveAccount: async (account) => void (await accountRepository.save(account)),
  deleteAccount: (id) => accountRepository.remove(id),

  fetchCards: () => cardRepository.list(),
  saveCard: async (card) => void (await cardRepository.save(card)),
  deleteCard: (id) => cardRepository.remove(id),

  fetchTransactions: () => transactionRepository.list(),
  saveTransaction: async (transaction) => void (await transactionRepository.save(transaction)),
  deleteTransaction: (id) => transactionRepository.remove(id),

  fetchCategories: () => categoryRepository.list(),
  saveCategory: async (category) => void (await categoryRepository.save(category)),
  deleteCategory: (id) => categoryRepository.remove(id),
  reorderCategories: (ids) => categoryRepository.reorder(ids),
  restoreDefaultCategories: () => categoryRepository.restoreDefaults(),

  loadSettings: () => settingsRepository.load(),
  saveSettings: async (settings) => void (await settingsRepository.save(settings)),

  atomically: (work) => db.transaction("rw", allTables(), work),
}

const NAME_KEY = "keepwell.preferredName"

/** Device-local like iOS (never in the synced store or a backup). */
export const profileStore: ProfileStore = {
  preferredName() {
    try {
      return localStorage.getItem(NAME_KEY) ?? undefined
    } catch {
      return undefined
    }
  },
  setPreferredName(name) {
    try {
      if (name === undefined) localStorage.removeItem(NAME_KEY)
      else localStorage.setItem(NAME_KEY, name)
      window.dispatchEvent(new Event("keepwell:profile"))
    } catch {
      // Storage blocked: the app works without a name.
    }
  },
}

/** "Delete all my data": every table on this device, then the shipped categories again. */
export async function eraseAllData(): Promise<void> {
  await db.transaction("rw", allTables(), async () => {
    await Promise.all(allTables().map((table) => table.clear()))
  })
  profileStore.setPreferredName(undefined)
  await categoryRepository.ensureDefaults()
}
