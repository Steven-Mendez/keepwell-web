import {
  db,
  loanPaymentsToRows,
  loanToRow,
  personalDebtToRow,
  repaymentsToRows,
  rowToLoan,
  rowToPersonalDebt,
} from "@/lib/db"
import { Loan, PersonalDebt } from "@/lib/schema"

import { isAlive, softDelete, syncChildren, upsert } from "./shared"

// A loan's payments and a debt's repayments are rows of their own (ADR 0005), so two devices can
// each record one without a later save of the parent erasing the other's.

export const loanRepository = {
  /** Alive loans, in no particular order: screens sort them with `orderedLoans`. */
  async list(): Promise<Loan[]> {
    const [rows, payments] = await Promise.all([db.loans.filter(isAlive).toArray(), db.loan_payments.filter(isAlive).toArray()])
    return rows.map((row) => rowToLoan(row, payments))
  },

  async save(input: Loan): Promise<Loan> {
    const loan = Loan.parse(input)
    await db.transaction("rw", db.loans, db.loan_payments, db.sync_outbox, async () => {
      const existing = await db.loans.get(loan.id)
      const columns = loanToRow(loan)
      const changed = !existing || Object.entries(columns).some(([key, value]) => JSON.stringify(existing[key as keyof typeof existing]) !== JSON.stringify(value))
      if (changed) await upsert(db.loans, "loan", columns)
      const current = await db.loan_payments.where("loan_id").equals(loan.id).toArray()
      await syncChildren(db.loan_payments, "loanPayment", current, loanPaymentsToRows(loan))
    })
    return (await this.list()).find((saved) => saved.id === loan.id) ?? loan
  },

  async remove(id: string): Promise<void> {
    await db.transaction("rw", db.loans, db.loan_payments, db.sync_outbox, async () => {
      await softDelete(db.loans, "loan", id)
      for (const payment of await db.loan_payments.where("loan_id").equals(id).filter(isAlive).toArray()) {
        await softDelete(db.loan_payments, "loanPayment", payment.id)
      }
    })
  },
}

export const personalDebtRepository = {
  /** Alive debts, in no particular order: screens sort them with `orderedPersonalDebts`. */
  async list(): Promise<PersonalDebt[]> {
    const [rows, repayments] = await Promise.all([db.personal_debts.filter(isAlive).toArray(), db.personal_debt_repayments.filter(isAlive).toArray()])
    return rows.map((row) => rowToPersonalDebt(row, repayments))
  },

  async save(input: PersonalDebt): Promise<PersonalDebt> {
    const debt = PersonalDebt.parse(input)
    await db.transaction("rw", db.personal_debts, db.personal_debt_repayments, db.sync_outbox, async () => {
      const existing = await db.personal_debts.get(debt.id)
      const columns = personalDebtToRow(debt)
      const changed = !existing || Object.entries(columns).some(([key, value]) => JSON.stringify(existing[key as keyof typeof existing]) !== JSON.stringify(value))
      if (changed) await upsert(db.personal_debts, "personalDebt", columns)
      const current = await db.personal_debt_repayments.where("debt_id").equals(debt.id).toArray()
      await syncChildren(db.personal_debt_repayments, "personalDebtRepayment", current, repaymentsToRows(debt))
    })
    return (await this.list()).find((saved) => saved.id === debt.id) ?? debt
  },

  async remove(id: string): Promise<void> {
    await db.transaction("rw", db.personal_debts, db.personal_debt_repayments, db.sync_outbox, async () => {
      await softDelete(db.personal_debts, "personalDebt", id)
      for (const repayment of await db.personal_debt_repayments.where("debt_id").equals(id).filter(isAlive).toArray()) {
        await softDelete(db.personal_debt_repayments, "personalDebtRepayment", repayment.id)
      }
    })
  },
}
