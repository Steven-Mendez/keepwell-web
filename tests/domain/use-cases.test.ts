// Ports of keepwell-ios use-case tests: CategoryActions, BankAccounts, CardActions,
// TransactionActions, CreateTransaction, MovementTypeAndPreview, Home, Accounts, CreditCard, AddCard
// and CompleteOnboarding.
import { describe, expect, it } from "vitest"

import {
  DomainError,
  HOME_RECENT_COUNT,
  InMemoryStore,
  accountsOverview,
  addAccount,
  addCreditCard,
  allowsDestination,
  allowsSource,
  availableMovementTypes,
  balanceOf,
  cardExpiry,
  confirmPlannedTransaction,
  convert,
  convertsCurrency,
  creditCardDetail,
  debitCardDetail,
  debitCardFor,
  deleteAccount,
  deleteCategory,
  deleteTransaction,
  getCategories,
  getTransactionContext,
  homeOverview,
  isDefaultCategory,
  keeperOf,
  lastUsedSource,
  loadLedger,
  movementKind,
  movementTypeOf,
  netWorth,
  normalizeBankCards,
  previewMovement,
  reassignDeletedCategories,
  renameAccount,
  reorderCategories,
  restoreDefaultCategories,
  rounded,
  saveCategory,
  saveTransaction,
  scopeIncludes,
  setCardColor,
  setCardDetails,
  settingsRate,
  translatesById,
  unconfirmTransaction,
  updateCreditTerms,
  yearMonthContaining,
  bankRate,
  currencySettings,
  draftFrom,
  type CreditCardDraft,
  type TransactionDraft,
} from "@/lib/domain"
import {
  completeOnboarding,
  makeOnboardingAccount,
  onboardingDisplayName,
  type OnboardingAccountDraft,
} from "@/lib/domain/onboarding"
import type { Account, RecurringRule } from "@/lib/schema"
import { DEFAULT_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES, OTHER_EXPENSE_ID, OTHER_INCOME_ID, orderedCategories } from "@/lib/schema"

import { d, IDs, referenceDate, sampleData, sampleStore, transaction, ZONE } from "./fixtures"

async function expectDomainError(work: () => Promise<unknown>, code: DomainError["code"], detail?: string) {
  const error = await work().then(
    () => undefined,
    (thrown: unknown) => thrown,
  )
  expect(error).toBeInstanceOf(DomainError)
  expect((error as DomainError).code).toBe(code)
  if (detail !== undefined) expect((error as DomainError).detail).toBe(detail)
}

