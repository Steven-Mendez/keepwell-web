import { api } from "./client"

/** A split expense as its public link shows it (`GET /shared/:token` in keepwell-api). */
export interface SharedSplitView {
  description: string
  date: string
  amount: string
  currency: string
  /** What the expense cost its owner, after the others' shares. */
  owner_share: string
  shares: {
    person: string
    amount: string
    currency: string
    repaid: string
    paid: boolean
  }[]
}

export function fetchSharedSplit(token: string): Promise<SharedSplitView> {
  return api<SharedSplitView>(`/shared/${encodeURIComponent(token)}`)
}
