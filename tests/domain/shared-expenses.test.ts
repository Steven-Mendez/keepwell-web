// Shared expenses: a split movement counts only the person's part as spending, in every spending view
// (summary, averages, pace, trends, budgets, forecast, the receipt's category total), never in
// balances; a repayment deposited into an account changes the balance but is not income.
import { describe, expect, it } from "vitest"

import {
  averageMonthlyTotal,
  averageUsualSpending,
  balanceOf,
  budgetStatuses,
  debtLinks,
  debtShareIn,
  deleteDebtRepayment,
  homeOverview,
  isReimbursement,
  isSplit,
  monthlySummary,
  monthlyTotals,
  repaymentCategoryId,
  repaymentDescription,
  repayPersonalDebt,
  savedTransactionOf,
  spendingAmount,
  spendingAmountIn,
  spendingPace,
  splitTransaction,
  summaryReport,
  trendReport,
  yearTotals,
  type DomainError,
} from "@/lib/domain"
import { exportCsv } from "@/lib/domain/csv"
import { DEFAULT_CATEGORIES, OTHER_INCOME_ID, type Account, type PersonalDebt, type Transaction } from "@/lib/schema"

import { d, date, IDs, ledgerWith, referenceDate, sampleStore, single, transaction, usdNio, ZONE } from "./fixtures"

const october = { year: 2026, month: 10 }

function owed(movement: Transaction, amount: string, overrides: Partial<PersonalDebt> = {}): PersonalDebt {
  return {
    id: crypto.randomUUID(),
    person: "Ana",
    direction: "theyOweMe",
    amount: { amount, currency: movement.currency },
    date: movement.date,
    repayments: [],
    transactionId: movement.id,
    ...overrides,
  }
}

const dinner = transaction({ amount: "900", currency: "NIO", rate: single("NIO"), category: "restaurants" })

describe("spendingAmount", () => {
  it("takes the others' shares out of a partly split movement", () => {
    const debts = [owed(dinner, "300"), owed(dinner, "200", { person: "Luis" })]
    expect(spendingAmount(dinner, debts).toFixed()).toBe("400")
    expect(isSplit(dinner, debts)).toBe(true)
  })

  it("is zero, never below, for a movement others paid for entirely", () => {
    expect(spendingAmount(dinner, [owed(dinner, "450"), owed(dinner, "450")]).toFixed()).toBe("0")
    // A share larger than the movement (edited down since) still leaves zero.
    expect(spendingAmount(dinner, [owed(dinner, "1000")]).toFixed()).toBe("0")
  })

  it("counts a settled share too: it was never the person's spending", () => {
    const settled = owed(dinner, "300", { repayments: [{ amount: "300", date: dinner.date }], settledAt: dinner.date })
    expect(spendingAmount(dinner, [settled]).toFixed()).toBe("600")
  })

  it("ignores debts that aren't 'they owe me' or that name another movement", () => {
    const other = transaction({ amount: "50", currency: "NIO", rate: single("NIO") })
    expect(spendingAmount(dinner, [owed(dinner, "300", { direction: "iOwe" }), owed(other, "10")]).toFixed()).toBe("900")
    expect(isSplit(dinner, [owed(other, "10")])).toBe(false)
    expect(isSplit(dinner, [])).toBe(false)
  })

  it("only an expense has shares", () => {
    const income = { ...dinner, kind: "income" as const, categoryId: "salary" }
    expect(spendingAmount(income, [owed(income, "300")]).toFixed()).toBe("900")
    expect(isSplit(income, [owed(income, "300")])).toBe(false)
  })

  it("converts a share in the movement's currency at the movement's own rate, real charge included", () => {
    // NIO 3662.43 at 36.6243 is USD 100; Ana owes NIO 1220.81, a third.
    const lunch = transaction({ amount: "3662.43", currency: "NIO", rate: usdNio })
    const debts = [owed(lunch, "1220.81")]
    expect(spendingAmountIn(lunch, debts, "USD")!.toDecimalPlaces(2).toFixed()).toBe("66.67")
    expect(spendingAmountIn(lunch, debts, "NIO")!.toFixed()).toBe("2441.62")
    // The bank charged USD 102: she owes a third of what it really cost.
    const charged = { ...lunch, actualDebitedPrincipal: "102" }
    expect(spendingAmount(charged, debts).toDecimalPlaces(2).toFixed()).toBe("68")
  })

  it("converts a share in the movement's other currency with the stored rate", () => {
    const lunch = transaction({ amount: "100", currency: "USD", rate: usdNio })
    const share = owed(lunch, "1831.215", { amount: { amount: "1831.215", currency: "NIO" } })
    expect(debtShareIn(share, lunch, "USD")!.toFixed()).toBe("50")
    expect(spendingAmount(lunch, [share]).toFixed()).toBe("50")
  })

  it("ignores a share the stored rate can't convert, and leaves an unconvertible movement out", () => {
    const lunch = transaction({ amount: "100", currency: "USD", rate: usdNio })
    const euros = owed(lunch, "20", { amount: { amount: "20", currency: "EUR" } })
    expect(debtShareIn(euros, lunch, "USD")).toBeUndefined()
    expect(spendingAmount(lunch, [euros]).toFixed()).toBe("100")
    // After the main currency became EUR, the movement itself can't reach it.
    expect(spendingAmountIn(lunch, [owed(lunch, "30")], "EUR")).toBeUndefined()
  })
})

