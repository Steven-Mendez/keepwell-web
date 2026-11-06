import type { Account, Card, Settings, Transaction, TransactionCategory } from "@/lib/schema"
import { DEFAULT_CATEGORIES, isFallbackCategory, orderedCategories, shippedCategory } from "@/lib/schema"

import { DomainError } from "./errors"

/**
 * The storage contracts use cases depend on (iOS `Repositories.swift`). The app implements it over
 * IndexedDB (`src/lib/repositories/ledger-store.ts`); tests use `InMemoryStore`.
 */
export interface LedgerStore {
  fetchAccounts(): Promise<Account[]>
  /** Inserts or replaces the account with the same id. */
  saveAccount(account: Account): Promise<void>
  /** Soft-deletes; throws `notFound` for a missing or deleted account. */
  deleteAccount(id: string): Promise<void>

  fetchCards(): Promise<Card[]>
  saveCard(card: Card): Promise<void>
  deleteCard(id: string): Promise<void>

  /** Newest first. */
  fetchTransactions(): Promise<Transaction[]>
  saveTransaction(transaction: Transaction): Promise<void>
  deleteTransaction(id: string): Promise<void>

  /** In the person's order, defaults included except the ones deleted. */
  fetchCategories(): Promise<TransactionCategory[]>
  /** A new id goes after the existing ones; an existing one keeps its place. */
  saveCategory(category: TransactionCategory): Promise<void>
  /** A missing id succeeds; a default leaves a tombstone. */
  deleteCategory(id: string): Promise<void>
  /** Ids left out keep their relative order after the listed ones. */
  reorderCategories(ids: readonly string[]): Promise<void>
  /** Every default back as shipped, deleted ones included; the person's own follow. */
  restoreDefaultCategories(): Promise<void>

  /** `undefined` before onboarding saves the first settings. */
  loadSettings(): Promise<Settings | undefined>
  saveSettings(settings: Settings): Promise<void>

  /** Runs `work` so that either every write in it lands or none does. */
  atomically<T>(work: () => Promise<T>): Promise<T>
}

/** Device-local name the app greets with (iOS `ProfileRepository`). */
export interface ProfileStore {
  preferredName(): string | undefined
  setPreferredName(name: string | undefined): void
}

const byNewestFirst = (a: Transaction, b: Transaction) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)

/** iOS `InMemoryStore`: the same contracts held in arrays, for tests. */
export class InMemoryStore implements LedgerStore, ProfileStore {
  accounts: Account[]
  cards: Card[]
  transactions: Transaction[]
  /** In stored order; ids in `deletedCategoryIds` are tombstones. */
  categories: TransactionCategory[]
  deletedCategoryIds = new Set<string>()
  settings: Settings | undefined
  name: string | undefined

  constructor(seed: Partial<{ accounts: Account[]; cards: Card[]; transactions: Transaction[]; categories: TransactionCategory[]; settings: Settings }> = {}) {
    this.accounts = [...(seed.accounts ?? [])]
    this.cards = [...(seed.cards ?? [])]
    this.transactions = [...(seed.transactions ?? [])]
    this.categories = [...(seed.categories ?? DEFAULT_CATEGORIES)]
    this.settings = seed.settings
  }

  async fetchAccounts() {
    return [...this.accounts]
  }
  async saveAccount(account: Account) {
    this.accounts = upsert(this.accounts, account)
  }
  async deleteAccount(id: string) {
    if (!this.accounts.some((account) => account.id === id)) throw DomainError.notFound(id)
    this.accounts = this.accounts.filter((account) => account.id !== id)
  }

  async fetchCards() {
    return [...this.cards]
  }
  async saveCard(card: Card) {
    this.cards = upsert(this.cards, card)
  }
  async deleteCard(id: string) {
    if (!this.cards.some((card) => card.id === id)) throw DomainError.notFound(id)
    this.cards = this.cards.filter((card) => card.id !== id)
  }

  async fetchTransactions() {
    return [...this.transactions].sort(byNewestFirst)
  }
  async saveTransaction(transaction: Transaction) {
    this.transactions = upsert(this.transactions, transaction)
  }
  async deleteTransaction(id: string) {
    if (!this.transactions.some((transaction) => transaction.id === id)) throw DomainError.notFound(id)
    this.transactions = this.transactions.filter((transaction) => transaction.id !== id)
  }

  async fetchCategories() {
    const present = new Set(this.categories.map((category) => category.id))
    const missing = DEFAULT_CATEGORIES.filter((category) => !present.has(category.id) && !this.deletedCategoryIds.has(category.id))
    this.categories = [...this.categories, ...missing]
    return this.categories.filter((category) => !this.deletedCategoryIds.has(category.id))
  }
  async saveCategory(category: TransactionCategory) {
    this.deletedCategoryIds.delete(category.id)
    this.categories = upsert(this.categories, category)
  }
  async deleteCategory(id: string) {
    if (isFallbackCategory(id)) throw DomainError.fallbackCategoryCantBeDeleted(id)
    if (shippedCategory(id)) this.deletedCategoryIds.add(id)
    else this.categories = this.categories.filter((category) => category.id !== id)
  }
  async reorderCategories(ids: readonly string[]) {
    const rank = new Map<string, number>()
    ids.forEach((id, index) => {
      if (!rank.has(id)) rank.set(id, index)
    })
    const listed = this.categories.filter((c) => rank.has(c.id)).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
    this.categories = [...listed, ...this.categories.filter((c) => !rank.has(c.id))]
  }
  async restoreDefaultCategories() {
    this.deletedCategoryIds.clear()
    this.categories = [...DEFAULT_CATEGORIES, ...this.categories.filter((category) => !shippedCategory(category.id))]
  }

  async loadSettings() {
    return this.settings
  }
  async saveSettings(settings: Settings) {
    this.settings = settings
  }

  async atomically<T>(work: () => Promise<T>): Promise<T> {
    const snapshot = { accounts: this.accounts, cards: this.cards, transactions: this.transactions, categories: this.categories, settings: this.settings }
    try {
      return await work()
    } catch (error) {
      Object.assign(this, snapshot)
      throw error
    }
  }

  preferredName() {
    return this.name
  }
  setPreferredName(name: string | undefined) {
    this.name = name
  }
}

function upsert<T extends { id: string }>(list: readonly T[], item: T): T[] {
  const index = list.findIndex((existing) => existing.id === item.id)
  if (index < 0) return [...list, item]
  const copy = [...list]
  copy[index] = item
  return copy
}

export { orderedCategories }
