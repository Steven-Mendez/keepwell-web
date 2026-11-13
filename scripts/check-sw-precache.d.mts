export interface PrecacheEntry {
  url: string
  revision: string | null
}

export function precacheEntries(source: string): PrecacheEntry[]
export function conflictingUrls(entries: PrecacheEntry[]): string[]
export function runsAsClassicScript(source: string): boolean
