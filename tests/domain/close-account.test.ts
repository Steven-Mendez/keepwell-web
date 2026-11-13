import { describe, expect, it } from "vitest"

import {
  accountsOverview,
  balanceOf,
  closeAccount,
  closingPlan,
  confirmPlannedTransaction,
  DomainError,
  draftFrom,
  getTransactionContext,
  homeOverview,
  ledgerNotifications,
  loadLedger,
  monthlySummary,
  netWorth,
  netWorthHistory,
  openAccounts,
  paymentMethodGroups,
  pickerContext,
  reopenAccount,
  saveTransaction,
  scopeOptions,
  yearMonthContaining,
  type InMemoryStore,
} from "@/lib/domain"
import type { Account, RecurringRule, Transaction } from "@/lib/schema"

import { d, date, IDs, referenceDate, sampleData, sampleStore, ZONE } from "./fixtures"

async function expectDomainError(work: () => Promise<unknown>, code: DomainError["code"]) {
  const error = await work().then(
    () => undefined,
    (thrown: unknown) => thrown,
  )
  expect(error).toBeInstanceOf(DomainError)
  expect((error as DomainError).code).toBe(code)
}

const now = referenceDate

const account = async (store: InMemoryStore, id: string) => (await store.fetchAccounts()).find((candidate) => candidate.id === id) as Account

const balances = async (store: InMemoryStore, id: string) => balanceOf(await account(store, id), await store.fetchTransactions(), ZONE)

const rule = (overrides: Partial<RecurringRule>): RecurringRule => ({
  id: crypto.randomUUID(),
  name: "Rent",
  kind: "expense",
  categoryId: "housing",
  amount: "300",
  currency: "USD",
  accountId: IDs.savings,
  frequency: "monthly",
  interval: 1,
  startDate: date(2026, 9, 1).toISOString(),
  nextDate: date(2026, 11, 1).toISOString(),
  isSubscription: false,
  autoConfirm: false,
  isPaused: false,
  ...overrides,
})

const emptyWallet: Account = { id: "00000000-0000-0000-0000-00000000a0e0", name: "Old wallet", kind: "cash", openingBalances: [{ amount: "0", currency: "USD" }], openingDate: date(2026, 8, 1).toISOString() }