describe("Category actions", () => {
  it("defaults have unique ids and end with Other", () => {
    expect(DEFAULT_EXPENSE_CATEGORIES.at(-1)?.id).toBe(OTHER_EXPENSE_ID)
    expect(DEFAULT_CATEGORIES.at(-1)?.id).toBe(OTHER_INCOME_ID)
    expect(DEFAULT_CATEGORIES.every(isDefaultCategory)).toBe(true)
  })

  it("ordering keeps the stored order with Other last", () => {
    const boat = { id: "custom-boat", name: "Boat", kind: "expense" as const, isRenamed: false }
    const tips = { id: "custom-tips", name: "Tips", kind: "income" as const, isRenamed: false }
    const ordered = orderedCategories([tips, ...[...DEFAULT_CATEGORIES].reverse(), boat])
    const expense = ordered.filter((c) => c.kind === "expense").map((c) => c.id)
    expect(expense[0]).toBe("loan-payments")
    expect(expense.slice(-2)).toEqual(["custom-boat", OTHER_EXPENSE_ID])
    expect(ordered.find((c) => c.kind === "income")).toEqual(tips)
    expect(ordered.filter((c) => c.kind === "income").at(-1)?.id).toBe(OTHER_INCOME_ID)
    expect(orderedCategories([...DEFAULT_CATEGORIES])).toEqual(DEFAULT_CATEGORIES)
  })

  it("creating trims the name and keeps icon and color", async () => {
    const store = new InMemoryStore(ZONE)
    const created = await saveCategory(store, { name: "  Boat  ", kind: "expense", icon: "sailboat", color: "blue" })
    expect(created.name).toBe("Boat")
    expect(created.id.startsWith("custom-")).toBe(true)
    expect(isDefaultCategory(created)).toBe(false)
    expect(created.icon).toBe("sailboat")
    expect(created.color).toBe("blue")
    expect(await store.fetchCategories()).toContainEqual(created)
  })

  it("creating rejects empty and duplicate names, and transfers", async () => {
    const store = new InMemoryStore(ZONE)
    await expectDomainError(() => saveCategory(store, { name: "   ", kind: "expense" }), "missingName")
    await expectDomainError(() => saveCategory(store, { name: "groceries", kind: "expense" }), "duplicateCategoryName", "groceries")
    await expectDomainError(() => saveCategory(store, { name: "Moves", kind: "transfer" }), "unsupportedTransactionKind")
  })

  it("the same name is fine for the other kind", async () => {
    expect((await saveCategory(new InMemoryStore(ZONE), { name: "Gifts", kind: "income" })).kind).toBe("income")
  })

  it("editing keeps the id and kind", async () => {
    const store = new InMemoryStore(ZONE)
    const created = await saveCategory(store, { name: "Boat", kind: "expense" })
    const renamed = await saveCategory(store, { id: created.id, name: "Sailing", kind: "income", icon: "sailboat" })
    expect(renamed.id).toBe(created.id)
    expect(renamed.kind).toBe("expense")
    expect((await store.fetchCategories()).filter((c) => c.id === created.id)).toEqual([renamed])
  })

  it("renaming a default stops translating it and the shipped name restores it", async () => {
    const store = new InMemoryStore(ZONE)
    const untouched = (await store.fetchCategories()).find((c) => c.id === "groceries")!
    expect(translatesById(untouched)).toBe(true)
    const renamed = await saveCategory(store, { id: "groceries", name: "Market", kind: "expense", icon: "basket", color: "green" })
    expect(renamed.isRenamed).toBe(true)
    expect(translatesById(renamed)).toBe(false)
    expect(isDefaultCategory(renamed)).toBe(true)
    const recolored = await saveCategory(store, { id: "restaurants", name: "Restaurants", kind: "expense", color: "pink" })
    expect(translatesById(recolored)).toBe(true)
    const back = await saveCategory(store, { id: "groceries", name: "Groceries", kind: "expense" })
    expect(translatesById(back)).toBe(true)
  })

  it("fallbacks can be renamed but not deleted", async () => {
    const store = new InMemoryStore(ZONE)
    for (const id of [OTHER_EXPENSE_ID, OTHER_INCOME_ID]) await expectDomainError(() => deleteCategory(store, id), "fallbackCategoryCantBeDeleted", id)
    const renamed = await saveCategory(store, { id: OTHER_EXPENSE_ID, name: "Misc", kind: "expense" })
    expect(renamed.isRenamed).toBe(true)
  })

  it("deleting a default moves its movements and it stays deleted", async () => {
    const expense = sampleData().transactions.find((t) => t.kind === "expense")!
    const store = new InMemoryStore(ZONE, { transactions: [{ ...expense, categoryId: "groceries" }] })
    await deleteCategory(store, "groceries")
    expect((await getCategories(store)).some((c) => c.id === "groceries")).toBe(false)
    expect((await store.fetchTransactions()).map((t) => t.categoryId)).toEqual([OTHER_EXPENSE_ID])
    await saveCategory(store, { name: "Groceries", kind: "expense" })
  })

  it("restoring brings back deleted defaults and undoes edits but keeps yours", async () => {
    const store = new InMemoryStore(ZONE)
    const boat = await saveCategory(store, { name: "Boat", kind: "expense" })
    await saveCategory(store, { id: "transport", name: "Car", kind: "expense", icon: "car", color: "blue" })
    await deleteCategory(store, "groceries")
    await reorderCategories(store, [boat.id])
    await restoreDefaultCategories(store)
    const expense = (await getCategories(store)).filter((c) => c.kind === "expense")
    expect(expense.filter(isDefaultCategory)).toEqual(DEFAULT_EXPENSE_CATEGORIES)
    expect(expense.slice(-2).map((c) => c.id)).toEqual([boat.id, OTHER_EXPENSE_ID])
  })

  it("reordering keeps the new order", async () => {
    const store = new InMemoryStore(ZONE)
    await reorderCategories(store, ["taxes", "groceries"])
    expect((await getCategories(store)).slice(0, 2).map((c) => c.id)).toEqual(["taxes", "groceries"])
  })

  it("deleting a created category moves its movements to Other", async () => {
    const boat = { id: "custom-boat", name: "Boat", kind: "expense" as const, isRenamed: false }
    const expense = sampleData().transactions.find((t) => t.kind === "expense")!
    const store = new InMemoryStore(ZONE, { transactions: [{ ...expense, categoryId: boat.id }], categories: [...DEFAULT_CATEGORIES, boat] })
    await deleteCategory(store, boat.id)
    expect(await store.fetchCategories()).not.toContainEqual(boat)
    expect((await store.fetchTransactions()).map((t) => t.categoryId)).toEqual([OTHER_EXPENSE_ID])
  })

  it("after a pull, records pointing at a deleted category move to Other of their kind", async () => {
    const sample = sampleData()
    const expense = sample.transactions.find((t) => t.kind === "expense")!
    const income = sample.transactions.find((t) => t.kind === "income")!
    const rule = { id: "rule-1", kind: "expense", categoryId: "custom-boat" } as RecurringRule
    const store = new InMemoryStore(ZONE, {
      transactions: [
        { ...expense, categoryId: "custom-boat" },
        { ...income, id: "income-1", categoryId: "custom-bonus" },
        { ...expense, id: "kept", categoryId: "groceries" },
        { ...expense, id: "unknown", categoryId: "custom-not-pulled-yet" },
      ],
      recurringRules: [rule],
    })
    expect(await reassignDeletedCategories(store, new Set(["custom-boat", "custom-bonus"]))).toBe(3)
    const byId = new Map((await store.fetchTransactions()).map((t) => [t.id, t.categoryId]))
    expect(byId).toEqual(new Map([[expense.id, OTHER_EXPENSE_ID], ["income-1", OTHER_INCOME_ID], ["kept", "groceries"], ["unknown", "custom-not-pulled-yet"]]))
    expect((await store.fetchRecurringRules())[0]!.categoryId).toBe(OTHER_EXPENSE_ID)
  })

  it("the repair after a pull writes nothing when nothing points at a deleted category", async () => {
    const expense = sampleData().transactions.find((t) => t.kind === "expense")!
    const store = new InMemoryStore(ZONE, { transactions: [{ ...expense, categoryId: "groceries" }] })
    let writes = 0
    const counted = Object.assign(Object.create(store) as InMemoryStore, {
      saveTransaction: async () => void writes++,
      saveRecurringRule: async () => void writes++,
      atomically: async () => void writes++,
    })
    expect(await reassignDeletedCategories(counted, new Set(["custom-boat"]))).toBe(0)
    expect(await reassignDeletedCategories(counted, new Set())).toBe(0)
    expect(writes).toBe(0)
  })

  it("listing returns the picker order", async () => {
    const boat = { id: "custom-boat", name: "Boat", kind: "expense" as const, isRenamed: false }
    const listed = await getCategories(new InMemoryStore(ZONE, { categories: [boat, ...DEFAULT_CATEGORIES] }))
    const expense = listed.filter((c) => c.kind === "expense").map((c) => c.id)
    expect(expense[0]).toBe(boat.id)
    expect(expense.at(-1)).toBe(OTHER_EXPENSE_ID)
  })
})

