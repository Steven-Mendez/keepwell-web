import {
  db,
  loanToRow,
  personalDebtToRow,
  rowToLoan,
  rowToPersonalDebt,
} from "@/lib/db"
import { Loan, PersonalDebt } from "@/lib/schema"

import { isAlive, softDelete, upsert } from "./shared"

export const loanRepository = {
  /** Alive loans, in no particular order: screens sort them with `orderedLoans`. */
  async list(): Promise<Loan[]> {
    const rows = await db.loans.filter(isAlive).toArray()
    return rows.map(rowToLoan)
  },

  async save(input: Loan): Promise<Loan> {
    const loan = Loan.parse(input)
    await upsert(db.loans, "loan", loanToRow(loan))
    return loan
  },

  async remove(id: string): Promise<void> {
    await softDelete(db.loans, "loan", id)
  },
}

export const personalDebtRepository = {
  /** Alive debts, in no particular order: screens sort them with `orderedPersonalDebts`. */
  async list(): Promise<PersonalDebt[]> {
    const rows = await db.personal_debts.filter(isAlive).toArray()
    return rows.map(rowToPersonalDebt)
  },

  async save(input: PersonalDebt): Promise<PersonalDebt> {
    const debt = PersonalDebt.parse(input)
    await upsert(db.personal_debts, "personalDebt", personalDebtToRow(debt))
    return debt
  },

  async remove(id: string): Promise<void> {
    await softDelete(db.personal_debts, "personalDebt", id)
  },
}