describe("closeAccount", () => {
  it("closes an empty account at once, and closing it again does nothing", async () => {
    const sample = sampleData()
    const store = sampleStore({ ...sample, accounts: [...sample.accounts, emptyWallet] })
    const first = await closeAccount(store, emptyWallet.id, {}, now)
    expect(first.transfers).toEqual([])
    expect(first.account.closedAt).toBe(now.toISOString())
    const again = await closeAccount(store, emptyWallet.id, {}, new Date(now.getTime() + 86_400_000))
    expect(again.account.closedAt).toBe(now.toISOString())
    expect((await account(store, emptyWallet.id)).closedAt).toBe(now.toISOString())
  })

  it("refuses an account with money left and no destination, changing nothing", async () => {
    const store = sampleStore()
    const before = await store.fetchTransactions()
    await expectDomainError(() => closeAccount(store, IDs.savings, {}, now), "accountNotEmpty")
    expect((await account(store, IDs.savings)).closedAt).toBeUndefined()
    expect(await store.fetchTransactions()).toEqual(before)
  })

  it("only moves the balance to another open account that holds its currency", async () => {
    const store = sampleStore()
    // The wallet holds córdobas only; savings is in dollars.
    await expectDomainError(() => closeAccount(store, IDs.savings, { transferTo: IDs.cash }, now), "invalidTransferDestination")
    await expectDomainError(() => closeAccount(store, IDs.savings, { transferTo: IDs.savings }, now), "invalidTransferDestination")
    await closeAccount(store, IDs.payroll, { transferTo: IDs.savings }, now)
    await expectDomainError(() => closeAccount(store, IDs.savings, { transferTo: IDs.payroll }, now), "invalidTransferDestination")
  })

  it("moves the balance out and keeps every total and summary as it was", async () => {
    const store = sampleStore()
    const ledger = await loadLedger(store)
    const settings = ledger.settings.currencies
    const month = yearMonthContaining(now, ZONE)
    const totalOf = (accounts: readonly Account[], transactions: readonly Transaction[]) =>
      netWorth(
        accounts.flatMap((candidate) => balanceOf(candidate, transactions, ZONE)),
        settings,
      )
    const beforeTotal = totalOf(ledger.accounts, ledger.transactions)
    const beforeHistory = netWorthHistory(ledger.accounts, ledger.transactions, settings, ZONE, now)
    const beforeSummary = monthlySummary(month, ledger.transactions, "USD", ZONE)
    const saved = await balances(store, IDs.savings)

    const { account: closed, transfers } = await closeAccount(store, IDs.savings, { transferTo: IDs.payroll, description: "Transferencia de cierre" }, now)

    expect(closed.closedAt).toBe(now.toISOString())
    expect(transfers).toHaveLength(1)
    expect(transfers[0]).toMatchObject({ kind: "transfer", status: "confirmed", accountId: IDs.savings, cardId: IDs.savingsTransfer, destinationAccountId: IDs.payroll, currency: "USD", description: "Transferencia de cierre" })
    expect(d(transfers[0]!.amount).eq(saved[0]!.amount)).toBe(true)
    expect((await balances(store, IDs.savings)).every((balance) => balance.amount.isZero())).toBe(true)

    const after = await loadLedger(store)
    expect(totalOf(after.accounts, after.transactions)).toEqual(beforeTotal)
    expect(netWorthHistory(after.accounts, after.transactions, settings, ZONE, now)).toEqual(beforeHistory)
    expect(monthlySummary(month, after.transactions, "USD", ZONE)).toEqual(beforeSummary)
    expect(openAccounts(after.accounts).map((candidate) => candidate.id)).not.toContain(IDs.savings)
    expect(after.accounts.map((candidate) => candidate.id)).toContain(IDs.savings)
  })

  it("pays off a dual card with one transfer per currency, into the card", async () => {
    const sample = sampleData()
    const dual: Account = { id: "00000000-0000-0000-0000-00000000a0d0", name: "Dual savings", kind: "deposit", openingBalances: [{ amount: "5000", currency: "USD" }, { amount: "90000", currency: "NIO" }], openingDate: sample.accounts[0]!.openingDate }
    const store = sampleStore({ ...sample, accounts: [...sample.accounts, dual] })
    const plan = closingPlan(await loadLedger(store), IDs.mastercard)
    expect(plan.balances.map((balance) => balance.currency).sort()).toEqual(["NIO", "USD"])
    expect(plan.destinations.map((candidate) => candidate.id)).toEqual([dual.id])

    const { transfers } = await closeAccount(store, IDs.mastercard, { transferTo: dual.id }, now)

    expect(transfers.map((transfer) => [transfer.accountId, transfer.destinationAccountId, transfer.currency]).sort()).toEqual([
      [dual.id, IDs.mastercard, "NIO"],
      [dual.id, IDs.mastercard, "USD"],
    ])
    expect((await balances(store, IDs.mastercard)).every((balance) => balance.amount.isZero())).toBe(true)
  })

  it("pauses the rules from or to the account and deletes their drafts", async () => {
    const sample = sampleData()
    const store = sampleStore({ ...sample, accounts: [...sample.accounts, emptyWallet] })
    const rent = rule({ accountId: emptyWallet.id })
    const into = rule({ kind: "transfer", categoryId: undefined, accountId: IDs.savings, cardId: IDs.savingsTransfer, destinationAccountId: emptyWallet.id } as Partial<RecurringRule>)
    const other = rule({})
    for (const entry of [rent, into, other]) await store.saveRecurringRule(entry)
    const draft = (ruleId: string, accountId: string): Transaction => ({
      id: crypto.randomUUID(),
      date: date(2026, 10, 28).toISOString(),
      status: "planned",
      description: "Rent",
      kind: "expense",
      categoryId: "housing",
      amount: "300",
      currency: "USD",
      accountId,
      exchangeRate: { principal: "USD", second: "NIO", rate: "36.6243" },
      isShared: false,
      recurringId: ruleId,
    })
    const ownDraft = draft(rent.id, emptyWallet.id)
    const otherDraft = draft(other.id, IDs.savings)
    await store.saveTransaction(ownDraft)
    await store.saveTransaction(otherDraft)

    const plan = closingPlan(await loadLedger(store), emptyWallet.id)
    expect(plan.rulesToPause.map((entry) => entry.id).sort()).toEqual([rent.id, into.id].sort())
    expect(plan.draftsToDelete.map((entry) => entry.id)).toEqual([ownDraft.id])

    await closeAccount(store, emptyWallet.id, {}, now)

    const rules = await store.fetchRecurringRules()
    expect(rules.find((entry) => entry.id === rent.id)?.isPaused).toBe(true)
    expect(rules.find((entry) => entry.id === into.id)?.isPaused).toBe(true)
    expect(rules.find((entry) => entry.id === other.id)?.isPaused).toBe(false)
    const ids = (await store.fetchTransactions()).map((entry) => entry.id)
    expect(ids).not.toContain(ownDraft.id)
    expect(ids).toContain(otherDraft.id)
  })

  it("reopening clears the closing and keeps everything else", async () => {
    const store = sampleStore()
    await closeAccount(store, IDs.savings, { transferTo: IDs.payroll }, now)
    const transactions = await store.fetchTransactions()
    const reopened = await reopenAccount(store, IDs.savings)
    expect(reopened.closedAt).toBeUndefined()
    expect("closedAt" in (await account(store, IDs.savings))).toBe(false)
    expect(await store.fetchTransactions()).toEqual(transactions)
    expect((await balances(store, IDs.savings)).every((balance) => balance.amount.isZero())).toBe(true)
  })
})