describe("One bank account, one card", () => {
  const debits = async (accountId: string, store: InMemoryStore) => (await store.fetchCards()).filter((c) => c.accountId === accountId && c.kind === "debit")

  it("data that follows the rule is left alone", async () => {
    const store = sampleStore()
    const before = await store.fetchCards()
    expect(await normalizeBankCards(store)).toBe(false)
    expect(await store.fetchCards()).toEqual(before)
  })

  it("extra debit cards merge into the most used one and keep their movements", async () => {
    const store = sampleStore()
    const spare = { id: crypto.randomUUID(), accountId: IDs.savings, kind: "debit" as const, network: "mastercard" as const, lastFour: "4444", color: "verde" as const }
    await store.saveCard(spare)
    const spent = transaction({ amount: "12", account: IDs.savings, card: spare.id })
    await store.saveTransaction(spent)
    const countBefore = (await store.fetchTransactions()).length
    expect(await normalizeBankCards(store)).toBe(true)
    expect((await debits(IDs.savings, store)).map((c) => c.id)).toEqual([IDs.savingsDebit])
    const movements = await store.fetchTransactions()
    expect(movements).toHaveLength(countBefore)
    expect(movements.find((t) => t.id === spent.id)?.cardId).toBe(IDs.savingsDebit)
  })

  it("the most used card wins even when added later", async () => {
    const account: Account = { id: crypto.randomUUID(), name: "Main", kind: "deposit", openingBalances: [{ amount: "0", currency: "USD" }], openingDate: new Date(0).toISOString() }
    const old = { id: crypto.randomUUID(), accountId: account.id, kind: "debit" as const, lastFour: "1111" }
    const used = { id: crypto.randomUUID(), accountId: account.id, kind: "debit" as const, lastFour: "2222" }
    const store = new InMemoryStore(ZONE, {
      accounts: [account],
      cards: [old, used, { id: crypto.randomUUID(), accountId: account.id, kind: "transfer" }],
      transactions: [
        transaction({ amount: "1", account: account.id, card: old.id }),
        transaction({ amount: "2", account: account.id, card: used.id }),
        transaction({ amount: "3", account: account.id, card: used.id }),
      ],
    })
    await normalizeBankCards(store)
    expect((await debits(account.id, store)).map((c) => c.id)).toEqual([used.id])
    expect((await store.fetchTransactions()).every((t) => t.cardId === used.id)).toBe(true)
  })

  it("on a tie the oldest card wins", () => {
    const accountId = crypto.randomUUID()
    const first = debitCardFor(accountId)
    const second = debitCardFor(accountId)
    expect(keeperOf([first, second], [])?.id).toBe(first.id)
  })

  it("an account without cards gets a debit card and a transfer channel", async () => {
    const account: Account = { id: crypto.randomUUID(), name: "Bare", kind: "deposit", openingBalances: [{ amount: "0", currency: "USD" }], openingDate: new Date(0).toISOString() }
    const store = new InMemoryStore(ZONE, { accounts: [account] })
    await normalizeBankCards(store)
    expect((await store.fetchCards()).map((c) => c.kind).sort()).toEqual(["debit", "transfer"])
    expect(await normalizeBankCards(store)).toBe(false)
  })

  it("a debit card without digits still exists", () => {
    const card = debitCardFor(crypto.randomUUID(), " ")
    expect(card.kind).toBe("debit")
    expect(card.lastFour).toBeUndefined()
  })

  it("deleting an account takes its cards and movements", async () => {
    const store = sampleStore()
    await deleteAccount(store, IDs.savings)
    expect((await store.fetchAccounts()).some((a) => a.id === IDs.savings)).toBe(false)
    expect((await store.fetchCards()).some((c) => c.accountId === IDs.savings)).toBe(false)
    expect((await store.fetchTransactions()).some((t) => scopeIncludes({ kind: "account", id: IDs.savings }, t))).toBe(false)
    expect((await store.fetchAccounts()).some((a) => a.id === IDs.payroll)).toBe(true)
  })

  it("deleting a missing account fails", async () => {
    const id = crypto.randomUUID()
    await expectDomainError(() => deleteAccount(sampleStore(), id), "notFound", id)
  })
})

