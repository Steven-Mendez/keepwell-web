// Loans and personal debts: the schedule, totals, the use cases (paying an installment records a real
// expense; splitting creates one debt per person), and both through IndexedDB and the backup file
// (version 4). The pinned JSON is the same text iOS DebtBackupTests checks.
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
  reopenPersonalDebt,
  saveLoan,
  savePersonalDebt,
  settlePersonalDebt,
  splitTransaction,
} from "@/lib/domain"
import {
  backupRepository,
  loanRepository,
  personalDebtRepository,
  settingsRepository,
} from "@/lib/repositories"
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  parseBackupFile,
  serializeBackupFile,
  type BackupFile,
  type Loan,
  type PersonalDebt,
} from "@/lib/schema"

import { IDs, d, date, referenceDate, sampleStore } from "./fixtures"

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
      date(2026, 1, 1)
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
      date(2026, 11, 1)
    )
    expect(progress.installments.map((row) => row.dueDate.getDate())).toEqual([
      2, 9, 16,
    ])
  })

  it("counts what is left from the unpaid installments", () => {
    const progress = loanProgress(
      loan({ payments: paid(1, 2) }),
      date(2026, 2, 1)
    )
    expect(progress.remaining.toFixed(2)).toBe("19166.70")
    expect(progress.totalToPay.toFixed(2)).toBe("23000.04")
    expect(progress.next?.number).toBe(3)
    expect(progress.isNextOverdue).toBe(false)
    expect(
      loanProgress(loan({ payments: paid(1, 2) }), date(2026, 4, 1))
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
      date(2026, 1, 15)
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
    const store = new InMemoryStore()
    expect(await store.fetchLoans()).toEqual([])
    expect(await store.fetchPersonalDebts()).toEqual([])
  })
})