describe("a closed account's movements", () => {
  async function closedSavings() {
    const store = sampleStore()
    await closeAccount(store, IDs.savings, { transferTo: IDs.payroll }, now)
    return store
  }

  const movieId = "00000000-0000-0000-0000-000000000011"

  it("refuses a new movement in it or into it", async () => {
    const store = await closedSavings()
    const base = { id: crypto.randomUUID(), amount: d(5), currency: "USD", description: "Coffee", date: now, note: "", isDraft: false }
    await expectDomainError(() => saveTransaction(store, { ...base, kind: "expense", categoryId: "restaurants", source: { type: "card", id: IDs.savingsDebit } }), "accountClosed")
    await expectDomainError(() => saveTransaction(store, { ...base, kind: "transfer", source: { type: "card", id: IDs.payrollTransfer }, destinationAccountId: IDs.savings }), "accountClosed")
  })

  it("lets an old movement change its category, description and note, not what it moves", async () => {
    const store = await closedSavings()
    const movie = (await store.fetchTransactions()).find((entry) => entry.id === movieId)!
    await saveTransaction(store, { ...draftFrom(movie), categoryId: "subscriptions", description: "Cinema", note: "with Ana" })
    const edited = (await store.fetchTransactions()).find((entry) => entry.id === movieId)!
    expect(edited).toMatchObject({ categoryId: "subscriptions", description: "Cinema", note: "with Ana", amount: movie.amount })
    await expectDomainError(() => saveTransaction(store, { ...draftFrom(movie), amount: d(1) }), "accountClosed")
    await expectDomainError(() => saveTransaction(store, { ...draftFrom(movie), date: date(2026, 10, 1) }), "accountClosed")
    await expectDomainError(() => saveTransaction(store, { ...draftFrom(movie), source: { type: "card", id: IDs.payrollDebit } }), "accountClosed")
  })

  it("won't move a movement of an open account into it, nor confirm a draft in it", async () => {
    const store = await closedSavings()
    const internet = (await store.fetchTransactions()).find((entry) => entry.description === "Home internet")!
    await expectDomainError(() => saveTransaction(store, { ...draftFrom(internet), source: { type: "card", id: IDs.savingsDebit } }), "accountClosed")
    const phone = (await store.fetchTransactions()).find((entry) => entry.description === "Phone")!
    await expectDomainError(() => confirmPlannedTransaction(store, phone.id, now), "accountClosed")
  })
})

