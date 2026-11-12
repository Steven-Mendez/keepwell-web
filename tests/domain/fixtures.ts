import type { Account, Card, ExchangeRate, Settings, Transaction, TransactionKind, TransactionStatus } from "@/lib/schema"
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from "@/lib/schema"
import { Decimal, InMemoryStore, monthInterval, yearMonthContaining } from "@/lib/domain"

// Ports of keepwell-ios DomainTests/Fixtures.swift and DomainSamples/SampleData.

/** The zone the suites run in (`TZ` in package.json), passed to the domain explicitly. */
export const ZONE = "America/Managua"

export const usdNio: ExchangeRate = { principal: "USD", second: "NIO", rate: "36.6243" }
export const single = (code: string): ExchangeRate => ({ principal: code, second: code, rate: "1" })

export const d = (value: string | number) => new Decimal(value)

/** Noon by default, in the test time zone (America/Managua, like iOS Fixtures.calendar). */
export function date(year: number, month: number, day: number, hour = 12): Date {
  return new Date(year, month - 1, day, hour)
}

export function transaction(options: {
  kind?: TransactionKind
  amount: string
  currency?: string
  account?: string
  card?: string
  destination?: string
  actualDebited?: string
  category?: string | null
  status?: TransactionStatus
  date?: Date
  rate?: ExchangeRate
  description?: string
}): Transaction {
  const kind = options.kind ?? "expense"
  const category = options.category === undefined ? "other-expense" : options.category
  return {
    id: crypto.randomUUID(),
    date: (options.date ?? date(2026, 10, 5)).toISOString(),
    status: options.status ?? "confirmed",
    description: options.description ?? "Movimiento",
    kind,
    ...(kind === "transfer" || category === null ? {} : { categoryId: category }),
    amount: options.amount,
    currency: options.currency ?? "USD",
    accountId: options.account ?? crypto.randomUUID(),
    ...(options.card ? { cardId: options.card } : {}),
    ...(options.destination ? { destinationAccountId: options.destination } : {}),
    ...(options.actualDebited ? { actualDebitedPrincipal: options.actualDebited } : {}),
    exchangeRate: options.rate ?? usdNio,
    isShared: false,
  }
}

const id = (suffix: string) => `00000000-0000-0000-0000-${suffix.padStart(12, "0").toLowerCase()}`

export const IDs = {
  savings: id("A001"),
  payroll: id("A002"),
  cash: id("A003"),
  mastercard: id("A004"),
  visa: id("A005"),
  savingsDebit: id("C001"),
  savingsTransfer: id("C002"),
  payrollDebit: id("C003"),
  payrollTransfer: id("C004"),
  mastercardHolder: id("C005"),
  visaHolder: id("C007"),
}

/** The sample's fixed "today": 22 October 2026, 18:00 GMT. */
export const referenceDate = new Date(Date.UTC(2026, 9, 22, 18))

export interface Sample {
  settings: Settings
  accounts: Account[]
  cards: Card[]
  transactions: Transaction[]
}

