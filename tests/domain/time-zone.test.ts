// The domain reads days and months in the zone it is given, never the process's: the suite runs in
// America/Managua (`TZ` in package.json) and these cases compute for other zones, the way the server
// computes for each person in their home zone (T21).
import { describe, expect, it } from "vitest"

import {
  InMemoryStore,
  addDays,
  billingCycle,
  dayKey,
  isTimeZone,
  materializeRecurring,
  monthInterval,
  monthlySummary,
  occurrence,
  parseDayKey,
  resolveTimeZone,
  startOfDay,
  upcoming,
  yearMonthContaining,
  zonedDate,
} from "@/lib/domain"
import { DEFAULT_SETTINGS, type RecurringRule } from "@/lib/schema"

import { IDs, sampleData, transaction } from "./fixtures"

const TOKYO = "Asia/Tokyo"
const MADRID = "Europe/Madrid"

function rule(startDate: string, overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: "00000000-0000-0000-0000-00000000e021",
    name: "Rent",
    kind: "expense",
    categoryId: "other-expense",
    amount: "10",
    currency: "USD",
    accountId: IDs.mastercard,
    cardId: IDs.mastercardHolder,
    frequency: "monthly",
    interval: 1,
    startDate,
    nextDate: startDate,
    isSubscription: false,
    autoConfirm: true,
    isPaused: false,
    ...overrides,
  }
}

describe("calendar in an explicit zone", () => {
  it("reads the day and month of an instant in the zone given, not the process's", () => {
    // 05:30 UTC on Nov 1 is still Oct 31 in Managua and already Nov 1 in Madrid.
    const instant = new Date("2026-11-01T05:30:00.000Z")
    expect(dayKey(instant, "America/Managua")).toBe("2026-10-31")
    expect(dayKey(instant, MADRID)).toBe("2026-11-01")
    expect(yearMonthContaining(instant, MADRID)).toEqual({ year: 2026, month: 11 })
    expect(yearMonthContaining(instant, "America/Managua")).toEqual({ year: 2026, month: 10 })
  })

  it("builds month boundaries and days at that zone's midnight", () => {
    expect(monthInterval({ year: 2026, month: 11 }, TOKYO)).toEqual({ start: new Date("2026-10-31T15:00:00.000Z"), end: new Date("2026-11-30T15:00:00.000Z") })
    expect(startOfDay(new Date("2026-11-12T20:00:00.000Z"), TOKYO).toISOString()).toBe("2026-11-12T15:00:00.000Z")
    expect(parseDayKey("2026-11-12", TOKYO)?.toISOString()).toBe("2026-11-12T03:00:00.000Z")
  })

  it("keeps the wall-clock time across a daylight-saving change", () => {
    // Madrid moves to summer time on 2026-03-29: a day later is 23 hours later, same 10:00.
    const before = zonedDate(MADRID, 2026, 3, 28, 10)
    const after = addDays(before, 1, MADRID)
    expect(after.getTime() - before.getTime()).toBe(23 * 3_600_000)
    expect(dayKey(after, MADRID)).toBe("2026-03-29")
    // A time skipped by the change moves forward by the jump, as `new Date(y, m, d, h)` does.
    expect(zonedDate(MADRID, 2026, 3, 29, 2, 30).toISOString()).toBe("2026-03-29T01:30:00.000Z")
  })

  it("resolves an unknown zone to the fallback, and that to UTC", () => {
    expect(isTimeZone(TOKYO)).toBe(true)
    expect(isTimeZone("Mars/Olympus")).toBe(false)
    expect(resolveTimeZone("Mars/Olympus", MADRID)).toBe(MADRID)
    expect(resolveTimeZone(undefined, "Nowhere/Else")).toBe("UTC")
  })
})

describe("rules in the person's zone", () => {
  it("counts a movement in the month of the zone given", () => {
    const late = transaction({ amount: "25", date: new Date("2026-11-01T05:30:00.000Z") })
    expect(monthlySummary({ year: 2026, month: 11 }, [late], "USD", MADRID).expense.toString()).toBe("25")
    expect(monthlySummary({ year: 2026, month: 11 }, [late], "USD", "America/Managua").expense.toString()).toBe("0")
  })

  it("adds months to a recurring rule on that zone's calendar", () => {
    // Jan 31 09:00 in Tokyo is Jan 30 18:00 in Managua: the next month is Feb 28 in one and Feb 28
    // in the other, but at different instants, and the Tokyo one is the 28th in Tokyo.
    const schedule = rule("2026-01-31T00:00:00.000Z")
    expect(occurrence(schedule, 1, TOKYO).toISOString()).toBe("2026-02-28T00:00:00.000Z")
    expect(dayKey(occurrence(schedule, 1, TOKYO), TOKYO)).toBe("2026-02-28")
    expect(dayKey(occurrence(schedule, 2, TOKYO), TOKYO)).toBe("2026-03-31")
    expect(occurrence(schedule, 1, "America/Managua").toISOString()).toBe("2026-03-01T00:00:00.000Z")
  })

  it("materializes what is due today in the store's zone", async () => {
    // Due Nov 13 at 16:00 in Tokyo, which is Nov 13 01:00 in Managua. At 05:00 UTC it is Nov 13
    // in Tokyo, so it is due there, and still Nov 12 in Managua, where it isn't yet.
    const due = rule("2026-11-13T07:00:00.000Z", { frequency: "weekly" })
    const now = new Date("2026-11-13T05:00:00.000Z")
    const seed = () => ({ ...sampleData(), recurringRules: [due], settings: { ...DEFAULT_SETTINGS, currencies: { principal: "USD", second: "NIO", rate: "36.6243" } } })
    expect(await materializeRecurring(new InMemoryStore(TOKYO, seed()), now)).toHaveLength(1)
    expect(await materializeRecurring(new InMemoryStore("America/Managua", seed()), now)).toHaveLength(0)
  })

  it("lists upcoming occurrences through the zone's day", () => {
    const soon = rule("2026-11-14T00:30:00.000Z", { frequency: "weekly" })
    const now = new Date("2026-11-12T23:30:00.000Z")
    // Tomorrow in Tokyo is Nov 14, which holds the 09:30 occurrence; in UTC tomorrow is Nov 13.
    expect(upcoming([soon], now, 1, TOKYO)).toHaveLength(1)
    expect(upcoming([soon], now, 1, "UTC")).toHaveLength(0)
  })

  it("cuts a card's billing cycle at the zone's midnight", () => {
    const cycle = billingCycle(new Date("2026-11-12T12:00:00.000Z"), 20, TOKYO)
    expect(cycle.start.toISOString()).toBe("2026-10-20T15:00:00.000Z")
    expect(cycle.end.toISOString()).toBe("2026-11-20T15:00:00.000Z")
  })
})

describe("the home zone in the settings row", () => {
  it("leaves the column out while there is none, so a save never clears the account's zone", async () => {
    const { rowToSettings, settingsToRow } = await import("@/lib/db/mappers")
    const at = "2026-11-12T10:00:00.000Z"
    expect(settingsToRow(DEFAULT_SETTINGS, at)).not.toHaveProperty("time_zone")
    const row = settingsToRow({ ...DEFAULT_SETTINGS, timeZone: TOKYO }, at)
    expect(row.time_zone).toBe(TOKYO)
    expect(rowToSettings(row).timeZone).toBe(TOKYO)
    expect(rowToSettings({ ...row, time_zone: null })).not.toHaveProperty("timeZone")
  })
})
