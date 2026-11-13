import { resolveTimeZone, type TimeZone } from "@/lib/domain/calendar"

/**
 * The browser's time zone: the one the web app reads days and months in, like iOS
 * `Calendar.current`. Read on every call, so a laptop that changes zone follows it. The person's
 * home zone (`Settings.timeZone`) is what the server uses; the screens stay on the device's.
 */
export function deviceTimeZone(): TimeZone {
  return resolveTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
}