export function sampleData(reference: Date = referenceDate): Sample {
  const month = yearMonthContaining(reference, ZONE)
  const monthStart = monthInterval(month, ZONE).start
  const opening = new Date(monthStart.getFullYear(), monthStart.getMonth() - 2, 1)
  const day = (number: number, offset = 0) => new Date(monthStart.getFullYear(), monthStart.getMonth() + offset, number, 12)
  const accounts: Account[] = [
    { id: IDs.savings, name: "Savings", bank: "Bank One", kind: "deposit", openingBalances: [{ amount: "9520", currency: "USD" }], openingDate: opening.toISOString() },
    { id: IDs.payroll, name: "Payroll", bank: "Bank Two", kind: "deposit", openingBalances: [{ amount: "-480.10", currency: "USD" }], openingDate: opening.toISOString() },
    { id: IDs.cash, name: "Wallet", kind: "cash", openingBalances: [{ amount: "7500", currency: "NIO" }], openingDate: opening.toISOString() },
    {
      id: IDs.mastercard,
      name: "Mastercard",
      bank: "Bank One",
      kind: "credit",
      openingBalances: [
        { amount: "0", currency: "USD" },
        { amount: "0", currency: "NIO" },
      ],
      openingDate: opening.toISOString(),
      creditTerms: { debtMode: "dual" },
    },
    {
      id: IDs.visa,
      name: "Visa",
      bank: "Bank Two",
      kind: "credit",
      openingBalances: [{ amount: "-880", currency: "NIO" }],
      openingDate: opening.toISOString(),
      creditTerms: { debtMode: "second", cutoffDay: 28, dueDay: 15 },
    },
  ]
  const cards: Card[] = [
    { id: IDs.savingsDebit, accountId: IDs.savings, kind: "debit", network: "visa", lastFour: "1234", color: "verde" },
    { id: IDs.savingsTransfer, accountId: IDs.savings, kind: "transfer" },
    { id: IDs.payrollDebit, accountId: IDs.payroll, kind: "debit", network: "visa", lastFour: "5678", color: "platino" },
    { id: IDs.payrollTransfer, accountId: IDs.payroll, kind: "transfer" },
    { id: IDs.mastercardHolder, accountId: IDs.mastercard, kind: "creditHolder", network: "mastercard", lastFour: "4321", color: "azul" },
    { id: IDs.visaHolder, accountId: IDs.visa, kind: "creditHolder", network: "visa", lastFour: "9012", color: "grafito" },
  ]
  type Row = [Date, TransactionStatus, string, TransactionKind, string | null, string, string, string, string | null, (string | undefined)?, (string | undefined)?, boolean?]
  const rows: Row[] = [
    [day(28), "planned", "Monthly groceries", "expense", "groceries", "3500", "NIO", IDs.savings, IDs.savingsDebit],
    [day(28), "planned", "Family support", "expense", "family", "2000", "NIO", IDs.savings, IDs.savingsDebit],
    [day(25), "planned", "Electricity (estimate)", "expense", "utilities", "1300", "NIO", IDs.savings, IDs.savingsDebit],
    [day(24), "planned", "Phone", "expense", "utilities", "700", "NIO", IDs.savings, IDs.savingsDebit],
    [day(22), "confirmed", "Design software", "expense", "tools", "200", "USD", IDs.payroll, IDs.payrollDebit],
    [day(19), "confirmed", "Home internet", "expense", "utilities", "23.18", "USD", IDs.payroll, IDs.payrollDebit],
    [day(15), "confirmed", "Salary", "income", "salary", "2452.24", "USD", IDs.payroll, IDs.payrollTransfer],
    [day(5), "confirmed", "Card replacement", "expense", "fees", "7", "USD", IDs.savings, IDs.savingsDebit],
    [day(5), "confirmed", "Lunch", "expense", "restaurants", "250", "NIO", IDs.cash, null],
    [day(5), "confirmed", "Bus", "expense", "transport", "60", "NIO", IDs.cash, null],
    [day(4), "confirmed", "Movies", "expense", "leisure", "739.32", "NIO", IDs.savings, IDs.savingsDebit, undefined, "20.42", true],
    [day(4), "confirmed", "Cardless withdrawal", "transfer", null, "1200", "NIO", IDs.savings, IDs.savingsTransfer, IDs.cash, "33.15"],
    [day(3), "confirmed", "Groceries", "expense", "groceries", "2150", "NIO", IDs.mastercard, IDs.mastercardHolder],
    [day(2), "confirmed", "Streaming", "expense", "subscriptions", "197.02", "NIO", IDs.mastercard, IDs.mastercardHolder],
    [day(1), "confirmed", "Music", "expense", "subscriptions", "16.79", "USD", IDs.mastercard, IDs.mastercardHolder],
    [day(30, -1), "confirmed", "Interest", "income", "interest", "3.02", "USD", IDs.savings, null],
    [day(12, -1), "confirmed", "Dinner", "expense", "restaurants", "1360", "NIO", IDs.visa, IDs.visaHolder],
    [day(8, -1), "confirmed", "Online course", "expense", "tools", "10", "USD", IDs.payroll, IDs.payrollDebit],
  ]
  const transactions: Transaction[] = rows.map(([when, status, description, kind, category, amount, currency, account, card, destination, debited, shared], index) => ({
    id: id(String(index + 1)),
    date: when.toISOString(),
    status,
    description,
    kind,
    ...(category ? { categoryId: category } : {}),
    amount,
    currency,
    accountId: account,
    ...(card ? { cardId: card } : {}),
    ...(destination ? { destinationAccountId: destination } : {}),
    ...(debited ? { actualDebitedPrincipal: debited } : {}),
    exchangeRate: usdNio,
    isShared: shared ?? false,
  }))
  return {
    settings: { ...DEFAULT_SETTINGS, currencies: { principal: "USD", second: "NIO", rate: "36.6243" }, hasCompletedOnboarding: true },
    accounts,
    cards,
    transactions,
  }
}

export function sampleStore(sample: Sample = sampleData()): InMemoryStore {
  return new InMemoryStore(ZONE, { ...sample, categories: [...DEFAULT_CATEGORIES] })
}
