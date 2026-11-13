import { db } from "@/lib/db"
import type { LedgerStore, ProfileStore } from "@/lib/domain/store"
import { deviceTimeZone } from "@/lib/platform/time-zone"

import { accountRepository, cardRepository } from "./accounts"
import { categorizationRuleRepository } from "./categorization-rules"
import { categoryRepository } from "./categories"
import { loanRepository, personalDebtRepository } from "./debts"
import { merchantRepository } from "./merchants"
import { recurringRuleRepository } from "./recurring"
import { savingsGoalRepository } from "./savings-goals"
import { settingsRepository } from "./settings"
import { transactionRepository } from "./transactions"

const allTables = () => [db.accounts, db.cards, db.categories, db.transactions, db.recurring_rules, db.savings_goals, db.loans, db.loan_payments, db.personal_debts, db.personal_debt_repayments, db.categorization_rules, db.settings, db.notification_states, db.merchants, db.sync_outbox]

/** What `meta` keeps through "Delete all my data": this browser's sync identity and its account. */
const KEPT_META = ["client_id", "sync_user"]

/** The domain's storage contract over IndexedDB: every write goes through the repositories (audit + outbox). */
export const ledgerStore: LedgerStore = {
  get timeZone() {
    return deviceTimeZone()
  },

  fetchAccounts: () => accountRepository.list(),
  saveAccount: async (account) => void (await accountRepository.save(account)),
  deleteAccount: (id) => accountRepository.remove(id),

  fetchCards: () => cardRepository.list(),
  saveCard: async (card) => void (await cardRepository.save(card)),
  deleteCard: (id) => cardRepository.remove(id),

  fetchTransactions: () => transactionRepository.list(),
  saveTransaction: async (transaction) => void (await transactionRepository.save(transaction)),
  deleteTransaction: (id) => transactionRepository.remove(id),

  fetchRecurringRules: () => recurringRuleRepository.list(),
  saveRecurringRule: async (rule) => void (await recurringRuleRepository.save(rule)),
  deleteRecurringRule: (id) => recurringRuleRepository.remove(id),

  fetchSavingsGoals: () => savingsGoalRepository.list(),
  saveSavingsGoal: async (goal) => void (await savingsGoalRepository.save(goal)),
  deleteSavingsGoal: (id) => savingsGoalRepository.remove(id),

  fetchLoans: () => loanRepository.list(),
  saveLoan: async (loan) => void (await loanRepository.save(loan)),
  deleteLoan: (id) => loanRepository.remove(id),

  fetchPersonalDebts: () => personalDebtRepository.list(),
  savePersonalDebt: async (debt) => void (await personalDebtRepository.save(debt)),
  deletePersonalDebt: (id) => personalDebtRepository.remove(id),

  fetchCategorizationRules: () => categorizationRuleRepository.list(),
  saveCategorizationRule: async (rule) => void (await categorizationRuleRepository.save(rule)),
  deleteCategorizationRule: (id) => categorizationRuleRepository.remove(id),
  reorderCategorizationRules: (ids) => categorizationRuleRepository.reorder(ids),

  fetchCategories: () => categoryRepository.list(),
  saveCategory: async (category) => void (await categoryRepository.save(category)),
  deleteCategory: (id) => categoryRepository.remove(id),
  reorderCategories: (ids) => categoryRepository.reorder(ids),
  restoreDefaultCategories: () => categoryRepository.restoreDefaults(),

  fetchMerchants: () => merchantRepository.list(),
  saveMerchant: async (merchant) => void (await merchantRepository.save(merchant)),
  deleteMerchant: (id) => merchantRepository.remove(id),

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

/**
 * "Delete all my data": every table on this device, then the shipped categories again. The sync
 * cursor goes too, so a signed-in browser starts over with a first sync (and gets the account's
 * data back) instead of following on from data it no longer has. Signed in, the browser is signed
 * out first (`signOut`): the account keeps its copy, and staying signed in would bring it straight
 * back. If signing out fails nothing is erased.
 */
export async function eraseAllData(options: { signOut?: () => Promise<unknown> } = {}): Promise<void> {
  if (options.signOut) await options.signOut()
  await db.transaction("rw", [...allTables(), db.meta], async () => {
    await Promise.all(allTables().map((table) => table.clear()))
    await db.meta.where("key").noneOf(KEPT_META).delete()
  })
  profileStore.setPreferredName(undefined)
  await categoryRepository.ensureDefaults()
}