describe("Card actions", () => {
  const card = async (id: string, store: InMemoryStore) => (await store.fetchCards()).find((c) => c.id === id)!

  it("repainting keeps everything else", async () => {
    const store = sampleStore()
    const before = await card(IDs.savingsDebit, store)
    await setCardColor(store, IDs.savingsDebit, "rojo")
    expect(await card(IDs.savingsDebit, store)).toEqual({ ...before, color: "rojo" })
  })

  it("a transfer channel has no art to repaint or details", async () => {
    await expectDomainError(() => setCardColor(sampleStore(), IDs.savingsTransfer, "verde"), "notFound", IDs.savingsTransfer)
    await expectDomainError(() => setCardDetails(sampleStore(), IDs.savingsTransfer, "X", undefined), "notFound")
  })

  it("card details are saved and keep the art", async () => {
    const store = sampleStore()
    const expiry = cardExpiry(9, 2028)
    await setCardDetails(store, IDs.visaHolder, "  Premia ", expiry)
    const after = await card(IDs.visaHolder, store)
    expect(after.productName).toBe("Premia")
    expect(after.expiry).toEqual(expiry)
    expect(after.color).toBe("grafito")
    expect(after.lastFour).toBe("9012")
    await setCardDetails(store, IDs.visaHolder, " ", undefined)
    const cleared = await card(IDs.visaHolder, store)
    expect(cleared.productName).toBeUndefined()
    expect(cleared.expiry).toBeUndefined()
  })

  it("renaming trims the name and refuses an empty one", async () => {
    const store = sampleStore()
    await renameAccount(store, IDs.savings, "  Travel  ")
    const account = (await store.fetchAccounts()).find((a) => a.id === IDs.savings)!
    expect(account.name).toBe("Travel")
    expect(account.bank).toBe("Bank One")
    await expectDomainError(() => renameAccount(store, IDs.savings, "   "), "missingName")
  })
})

describe("Transaction actions", () => {
  it("confirming a planned movement makes it count", async () => {
    const sample = sampleData()
    const store = sampleStore(sample)
    const planned = sample.transactions.find((t) => t.status === "planned")!
    await confirmPlannedTransaction(store, planned.id, referenceDate)
    const saved = (await store.fetchTransactions()).find((t) => t.id === planned.id)!
    expect(saved.status).toBe("confirmed")
    // A future planned date moves to the day it was confirmed; a past one keeps its date.
    expect(new Date(saved.date).getTime()).toBe(Math.min(new Date(planned.date).getTime(), referenceDate.getTime()))
    expect(saved.amount).toBe(planned.amount)
  })

  it("unconfirming puts a confirmed draft back as it was, balances included", async () => {
    const sample = sampleData()
    const store = sampleStore(sample)
    const planned = sample.transactions.find((t) => t.status === "planned" && new Date(t.date) > referenceDate)!
    const balances = async () => {
      const accounts = await store.fetchAccounts()
      const transactions = await store.fetchTransactions()
      return accounts.map((account) => balanceOf(account, transactions, ZONE).map((m) => `${m.amount.toString()} ${m.currency}`))
    }
    const before = await balances()
    await confirmPlannedTransaction(store, planned.id, referenceDate)
    expect(await balances()).not.toEqual(before)
    await unconfirmTransaction(store, planned.id, planned.date)
    expect((await store.fetchTransactions()).find((t) => t.id === planned.id)).toEqual(planned)
    expect(await balances()).toEqual(before)
  })

  it("unconfirming leaves a draft alone and fails for an unknown movement", async () => {
    const sample = sampleData()
    const store = sampleStore(sample)
    const planned = sample.transactions.find((t) => t.status === "planned")!
    await unconfirmTransaction(store, planned.id, referenceDate.toISOString())
    expect((await store.fetchTransactions()).find((t) => t.id === planned.id)).toEqual(planned)
    await expectDomainError(() => unconfirmTransaction(store, crypto.randomUUID(), planned.date), "notFound")
  })

  it("confirming an unknown movement fails", async () => {
    await expectDomainError(() => confirmPlannedTransaction(sampleStore(), crypto.randomUUID()), "notFound")
  })

  it("deleting removes the movement", async () => {
    const store = sampleStore()
    const first = (await store.fetchTransactions())[0]!
    await deleteTransaction(store, first.id)
    expect((await store.fetchTransactions()).some((t) => t.id === first.id)).toBe(false)
  })
})