describe("Backup file version 4", () => {
  const audit = {
    createdAt: "2026-10-26T07:33:20.000Z",
    updatedAt: "2026-10-26T07:33:20.500Z",
  }
  const settings = {
    ...DEFAULT_SETTINGS,
    currencies: { principal: "USD", second: "NIO", rate: "36.6243" },
    hasCompletedOnboarding: true,
    updatedAt: audit.updatedAt,
  }

  function file(): BackupFile {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: audit.createdAt,
      settings,
      accounts: [],
      cards: [],
      categories: [],
      transactions: [],
      recurringRules: [],
      savingsGoals: [],
      loans: [
        {
          id: "2a3b4c5d-6e7f-4081-9293-a4b5c6d7e8f9",
          name: "Moto",
          lender: "Banpro",
          borrowed: { amount: "60000", currency: "NIO" },
          installmentAmount: "5500.5",
          installmentCount: 12,
          frequency: "monthly",
          firstDueDate: "2026-11-28T18:00:00.000Z",
          payments: [
            {
              number: 1,
              paidAt: "2026-11-27T15:30:00.000Z",
              transactionId: "9c0e1d2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f",
            },
          ],
          ...audit,
        },
        {
          id: "6e7f8091-a2b3-4c4d-95e6-f708192a3b4c",
          name: "Phone",
          borrowed: { amount: "800", currency: "USD" },
          installmentAmount: "100",
          installmentCount: 8,
          frequency: "weekly",
          firstDueDate: "2026-11-02T18:00:00.000Z",
          payments: [],
          ...audit,
          deletedAt: audit.updatedAt,
        },
      ],
      personalDebts: [
        {
          id: "3b4c5d6e-7f80-4192-a3b4-c5d6e7f8091a",
          person: "Juan",
          direction: "theyOweMe",
          amount: { amount: "500", currency: "NIO" },
          date: "2026-11-12T18:00:00.000Z",
          note: "Pizza",
          repayments: [{ amount: "200.5", date: "2026-11-15T18:00:00.000Z" }],
          transactionId: "4c5d6e7f-8091-4a2b-b3c4-d5e6f708192a",
          ...audit,
        },
        {
          id: "5d6e7f80-91a2-4b3c-84d5-e6f708192a3b",
          person: "Ana",
          direction: "iOwe",
          amount: { amount: "40", currency: "USD" },
          date: "2026-11-05T18:00:00.000Z",
          repayments: [],
          settledAt: "2026-11-06T18:00:00.000Z",
          ...audit,
        },
      ],
    }
  }

  it("writes the same text as iOS: sorted keys, optionals left out, exact decimals", () => {
    const text = serializeBackupFile(file())
    expect(CURRENT_SCHEMA_VERSION).toBe(4)
    expect(text).toContain(
      '"loans":[{"borrowed":{"amount":"60000","currency":"NIO"},"createdAt":"2026-10-26T07:33:20.000Z",' +
        '"firstDueDate":"2026-11-28T18:00:00.000Z","frequency":"monthly","id":"2a3b4c5d-6e7f-4081-9293-a4b5c6d7e8f9",' +
        '"installmentAmount":"5500.5","installmentCount":12,"lender":"Banpro","name":"Moto",' +
        '"payments":[{"number":1,"paidAt":"2026-11-27T15:30:00.000Z","transactionId":"9c0e1d2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f"}],' +
        '"updatedAt":"2026-10-26T07:33:20.500Z"},' +
        '{"borrowed":{"amount":"800","currency":"USD"},"createdAt":"2026-10-26T07:33:20.000Z",' +
        '"deletedAt":"2026-10-26T07:33:20.500Z","firstDueDate":"2026-11-02T18:00:00.000Z","frequency":"weekly",' +
        '"id":"6e7f8091-a2b3-4c4d-95e6-f708192a3b4c","installmentAmount":"100","installmentCount":8,"name":"Phone",' +
        '"payments":[],"updatedAt":"2026-10-26T07:33:20.500Z"}]'
    )
    expect(text).toContain(
      '"personalDebts":[{"amount":{"amount":"500","currency":"NIO"},"createdAt":"2026-10-26T07:33:20.000Z",' +
        '"date":"2026-11-12T18:00:00.000Z","direction":"theyOweMe","id":"3b4c5d6e-7f80-4192-a3b4-c5d6e7f8091a",' +
        '"note":"Pizza","person":"Juan","repayments":[{"amount":"200.5","date":"2026-11-15T18:00:00.000Z"}],' +
        '"transactionId":"4c5d6e7f-8091-4a2b-b3c4-d5e6f708192a","updatedAt":"2026-10-26T07:33:20.500Z"},' +
        '{"amount":{"amount":"40","currency":"USD"},"createdAt":"2026-10-26T07:33:20.000Z",' +
        '"date":"2026-11-05T18:00:00.000Z","direction":"iOwe","id":"5d6e7f80-91a2-4b3c-84d5-e6f708192a3b",' +
        '"person":"Ana","repayments":[],"settledAt":"2026-11-06T18:00:00.000Z","updatedAt":"2026-10-26T07:33:20.500Z"}]'
    )
    const parsed = parseBackupFile(text)
    expect(parsed).toEqual(file())
    expect(serializeBackupFile(parsed)).toBe(text)
  })

  it.each([1, 2, 3])(
    "a version %i file still restores, with no loans or debts",
    (version) => {
      const { loans: _, personalDebts: __, ...older } = file()
      const parsed = parseBackupFile(
        JSON.stringify({ ...older, schemaVersion: version })
      )
      expect(parsed.loans).toEqual([])
      expect(parsed.personalDebts).toEqual([])
    }
  )

  it.each([
    [
      "a zero installment",
      (f: BackupFile) => void (f.loans[0]!.installmentAmount = "0"),
    ],
    [
      "no installments",
      (f: BackupFile) => void (f.loans[0]!.installmentCount = 0),
    ],
    [
      "a payment outside the schedule",
      (f: BackupFile) =>
        void (f.loans[0]!.payments = [
          { number: 13, paidAt: "2026-11-27T15:30:00.000Z" },
        ]),
    ],
    [
      "repayments past the amount",
      (f: BackupFile) =>
        void (f.personalDebts[0]!.repayments = [
          { amount: "500.01", date: "2026-11-15T18:00:00.000Z" },
        ]),
    ],
    [
      "a negative debt",
      (f: BackupFile) =>
        void (f.personalDebts[0]!.amount = { amount: "-5", currency: "NIO" }),
    ],
  ])("refuses %s", (_, damage) => {
    const damaged = file()
    damage(damaged)
    expect(() => parseBackupFile(JSON.stringify(damaged))).toThrow(
      "Not a valid Keepwell backup"
    )
  })

  it("exports and restores loans and debts through IndexedDB, deletions included", async () => {
    await settingsRepository.save({
      ...DEFAULT_SETTINGS,
      currencies: { principal: "NIO", rate: "1" },
      hasCompletedOnboarding: true,
    })
    await loanRepository.save(loan({ payments: paid(1) }))
    await personalDebtRepository.save(debt({ note: "Dinner" }))
    const gone = debt({
      id: "00000000-0000-0000-0000-00000000f109",
      person: "Gone",
    })
    await personalDebtRepository.save(gone)
    await personalDebtRepository.remove(gone.id)

    const text = await backupRepository.export()
    const exported = parseBackupFile(text)
    expect(exported.schemaVersion).toBe(4)
    expect(exported.loans).toHaveLength(1)
    expect(exported.loans[0]).toMatchObject({
      name: "Motorbike",
      payments: [{ number: 1 }],
    })
    expect(exported.personalDebts).toHaveLength(2)
    expect(
      exported.personalDebts.find((row) => row.id === gone.id)?.deletedAt
    ).toBeDefined()

    await backupRepository.import(text)
    expect((await loanRepository.list()).map((row) => row.name)).toEqual([
      "Motorbike",
    ])
    expect(
      (await personalDebtRepository.list()).map((row) => row.person)
    ).toEqual(["Juan"])

    const v3 = { ...JSON.parse(text), schemaVersion: 3 }
    delete v3.loans
    delete v3.personalDebts
    await backupRepository.import(JSON.stringify(v3))
    expect(await loanRepository.list()).toEqual([])
    expect(await personalDebtRepository.list()).toEqual([])
  })
})