describe("spending views", () => {
  const groceries = transaction({ amount: "100", category: "groceries", date: date(2026, 10, 3) })
  const shared = transaction({ amount: "90", category: "restaurants", date: date(2026, 10, 5) })
  const paidByOthers = transaction({ amount: "40", category: "leisure", date: date(2026, 10, 6) })
  const salary = transaction({ kind: "income", amount: "1000", category: "salary", date: date(2026, 10, 1) })
  const deposit = transaction({ kind: "income", amount: "30", category: "refunds", date: date(2026, 10, 7) })
  const ana = owed(shared, "30", { repayments: [{ id: crypto.randomUUID(), amount: "30", date: deposit.date, transactionId: deposit.id }], settledAt: deposit.date })
  const luis = owed(shared, "30", { person: "Luis" })
  const all = owed(paidByOthers, "40", { person: "Eva" })
  const movements = [groceries, shared, paidByOthers, salary, deposit]
  const debts = [ana, luis, all]

  it("the monthly summary counts the person's part and leaves repayment deposits out of income", () => {
    const summary = monthlySummary(october, movements, "USD", ZONE, debts)
    expect(summary.expense.toFixed()).toBe("130")
    expect(summary.income.toFixed()).toBe("1000")
    expect(summary.categories.map((entry) => [entry.categoryId, entry.amount.toFixed()])).toEqual([
      ["groceries", "100"],
      ["restaurants", "30"],
    ])
    expect(summary.incomeCategories.map((entry) => entry.categoryId)).toEqual(["salary"])
    expect(summary.excluded).toEqual([])
    // Without debts, as before.
    const gross = monthlySummary(october, movements, "USD", ZONE)
    expect([gross.expense.toFixed(), gross.income.toFixed()]).toEqual(["230", "1030"])
  })

  it("accepts the links built once", () => {
    expect(monthlySummary(october, movements, "USD", ZONE, debtLinks(debts)).expense.toFixed()).toBe("130")
    expect(isReimbursement(deposit, debts)).toBe(true)
    expect(isReimbursement(salary, debts)).toBe(false)
  })

  it("monthly totals and averages read the same way", () => {
    expect(monthlyTotals("expense", october, 1, movements, "USD", ZONE, debts)[0]!.total.toFixed()).toBe("130")
    expect(monthlyTotals("income", october, 1, movements, "USD", ZONE, debts)[0]!.total.toFixed()).toBe("1000")
    expect(averageMonthlyTotal("expense", movements, "USD", ZONE, debts)!.toFixed()).toBe("130")
  })

  it("an unconvertible movement is still left out and reported, split or not", () => {
    const euros = transaction({ amount: "50", currency: "EUR", rate: single("EUR"), date: date(2026, 10, 8) })
    const summary = monthlySummary(october, [...movements, euros], "USD", ZONE, [...debts, owed(euros, "10")])
    expect(summary.expense.toFixed()).toBe("130")
    expect(summary.excluded).toEqual([{ currency: "EUR", count: 1 }])
  })

  it("the spending pace and the summary report use the person's part", () => {
    const now = date(2026, 10, 20)
    expect(spendingPace(october, movements, "USD", now, ZONE, debts).current.at(-1)!.cumulative.toFixed()).toBe("130")
    const report = summaryReport(movements, "USD", ZONE, now, 1, debts)
    expect(report.months[0]!.expense.toFixed()).toBe("130")
    expect(report.averageExpense!.toFixed()).toBe("130")
    expect(report.averageIncome!.toFixed()).toBe("1000")
    expect(report.paces[0]!.current.at(-1)!.cumulative.toFixed()).toBe("130")
  })

  it("trends and year totals use the person's part", () => {
    const now = date(2026, 10, 20)
    const report = trendReport(movements, "USD", { start: october, end: october }, ZONE, now, debts)
    expect(report.cashFlow.expense.toFixed()).toBe("130")
    expect(report.cashFlow.income.toFixed()).toBe("1000")
    expect(yearTotals(movements, "USD", ZONE, now, debts)[0]!.cashFlow.expense.toFixed()).toBe("130")
  })

  it("budgets compare the person's part", () => {
    const categories = DEFAULT_CATEGORIES.map((category) =>
      category.id === "restaurants" ? { ...category, monthlyBudget: { amount: "50", currency: "USD" } } : category,
    )
    const [status] = budgetStatuses(monthlySummary(october, movements, "USD", ZONE, debts), categories)
    expect([status!.categoryId, status!.spent.toFixed(), status!.level]).toEqual(["restaurants", "30", "onTrack"])
  })

  it("the forecast's usual spending averages the person's part", () => {
    const november = { year: 2026, month: 11 }
    expect(averageUsualSpending(movements, november, "USD", ZONE, debts).toFixed()).toBe("130")
    expect(averageUsualSpending(movements, november, "USD", ZONE).toFixed()).toBe("230")
  })

  it("balances still move by the whole movement and the deposit", () => {
    const account: Account = { id: crypto.randomUUID(), name: "Bank", kind: "deposit", openingBalances: [{ amount: "0", currency: "USD" }], openingDate: date(2026, 9, 1).toISOString() }
    const own = movements.map((movement) => ({ ...movement, accountId: account.id }))
    expect(balanceOf(account, own, ZONE)[0]!.amount.toFixed()).toBe(String(1000 + 30 - 100 - 90 - 40))
  })

  it("the receipt's category total is the person's part", () => {
    const account: Account = { id: shared.accountId, name: "Bank", kind: "deposit", openingBalances: [{ amount: "0", currency: "USD" }], openingDate: date(2026, 9, 1).toISOString() }
    const saved = savedTransactionOf(shared, [account], movements, "USD", ZONE, debts)
    expect(saved.categoryMonthTotal!.amount.toFixed()).toBe("30")
  })

  it("Home's month reads the ledger's debts", () => {
    const overview = homeOverview(ledgerWith({ transactions: movements, personalDebts: debts }), date(2026, 10, 20))
    expect(overview.month.expense.toFixed()).toBe("130")
    expect(overview.month.income.toFixed()).toBe("1000")
  })

  it("the CSV marks a split expense shared", () => {
    const rows = exportCsv([shared, groceries], [], [], DEFAULT_CATEGORIES, ZONE, debts).trim().split("\n").slice(1)
    const sharedColumn = (row: string) => row.split(",")[12]
    expect(rows.map(sharedColumn)).toEqual(["no", "yes"])
  })
})