describe("Create transaction", () => {
  const expense = (amount: string | number, currency: string, source: TransactionDraft["source"]): TransactionDraft => ({
    id: crypto.randomUUID(),
    kind: "expense",
    amount: d(amount),
    currency,
    categoryId: "restaurants",
    ...(source ? { source } : {}),
    description: "",
    date: referenceDate,
    note: "",
    isDraft: false,
  })

  it("the context knows balances and last used", async () => {
    const context = await getTransactionContext(sampleStore())
    expect(context.balances.get(IDs.cash)?.[0]?.currency).toBe("NIO")
    expect(lastUsedSource(context)).toBeDefined()
  })

  it("saving derives the account and stores the current rate", async () => {
    const store = sampleStore()
    const draft = { ...expense(879, "NIO", { type: "card", id: IDs.savingsDebit }), actualDebitedPrincipal: d("24.28"), description: "  Dinner  " }
    const saved = await saveTransaction(store, draft)
    expect(saved.transaction.accountId).toBe(IDs.savings)
    expect(saved.transaction.exchangeRate).toEqual(settingsRate(sampleData().settings.currencies))
    expect(saved.transaction.description).toBe("Dinner")
    expect(rounded(bankRate(saved.transaction)!, 2).toFixed(2)).toBe("36.20")
    expect(saved.account.id).toBe(IDs.savings)
    expect(saved.categoryMonthTotal?.currency).toBe("USD")
  })

  it("the new balance reflects the movement", async () => {
    const store = sampleStore()
    const before = (await getTransactionContext(store)).balances.get(IDs.cash)![0]!.amount
    const saved = await saveTransaction(store, expense(100, "NIO", { type: "account", id: IDs.cash }))
    expect(saved.transaction.status).toBe("confirmed")
    expect(saved.transaction.isShared).toBe(false)
    expect(saved.newBalances[0]!.amount.toFixed()).toBe(before.minus(100).toFixed())
  })

  it("a draft is saved without touching the balance", async () => {
    const store = sampleStore()
    const before = (await getTransactionContext(store)).balances.get(IDs.cash)![0]!.amount
    const saved = await saveTransaction(store, { ...expense(100, "NIO", { type: "account", id: IDs.cash }), isDraft: true })
    expect(saved.transaction.status).toBe("planned")
    expect(saved.newBalances[0]!.amount.toFixed()).toBe(before.toFixed())
  })

  it("an empty description falls back to the category", async () => {
    expect((await saveTransaction(sampleStore(), expense(879, "NIO", { type: "account", id: IDs.cash }))).transaction.description).toBe("Restaurants")
  })

  it("rejects zero amounts, foreign currencies and mismatched categories", async () => {
    const store = sampleStore()
    await expectDomainError(() => saveTransaction(store, expense(0, "NIO", { type: "account", id: IDs.cash })), "invalidAmount")
    await expectDomainError(() => saveTransaction(store, expense(879, "EUR", { type: "account", id: IDs.cash })), "invalidCurrency", "EUR")
    await expectDomainError(() => saveTransaction(store, { ...expense(879, "NIO", { type: "account", id: IDs.cash }), kind: "income" }), "categoryKindMismatch")
  })

  it("transfers need a different destination", async () => {
    const store = sampleStore()
    const transfer: TransactionDraft = { id: crypto.randomUUID(), kind: "transfer", amount: d(500), currency: "NIO", source: { type: "card", id: IDs.savingsTransfer }, description: "", date: referenceDate, note: "", isDraft: false }
    await expectDomainError(() => saveTransaction(store, transfer), "invalidTransferDestination")
    await expectDomainError(() => saveTransaction(store, { ...transfer, destinationAccountId: IDs.savings }), "invalidTransferDestination")
    const saved = await saveTransaction(store, { ...transfer, destinationAccountId: IDs.cash, categoryId: "restaurants" })
    expect(saved.transaction.categoryId).toBeUndefined()
    expect(saved.transaction.description).toBe("Transfer")
    expect(saved.categoryMonthTotal).toBeUndefined()
  })

  it("the principal currency ignores the real debit field", async () => {
    const saved = await saveTransaction(sampleStore(), { ...expense(20, "USD", { type: "card", id: IDs.savingsDebit }), actualDebitedPrincipal: d(21) })
    expect(saved.transaction.actualDebitedPrincipal).toBeUndefined()
  })

  it("editing replaces the movement and keeps the rate it was recorded with", async () => {
    const store = sampleStore()
    const original = (await store.fetchTransactions()).find((t) => t.description === "Lunch")!
    await store.saveSettings({ ...sampleData().settings, currencies: currencySettings("USD", "NIO", 40) })
    const count = (await store.fetchTransactions()).length
    const saved = await saveTransaction(store, { ...draftFrom(original), amount: d(300) })
    expect(saved.transaction.id).toBe(original.id)
    expect(saved.transaction.amount).toBe("300")
    expect(saved.transaction.exchangeRate).toEqual(original.exchangeRate)
    expect(await store.fetchTransactions()).toHaveLength(count)
  })
})

