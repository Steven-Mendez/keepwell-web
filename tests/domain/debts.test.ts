// Loans and personal debts: the schedule, totals, the use cases (paying an installment records a real
// expense; splitting creates one debt per person), and both through IndexedDB.
import "fake-indexeddb/auto"

import { describe, expect, it } from "vitest"

import {
  DomainError,
  InMemoryStore,
  debtTotals,
  equalShare,
  checkSplit,
  loanProgress,
  orderedLoans,
  orderedPersonalDebts,
  payLoanInstallment,
  repayPersonalDebt,
  unpayLoanInstallment,
  reopenPersonalDebt,
  saveLoan,
  savePersonalDebt,
  settlePersonalDebt,
  splitTransaction,
} from "@/lib/domain"
import {
  type Loan,
  type PersonalDebt,
} from "@/lib/schema"

import { d, date, IDs, referenceDate, sampleStore, ZONE } from "./fixtures"

function loan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "00000000-0000-0000-0000-00000000f001",
    name: "Motorbike",
    borrowed: { amount: "20000", currency: "NIO" },
    installmentAmount: "1916.67",
    installmentCount: 12,
    frequency: "monthly",
    firstDueDate: date(2026, 1, 31).toISOString(),
    payments: [],
    ...overrides,
  }
}

const paid = (...numbers: number[]) =>
  numbers.map((number) => ({
    number,
    paidAt: date(2026, 1, number).toISOString(),
  }))

function debt(overrides: Partial<PersonalDebt> = {}): PersonalDebt {
  return {
    id: "00000000-0000-0000-0000-00000000f101",
    person: "Juan",
    direction: "theyOweMe",
    amount: { amount: "500", currency: "NIO" },
    date: date(2026, 11, 1).toISOString(),
    repayments: [],
    ...overrides,
  }
}

async function expectDomainError(
  work: () => Promise<unknown>,
  code: DomainError["code"]
) {
  const error = await work().then(
    () => undefined,
    (thrown: unknown) => thrown
  )
  expect(error).toBeInstanceOf(DomainError)
  expect((error as DomainError).code).toBe(code)
}

describe("Loan schedule", () => {
  it("keeps the first due day and clamps it to short months", () => {
    const progress = loanProgress(
      loan({ installmentCount: 4 }),
      date(2026, 1, 1), ZONE
    )
    expect(
      progress.installments.map((row) => [
        row.dueDate.getMonth() + 1,
        row.dueDate.getDate(),
      ])
    ).toEqual([
      [1, 31],
      [2, 28],
      [3, 31],
      [4, 30],
    ])
  })

  it("puts weekly installments seven days apart", () => {
    const progress = loanProgress(
      loan({
        installmentCount: 3,
        frequency: "weekly",
        firstDueDate: date(2026, 11, 2).toISOString(),
      }),
      date(2026, 11, 1), ZONE
    )
    expect(progress.installments.map((row) => row.dueDate.getDate())).toEqual([
      2, 9, 16,
    ])
  })

  it("counts what is left from the unpaid installments", () => {
    const progress = loanProgress(
      loan({ payments: paid(1, 2) }),
      date(2026, 2, 1), ZONE
    )
    expect(progress.remaining.toFixed(2)).toBe("19166.70")
    expect(progress.totalToPay.toFixed(2)).toBe("23000.04")
    expect(progress.next?.number).toBe(3)
    expect(progress.isNextOverdue).toBe(false)
    expect(
      loanProgress(loan({ payments: paid(1, 2) }), date(2026, 4, 1), ZONE)
        .isNextOverdue
    ).toBe(true)
  })

  it("orders by the soonest next installment, paid-off loans last", () => {
    const ordered = orderedLoans(
      [
        loan({
          id: "done",
          name: "Done",
          installmentCount: 1,
          payments: paid(1),
        }),
        loan({
          id: "later",
          name: "Later",
          firstDueDate: date(2026, 3, 1).toISOString(),
        }),
        loan({
          id: "soon",
          name: "Soon",
          firstDueDate: date(2026, 2, 1).toISOString(),
        }),
      ],
      date(2026, 1, 15), ZONE
    )
    expect(ordered.map((row) => row.loan.name)).toEqual([
      "Soon",
      "Later",
      "Done",
    ])
  })
})