describe("repayments deposited into an account", () => {
  async function splitLunch() {
    const store = sampleStore()
    const lunch = store.transactions.find((movement) => movement.description === "Lunch")!
    const [debt] = await splitTransaction(store, lunch.id, [{ person: "Ana", amount: d(100) }])
    return { store, lunch, debt: debt! }
  }

  it("records an income in the account, linked, filed under Refunds, and keeps it out of income", async () => {
    const { store, lunch, debt } = await splitLunch()
    const before = store.transactions.length
    const updated = await repayPersonalDebt(store, debt.id, "100", referenceDate, { accountId: IDs.cash })
    const repayment = updated.repayments[0]!
    expect(updated.settledAt).toBe(referenceDate.toISOString())
    expect(store.transactions).toHaveLength(before + 1)
    const movement = store.transactions.find((candidate) => candidate.id === repayment.transactionId)!
    expect(movement).toMatchObject({
      kind: "income",
      status: "confirmed",
      amount: "100",
      currency: "NIO",
      accountId: IDs.cash,
      categoryId: "refunds",
      description: `Ana · ${lunch.description}`,
    })
    const debts = await store.fetchPersonalDebts()
    expect(isReimbursement(movement, debts)).toBe(true)
    const summary = monthlySummary(october, store.transactions, "USD", ZONE, debts)
    const gross = monthlySummary(october, store.transactions, "USD", ZONE)
    expect(gross.income.minus(summary.income).toDecimalPlaces(10).toFixed()).toBe(d(100).div("36.6243").toDecimalPlaces(10).toFixed())
  })

  it("without a deposit only records the repayment, as before", async () => {
    const { store, debt } = await splitLunch()
    const before = store.transactions.length
    const updated = await repayPersonalDebt(store, debt.id, "40", referenceDate)
    expect(updated.repayments[0]!.transactionId).toBeUndefined()
    expect(store.transactions).toHaveLength(before)
  })

  it("records neither the movement nor the repayment when saving the debt fails", async () => {
    const { store, debt } = await splitLunch()
    const before = store.transactions.length
    store.savePersonalDebt = async () => {
      throw new Error("disk full")
    }
    await expect(repayPersonalDebt(store, debt.id, "40", referenceDate, { accountId: IDs.cash })).rejects.toThrow("disk full")
    expect(store.transactions).toHaveLength(before)
    expect(store.personalDebts.find((candidate) => candidate.id === debt.id)!.repayments).toEqual([])
  })

  it("deposits only what someone owes the person", async () => {
    const store = sampleStore()
    store.personalDebts = [{ id: crypto.randomUUID(), person: "Leo", direction: "iOwe", amount: { amount: "50", currency: "USD" }, date: referenceDate.toISOString(), repayments: [] }]
    const before = store.transactions.length
    const error: unknown = await repayPersonalDebt(store, store.personalDebts[0]!.id, "10", referenceDate, { accountId: IDs.savings }).catch((thrown: unknown) => thrown)
    expect((error as DomainError).code).toBe("unsupportedTransactionKind")
    expect(store.transactions).toHaveLength(before)
    expect(store.personalDebts[0]!.repayments).toEqual([])
  })

  it("deleting the repayment deletes its movement and reopens a debt it settled", async () => {
    const { store, debt } = await splitLunch()
    const before = store.transactions.length
    const repaid = await repayPersonalDebt(store, debt.id, "100", referenceDate, { accountId: IDs.cash })
    const repayment = repaid.repayments[0]!
    const updated = await deleteDebtRepayment(store, debt.id, repayment.id!)
    expect(updated.repayments).toEqual([])
    expect(updated.settledAt).toBeUndefined()
    expect(store.transactions).toHaveLength(before)
  })

  it("deleting the movement leaves the repayment, whose deletion then only changes the debt", async () => {
    const { store, debt } = await splitLunch()
    const repaid = await repayPersonalDebt(store, debt.id, "40", referenceDate, { accountId: IDs.cash })
    const repayment = repaid.repayments[0]!
    await store.deleteTransaction(repayment.transactionId!)
    expect((await store.fetchPersonalDebts()).find((candidate) => candidate.id === debt.id)!.repayments).toHaveLength(1)
    const updated = await deleteDebtRepayment(store, debt.id, repayment.id!)
    expect(updated.repayments).toEqual([])
  })

  it("keeps a debt settled by hand settled when a repayment is deleted", async () => {
    const { store, debt } = await splitLunch()
    const repaid = await repayPersonalDebt(store, debt.id, "40", referenceDate)
    const settledAt = date(2026, 10, 30).toISOString()
    store.personalDebts = store.personalDebts.map((candidate) => (candidate.id === debt.id ? { ...repaid, settledAt } : candidate))
    const updated = await deleteDebtRepayment(store, debt.id, repaid.repayments[0]!.id!)
    expect(updated.settledAt).toBe(settledAt)
  })

  it("files the deposit under Other income once Refunds is gone, and names the person", () => {
    expect(repaymentCategoryId(DEFAULT_CATEGORIES)).toBe("refunds")
    expect(repaymentCategoryId(DEFAULT_CATEGORIES.filter((category) => category.id !== "refunds"))).toBe(OTHER_INCOME_ID)
    expect(repaymentDescription({ person: "Ana" })).toBe("Ana")
    expect(repaymentDescription({ person: "Ana", note: " Cena " })).toBe("Ana · Cena")
  })
})