describe("Movement types and previews", () => {
  const account = (kind: Account["kind"]): Account => ({ id: crypto.randomUUID(), name: kind, kind, openingBalances: [{ amount: "0", currency: "USD" }], openingDate: referenceDate.toISOString() })

  it("types follow the accounts the person has", () => {
    const [bank, cash, card] = [account("deposit"), account("cash"), account("credit")]
    expect(availableMovementTypes([])).toEqual([])
    expect(availableMovementTypes([bank])).toEqual(["expense", "income"])
    expect(availableMovementTypes([bank, cash])).toEqual(["expense", "income", "transfer", "withdrawal"])
    expect(availableMovementTypes([cash, card])).toEqual(["expense", "income", "cardPayment"])
    expect(availableMovementTypes([bank, card])).toEqual(["expense", "income", "cardPayment"])
  })

  it("each transfer shape limits both ends", () => {
    const [bank, cash, card] = [account("deposit"), account("cash"), account("credit")]
    expect(allowsSource("withdrawal", bank)).toBe(true)
    expect(allowsSource("withdrawal", cash)).toBe(false)
    expect(allowsDestination("withdrawal", cash, bank.id)).toBe(true)
    expect(allowsDestination("withdrawal", card, bank.id)).toBe(false)
    expect(allowsDestination("cardPayment", card, cash.id)).toBe(true)
    expect(allowsDestination("transfer", card, bank.id)).toBe(false)
    expect(allowsDestination("transfer", bank, bank.id)).toBe(false)
    expect(movementKind("cardPayment")).toBe("transfer")
  })

  it("a saved transfer reopens as its shape", () => {
    const sample = sampleData()
    const withdrawal = sample.transactions.find((t) => t.description === "Cardless withdrawal")!
    expect(movementTypeOf(withdrawal, sample.accounts)).toBe("withdrawal")
  })

  it("the preview converts what arrives with the stored rate", async () => {
    const context = await getTransactionContext(sampleStore())
    const draft: TransactionDraft = { id: "x", kind: "transfer", amount: d(100), currency: "USD", source: { type: "card", id: IDs.savingsTransfer }, destinationAccountId: IDs.cash, description: "", date: referenceDate, note: "", isDraft: false }
    const preview = previewMovement(context, draft)!
    expect(preview.leaving?.amount.toFixed()).toBe("100")
    expect(preview.arriving?.amount.toFixed()).toBe("3662.43")
    expect(preview.arriving?.currency).toBe("NIO")
    expect(convertsCurrency(preview, "USD")).toBe(true)
    const savings = context.balances.get(IDs.savings)![0]!
    expect(preview.sourceAfter[0]!.amount.toFixed()).toBe(savings.amount.minus(100).toFixed())
  })

  it("the preview agrees with the balance after saving", async () => {
    const store = sampleStore()
    const context = await getTransactionContext(store)
    const draft: TransactionDraft = { id: crypto.randomUUID(), kind: "expense", amount: d(879), currency: "NIO", categoryId: "restaurants", source: { type: "card", id: IDs.savingsDebit }, description: "", date: referenceDate, actualDebitedPrincipal: d("24.28"), note: "", isDraft: false }
    const preview = previewMovement(context, draft)!
    const saved = await saveTransaction(store, draft)
    expect(preview.sourceAfter.map((m) => m.amount.toFixed())).toEqual(saved.newBalances.map((m) => m.amount.toFixed()))
    expect(preview.leaving?.amount.toFixed()).toBe("24.28")
  })
})