describe("Personal debts and totals", () => {
  it("totals each currency apart and skips what is closed", () => {
    const debts = [
      debt({
        repayments: [{ amount: "200", date: date(2026, 11, 2).toISOString() }],
      }),
      debt({
        id: "luis",
        person: "Luis",
        amount: { amount: "20", currency: "USD" },
      }),
      debt({
        id: "ana",
        person: "Ana",
        direction: "iOwe",
        amount: { amount: "40", currency: "USD" },
      }),
      debt({
        id: "old",
        person: "Old",
        direction: "iOwe",
        amount: { amount: "99", currency: "USD" },
        settledAt: date(2026, 11, 3).toISOString(),
      }),
    ]
    const totals = debtTotals(
      [
        loan({ payments: paid(1, 2) }),
        loan({ installmentCount: 1, payments: paid(1) }),
      ],
      debts
    )
    expect(
      totals.owedToYou.map((line) => [line.amount.toFixed(), line.currency])
    ).toEqual([
      ["300", "NIO"],
      ["20", "USD"],
    ])
    expect(
      totals.youOwe.map((line) => [line.amount.toFixed(2), line.currency])
    ).toEqual([
      ["19166.70", "NIO"],
      ["40.00", "USD"],
    ])
  })

  it("lists open debts first, newest first", () => {
    const ordered = orderedPersonalDebts([
      debt({ id: "a", person: "Old", date: date(2026, 10, 1).toISOString() }),
      debt({
        id: "b",
        person: "Settled",
        date: date(2026, 11, 3).toISOString(),
        settledAt: date(2026, 11, 4).toISOString(),
      }),
      debt({ id: "c", person: "New", date: date(2026, 11, 2).toISOString() }),
    ])
    expect(ordered.map((row) => row.person)).toEqual(["New", "Old", "Settled"])
  })

  it("splits equally between the person and the others, rounding down", () => {
    expect(equalShare(d(900), 2).toFixed()).toBe("300")
    expect(equalShare(d(100), 2).toFixed()).toBe("33.33")
    expect(equalShare(d(100), 0).isZero()).toBe(true)
    expect(() => checkSplit([d(60), d(41)], d(100))).toThrow(DomainError)
    expect(() => checkSplit([], d(100))).toThrow(DomainError)
    expect(() => checkSplit([d(50), d(50)], d(100))).not.toThrow()
  })
})