describe("notifications of a closed card", () => {
  it("has no payment or cutoff reminder", async () => {
    const store = sampleStore()
    const visa = await account(store, IDs.visa)
    // Visa is due on the 15th and closes on the 28th.
    const ledger = await loadLedger(store)
    const kinds = (accounts: Account[], at: Date) =>
      ledgerNotifications({ ...ledger, accounts }, at)
        .filter((entry) => entry.kind === "payment" || entry.kind === "cutoff")
        .map((entry) => entry.kind)
    expect(kinds(ledger.accounts, new Date(2026, 10, 13, 12))).toContain("payment")
    expect(kinds(ledger.accounts, new Date(2026, 9, 28, 12))).toContain("cutoff")
    const closed = ledger.accounts.map((entry) => (entry.id === visa.id ? { ...entry, closedAt: now.toISOString() } : entry))
    expect(kinds(closed, new Date(2026, 10, 13, 12))).toEqual([])
    expect(kinds(closed, new Date(2026, 9, 28, 12))).toEqual([])
  })
})

describe("where a closed account shows", () => {
  async function ledgerWithClosedSavings() {
    const store = sampleStore()
    await closeAccount(store, IDs.savings, { transferTo: IDs.payroll }, now)
    return loadLedger(store)
  }

  it("leaves the Accounts lists for its own section, and keeps counting in net worth", async () => {
    const ledger = await ledgerWithClosedSavings()
    const settings = ledger.settings.currencies
    const overview = accountsOverview(ledger.accounts, ledger.cards, ledger.transactions, settings, ZONE)
    expect(overview.deposits.map((entry) => entry.account.id)).toEqual([IDs.payroll])
    expect(overview.closed.map((entry) => entry.account.id)).toEqual([IDs.savings])
    const open = accountsOverview(openAccounts(ledger.accounts), ledger.cards, ledger.transactions, settings, ZONE)
    // Its balance is zero, so leaving it out of the total changes nothing, and keeping it in neither.
    expect(overview.netWorth).toEqual(open.netWorth)
  })

  it("leaves Home's accounts and counts, not its totals", async () => {
    const before = homeOverview(await loadLedger(sampleStore()), now)
    const after = homeOverview(await ledgerWithClosedSavings(), now)
    expect(after.balances.map((line) => line.account.id)).not.toContain(IDs.savings)
    expect(after.accountCount).toBe(before.accountCount - 1)
    expect(after.cardCount).toBe(before.cardCount - 1)
    expect(after.netWorth).toEqual(before.netWorth)
  })

  it("comes last in the movements filter, out of payment methods and pickers but for the edited movement", async () => {
    const ledger = await ledgerWithClosedSavings()
    expect(scopeOptions(ledger.accounts, ledger.cards).at(-1)?.account.id).toBe(IDs.savings)
    expect(paymentMethodGroups(ledger.accounts, ledger.cards).map((group) => group.account.id)).not.toContain(IDs.savings)
    const context = await getTransactionContext(sampleStoreFrom(ledger))
    expect(pickerContext(context).accounts.map((entry) => entry.id)).not.toContain(IDs.savings)
    expect(pickerContext(context).cards.map((card) => card.accountId)).not.toContain(IDs.savings)
    expect(pickerContext(context, [IDs.savings]).accounts.map((entry) => entry.id)).toContain(IDs.savings)
  })
})

function sampleStoreFrom(ledger: Awaited<ReturnType<typeof loadLedger>>) {
  return sampleStore({ settings: ledger.settings, accounts: ledger.accounts, cards: ledger.cards, transactions: ledger.transactions })
}