describe("Overviews", () => {
  it("home lists planned movements soonest first and recent confirmed ones newest first", async () => {
    const sample = sampleData()
    const home = homeOverview(await loadLedger(sampleStore(sample)), referenceDate)
    expect(home.planned).toHaveLength(4)
    expect(home.plannedSummary.count).toBe(4)
    expect(home.planned.map((t) => t.date)).toEqual(home.planned.map((t) => t.date).sort())
    expect(home.recent).toHaveLength(HOME_RECENT_COUNT)
    expect(home.recent.every((t) => t.status === "confirmed")).toBe(true)
    const newest = sample.transactions.filter((t) => t.status === "confirmed").map((t) => t.date).sort().at(-1)
    expect(home.recent[0]?.date).toBe(newest)
  })

  it("home reports the currencies its net worth leaves out", async () => {
    const ledger = await loadLedger(sampleStore())
    expect(homeOverview(ledger, referenceDate).netWorthExcluded).toEqual([])
    const [first, ...rest] = ledger.accounts
    const withEuro = { ...ledger, accounts: [{ ...first!, openingBalances: [...first!.openingBalances, { amount: "7", currency: "EUR" }] }, ...rest] }
    expect(homeOverview(withEuro, referenceDate).netWorthExcluded).toEqual(["EUR"])
  })

  it("home lists deposits before cash and leaves cards out", async () => {
    const home = homeOverview(await loadLedger(sampleStore()), referenceDate)
    expect(home.balances.map((line) => line.account.kind)).toEqual(["deposit", "deposit", "cash"])
    expect(home.accountCount).toBe(3)
    expect(home.cardCount).toBe(4)
    expect(home.month.month).toEqual(yearMonthContaining(referenceDate, ZONE))
  })

  it("net worth leaves out balances in a currency the settings no longer convert", async () => {
    const sample = sampleData()
    sample.settings.currencies = { principal: "USD", rate: "1" }
    const ledger = await loadLedger(sampleStore(sample))
    const home = homeOverview(ledger, referenceDate)
    const usd = ledger.accounts.flatMap((account) => balanceOf(account, ledger.transactions, ZONE)).filter((balance) => balance.currency === "USD")
    expect(home.netWorth.amount.toFixed()).toBe(usd.reduce((total, balance) => total.plus(balance.amount), d(0)).toFixed())
  })

  it("card debt is the cards' total in principal", async () => {
    const sample = sampleData()
    const home = homeOverview(await loadLedger(sampleStore(sample)), referenceDate)
    expect(home.cardDebt!.currency).toBe("USD")
    expect(home.cardDebt!.amount.lt(0)).toBe(true)
    const rate = settingsRate(sample.settings.currencies)
    const others = home.balances.reduce((total, line) => total.plus(convert(line.balance, rate, "USD").amount), d(0))
    expect(others.plus(home.cardDebt!.amount).toFixed()).toBe(home.netWorth.amount.toFixed())
  })

  it("accounts are grouped by kind; a dual card shows the second currency first", async () => {
    const sample = sampleData()
    const result = accountsOverview(sample.accounts, sample.cards, sample.transactions, sample.settings.currencies, ZONE)
    expect([result.creditCards.length, result.deposits.length, result.cash.length]).toEqual([2, 2, 1])
    const mastercard = result.creditCards.find((c) => c.account.id === IDs.mastercard)!
    expect(mastercard.balances.map((b) => b.currency)).toEqual(["NIO", "USD"])
    expect(mastercard.balances.every((b) => b.amount.lt(0))).toBe(true)
    expect(mastercard.holder?.lastFour).toBe("4321")
    expect(result.deposits.find((x) => x.account.id === IDs.savings)?.debitCard?.id).toBe(IDs.savingsDebit)
    // 7,500 opening + 1,200 withdrawal − 250 lunch − 60 bus.
    expect(result.cash[0]!.balance.amount.toFixed()).toBe("8390")
    expect(result.cash[0]!.principalEquivalent?.currency).toBe("USD")
    const all = sample.accounts.flatMap((a) => balanceOf(a, sample.transactions, ZONE))
    expect(result.netWorth.amount.toFixed()).toBe(netWorth(all, sample.settings.currencies).amount.toFixed())
  })

  it("a deposit with only a transfer channel has no card yet", () => {
    const account: Account = { id: crypto.randomUUID(), name: "Savings", bank: "Bank", kind: "deposit", openingBalances: [{ amount: "10", currency: "USD" }], openingDate: referenceDate.toISOString() }
    const result = accountsOverview([account], [{ id: crypto.randomUUID(), accountId: account.id, kind: "transfer" }], [], sampleData().settings.currencies, ZONE)
    expect(result.deposits[0]?.debitCard).toBeUndefined()
  })

  it("the debit card detail counts every movement that deleting removes", async () => {
    const detail = debitCardDetail(await loadLedger(sampleStore()), IDs.savings)
    expect(detail.card.id).toBe(IDs.savingsDebit)
    expect(detail.movementCount).toBe(8)
    expect(detail.latestTransactions.every((t) => t.status === "confirmed")).toBe(true)
  })

  it("credit card detail collects the card, its debt and this cycle", async () => {
    const sample = sampleData()
    const detail = creditCardDetail(await loadLedger(sampleStore(sample)), IDs.mastercard, referenceDate)
    expect(detail.holder?.id).toBe(IDs.mastercardHolder)
    expect(detail.balances).toHaveLength(2)
    expect(detail.totalDebt.amount.toFixed()).toBe(netWorth(detail.balances, sample.settings.currencies).amount.toFixed())
    expect(detail.available).toBeUndefined()
    expect(detail.cycleTransactions.every((t) => t.accountId === IDs.mastercard && new Date(t.date) >= detail.cycle.start && new Date(t.date) < detail.cycle.end)).toBe(true)
    expect(() => creditCardDetail(sample as never, IDs.savings)).toThrow()
  })

  it("terms set the limit and available credit", async () => {
    const store = sampleStore()
    await updateCreditTerms(store, IDs.mastercard, { amount: d(1000), currency: "USD" }, 20, 5)
    const detail = creditCardDetail(await loadLedger(store), IDs.mastercard, referenceDate)
    expect(detail.account.creditTerms?.cutoffDay).toBe(20)
    expect(detail.account.creditTerms?.debtMode).toBe("dual")
    expect(detail.available!.amount.toFixed()).toBe(d(1000).plus(detail.totalDebt.amount).toFixed())
    expect(detail.nextCutoff).toBeDefined()
  })
})

describe("Add card", () => {
  const draft = (debtMode: CreditCardDraft["debtMode"] = "dual"): CreditCardDraft => ({
    bank: "Bank Three",
    lastFour: "2468",
    network: "mastercard",
    color: "violeta",
    debtMode,
    principalDebt: d(10),
    secondDebt: d(250),
    limit: d(1500),
    cutoffDay: 28,
    dueDay: 15,
  })

  it("a credit card is its own account with negative debts", async () => {
    const store = sampleStore()
    const { account, holder } = await addCreditCard(store, draft())
    expect(account.kind).toBe("credit")
    expect(account.openingBalances).toEqual([
      { amount: "-10", currency: "USD" },
      { amount: "-250", currency: "NIO" },
    ])
    expect(account.creditTerms).toEqual({ debtMode: "dual", limit: { amount: "1500", currency: "USD" }, cutoffDay: 28, dueDay: 15 })
    expect(account.bank).toBe("Bank Three")
    expect(holder.kind).toBe("creditHolder")
    expect(await store.fetchCards()).toContainEqual(holder)
  })

  it("second-currency mode keeps one debt in the second currency", async () => {
    const { account } = await addCreditCard(sampleStore(), draft("second"))
    expect(account.openingBalances).toEqual([{ amount: "-10", currency: "NIO" }])
    expect(account.creditTerms?.limit).toEqual({ amount: "1500", currency: "NIO" })
  })

  it("invalid digits and amounts are rejected", async () => {
    await expectDomainError(() => addCreditCard(sampleStore(), { ...draft(), lastFour: "12" }), "invalidLastFour", "12")
    await expectDomainError(() => addCreditCard(sampleStore(), { ...draft(), principalDebt: d(-1) }), "invalidAmount")
  })

  it("a bank account is created with its one debit card", async () => {
    const store = sampleStore()
    const account = await addAccount(store, { kind: "deposit", name: "Checking", bank: "Bank Three", balance: { amount: d(50), currency: "USD" }, debitCard: { lastFour: "1357", network: "visa", color: "verde" } })
    const cards = (await store.fetchCards()).filter((c) => c.accountId === account.id)
    expect(cards.filter((c) => c.kind === "debit")).toHaveLength(1)
    expect(cards.find((c) => c.kind === "debit")?.lastFour).toBe("1357")
    expect(cards.some((c) => c.kind === "transfer")).toBe(true)
  })

  it("bad digits leave no account behind; cash has no card", async () => {
    const store = sampleStore()
    const before = (await store.fetchAccounts()).length
    await expectDomainError(() => addAccount(store, { kind: "deposit", name: "Checking", balance: { amount: d(0), currency: "USD" }, debitCard: { lastFour: "12" } }), "invalidLastFour")
    expect(await store.fetchAccounts()).toHaveLength(before)
    const cash = await addAccount(store, { kind: "cash", name: "Envelope", balance: { amount: d(10), currency: "NIO" } })
    expect((await store.fetchCards()).some((c) => c.accountId === cash.id)).toBe(false)
  })

  it("a wallet needs a name and no negative balance", async () => {
    await expectDomainError(() => addAccount(sampleStore(), { kind: "cash", name: "Envelope", balance: { amount: d(-1), currency: "NIO" } }), "invalidAmount")
    await expectDomainError(() => addAccount(sampleStore(), { kind: "cash", name: " ", balance: { amount: d(1), currency: "NIO" } }), "missingName")
  })
})