describe("Debts use cases", () => {
  it("pays the next installment with a confirmed expense and marks it", async () => {
    const store = sampleStore()
    store.loans = [loan({ payments: paid(1, 2) })]
    const updated = await payLoanInstallment(store, {
      loanId: loan().id,
      source: { type: "card", id: IDs.savingsTransfer },
      categoryId: "other-expense",
      date: referenceDate,
    })
    const payment = updated.payments.at(-1)!
    expect(payment.number).toBe(3)
    const movement = store.transactions.find(
      (transaction) => transaction.id === payment.transactionId
    )
    expect(movement).toMatchObject({
      description: "Motorbike · 3/12",
      kind: "expense",
      status: "confirmed",
      amount: "1916.67",
      currency: "NIO",
      accountId: IDs.savings,
      categoryId: "other-expense",
    })
    expect((await store.fetchLoans())[0]!.payments).toHaveLength(3)
  })

  it("refuses to pay a paid-off loan and records nothing", async () => {
    const store = sampleStore()
    store.loans = [loan({ installmentCount: 1, payments: paid(1) })]
    const before = store.transactions.length
    await expectDomainError(
      () =>
        payLoanInstallment(store, {
          loanId: loan().id,
          source: { type: "card", id: IDs.savingsTransfer },
          categoryId: "other-expense",
          date: referenceDate,
        }),
      "invalidAmount"
    )
    expect(store.transactions).toHaveLength(before)
  })

  it("records neither the expense nor the payment when saving the loan fails", async () => {
    const store = sampleStore()
    store.loans = [loan({ payments: paid(1) })]
    const before = store.transactions.length
    store.saveLoan = async () => {
      throw new Error("disk full")
    }
    await expect(
      payLoanInstallment(store, {
        loanId: loan().id,
        source: { type: "card", id: IDs.savingsTransfer },
        categoryId: "other-expense",
        date: referenceDate,
      })
    ).rejects.toThrow("disk full")
    expect(store.transactions).toHaveLength(before)
    expect(store.loans[0]!.payments).toHaveLength(1)
  })

  it("marks a paid installment unpaid and deletes the expense that paid it", async () => {
    const store = sampleStore()
    store.loans = [loan({ payments: paid(1) })]
    const before = store.transactions.length
    const updated = await payLoanInstallment(store, {
      loanId: loan().id,
      source: { type: "card", id: IDs.savingsTransfer },
      categoryId: "other-expense",
      date: referenceDate,
    })
    expect(store.transactions).toHaveLength(before + 1)
    const unpaid = await unpayLoanInstallment(store, loan().id, 2)
    expect(unpaid.payments.map((payment) => payment.number)).toEqual([1])
    expect(store.transactions).toHaveLength(before)
    expect(
      store.transactions.some(
        (transaction) => transaction.id === updated.payments.at(-1)!.transactionId
      )
    ).toBe(false)
    // Without a movement (or one already gone), only the loan changes.
    expect((await unpayLoanInstallment(store, loan().id, 1)).payments).toEqual([])
    await expectDomainError(
      () => unpayLoanInstallment(store, loan().id, 1),
      "invalidAmount"
    )
  })

  it("saves loans in the person's currencies and keeps paid installments on edit", async () => {
    const store = sampleStore()
    const created = await saveLoan(store, {
      name: "  Car ",
      lender: " ",
      borrowedAmount: "9000",
      currency: "USD",
      installmentAmount: "400",
      installmentCount: 24,
      frequency: "monthly",
      firstDueDate: referenceDate,
    })
    expect(created).toMatchObject({
      name: "Car",
      borrowed: { amount: "9000", currency: "USD" },
      payments: [],
    })
    expect(created).not.toHaveProperty("lender")
    await expectDomainError(
      () =>
        saveLoan(store, {
          name: "X",
          lender: "",
          borrowedAmount: "1",
          currency: "EUR",
          installmentAmount: "1",
          installmentCount: 1,
          frequency: "monthly",
          firstDueDate: referenceDate,
        }),
      "invalidCurrency"
    )
    await expectDomainError(
      () =>
        saveLoan(store, {
          name: " ",
          lender: "",
          borrowedAmount: "1",
          currency: "USD",
          installmentAmount: "1",
          installmentCount: 1,
          frequency: "monthly",
          firstDueDate: referenceDate,
        }),
      "missingName"
    )
    store.loans = [loan({ payments: paid(1, 2) })]
    const draft = {
      id: loan().id,
      name: "Motorbike",
      lender: "Banpro",
      borrowedAmount: "20000",
      currency: "USD",
      installmentAmount: "1916.67",
      installmentCount: 1,
      frequency: "monthly" as const,
      firstDueDate: referenceDate,
    }
    await expectDomainError(() => saveLoan(store, draft), "invalidAmount")
    const edited = await saveLoan(store, { ...draft, installmentCount: 10 })
    expect(edited.borrowed.currency).toBe("NIO")
    expect(edited.payments).toHaveLength(2)
    expect(edited.lender).toBe("Banpro")
  })

  it("keeps repayments when a debt is edited and settles it when repaid", async () => {
    const store = sampleStore()
    store.personalDebts = [
      debt({
        repayments: [{ amount: "200", date: date(2026, 11, 2).toISOString() }],
      }),
      debt({
        id: "00000000-0000-0000-0000-00000000f102",
        person: "Ana",
        direction: "iOwe",
        amount: { amount: "40", currency: "USD" },
      }),
    ]
    await expectDomainError(
      () =>
        savePersonalDebt(store, {
          id: debt().id,
          person: "Juan",
          direction: "theyOweMe",
          amount: "100",
          currency: "NIO",
          date: referenceDate,
          note: "",
        }),
      "invalidAmount"
    )
    const edited = await savePersonalDebt(store, {
      id: debt().id,
      person: "Juan Pérez",
      direction: "theyOweMe",
      amount: "600",
      currency: "USD",
      date: referenceDate,
      note: " ",
    })
    expect(edited).toMatchObject({ amount: { amount: "600", currency: "NIO" } })
    expect(edited).not.toHaveProperty("note")
    const settled = await repayPersonalDebt(
      store,
      debt().id,
      "400",
      referenceDate
    )
    expect(settled.settledAt).toBe(referenceDate.toISOString())
    await expectDomainError(
      () => repayPersonalDebt(store, debt().id, "1", referenceDate),
      "invalidAmount"
    )
    const ana = await settlePersonalDebt(
      store,
      "00000000-0000-0000-0000-00000000f102",
      referenceDate
    )
    expect(ana.settledAt).toBeDefined()
    expect((await reopenPersonalDebt(store, ana.id)).settledAt).toBeUndefined()
  })

  it("splits an expense into one debt per person linked to it", async () => {
    const store = sampleStore()
    const expense = store.transactions.find(
      (transaction) =>
        transaction.kind === "expense" && d(transaction.amount).gte(10)
    )!
    const share = equalShare(d(expense.amount), 2)
    const created = await splitTransaction(store, expense.id, [
      { person: " Juan ", amount: share },
      { person: "Ana", amount: share },
    ])
    expect(created.map((row) => row.person)).toEqual(["Juan", "Ana"])
    expect(
      created.every(
        (row) =>
          row.direction === "theyOweMe" &&
          row.transactionId === expense.id &&
          row.note === expense.description
      )
    ).toBe(true)
    expect(store.personalDebts).toHaveLength(2)
    await expectDomainError(
      () =>
        splitTransaction(store, expense.id, [
          { person: "Too much", amount: d(expense.amount).plus(1) },
        ]),
      "invalidAmount"
    )
    await expectDomainError(
      () =>
        splitTransaction(store, expense.id, [{ person: " ", amount: d(1) }]),
      "missingName"
    )
    const income = store.transactions.find(
      (transaction) => transaction.kind === "income"
    )!
    await expectDomainError(
      () => splitTransaction(store, income.id, [{ person: "X", amount: d(1) }]),
      "unsupportedTransactionKind"
    )
  })

  it("an InMemoryStore starts with no loans or debts", async () => {
    const store = new InMemoryStore(ZONE)
    expect(await store.fetchLoans()).toEqual([])
    expect(await store.fetchPersonalDebts()).toEqual([])
  })
})