describe("Complete onboarding", () => {
  const currencies = currencySettings("USD", "NIO", "36.6243")
  const when = new Date(1_790_000_000_000)
  const account = (overrides: Partial<OnboardingAccountDraft>): OnboardingAccountDraft => ({ id: crypto.randomUUID(), kind: "bank", name: "Savings", currency: "USD", balance: d(0), secondBalance: d(0), ...overrides })
  const run = async (accounts: OnboardingAccountDraft[], overrides: Partial<Parameters<typeof completeOnboarding>[2]> = {}, cur = currencies) => {
    const store = new InMemoryStore(ZONE)
    const settings = await completeOnboarding(store, store, { currencies: cur, accounts, locksWithBiometrics: false, hasPasscode: false, hidesAmountsInAppSwitcher: true, backsUpToICloud: false, ...overrides }, when)
    return { store, settings }
  }

  it("saves finished settings", async () => {
    const { store, settings } = await run([])
    expect(settings.hasCompletedOnboarding).toBe(true)
    expect(settings.unlockMethod).toBe("disabled")
    expect(await store.loadSettings()).toEqual(settings)
  })

  it("saves the trimmed name, and a skipped one leaves none", async () => {
    expect((await run([], { preferredName: "  Steven \n" })).store.preferredName()).toBe("Steven")
    expect((await run([], { preferredName: "   " })).store.preferredName()).toBeUndefined()
  })

  it("a bank account gets debit and transfer methods", async () => {
    const { store } = await run([account({ bank: "Bank One", balance: d("9443.6"), lastFour: "1234" })])
    const saved = (await store.fetchAccounts())[0]!
    expect(saved.kind).toBe("deposit")
    expect(saved.openingBalances).toEqual([{ amount: "9443.6", currency: "USD" }])
    expect(saved.openingDate).toBe(when.toISOString())
    const cards = await store.fetchCards()
    expect(cards.map((c) => c.kind)).toEqual(["debit", "transfer"])
    expect(cards[0]?.lastFour).toBe("1234")
  })

  it("credit card debt starts negative in both currencies", async () => {
    const { store } = await run([account({ kind: "credit", name: "Mastercard", balance: d("16.79"), secondBalance: d("197.02"), lastFour: "4321", network: "mastercard", debtMode: "dual" })])
    const saved = (await store.fetchAccounts())[0]!
    expect(saved.openingBalances).toEqual([
      { amount: "-16.79", currency: "USD" },
      { amount: "-197.02", currency: "NIO" },
    ])
    expect(saved.creditTerms?.debtMode).toBe("dual")
    expect((await store.fetchCards()).map((c) => c.kind)).toEqual(["creditHolder"])
  })

  it("a single currency forces the principal debt mode", async () => {
    const { store } = await run([account({ kind: "credit", name: "Visa", balance: d(10), debtMode: "dual" })], {}, currencySettings())
    const saved = (await store.fetchAccounts())[0]!
    expect(saved.openingBalances).toEqual([{ amount: "-10", currency: "USD" }])
    expect(saved.creditTerms?.debtMode).toBe("principal")
  })

  it("cash has no cards; negative balances and bad digits are rejected", async () => {
    const { store } = await run([account({ kind: "cash", name: "Cash", currency: "NIO", balance: d(560) })])
    expect((await store.fetchAccounts())[0]?.kind).toBe("cash")
    expect(await store.fetchCards()).toEqual([])
    expect(() => makeOnboardingAccount(account({ kind: "cash", balance: d(-1) }), currencies, when)).toThrow(DomainError)
    expect(() => makeOnboardingAccount(account({ lastFour: "12" }), currencies, when)).toThrow(DomainError)
  })

  it("the display name joins bank and name", () => {
    expect(onboardingDisplayName({ name: "Savings", bank: "Bank One" })).toBe("Bank One Savings")
    expect(onboardingDisplayName({ name: "Cash" })).toBe("Cash")
  })
})
