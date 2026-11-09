/**
 * The Keepwell API, when this deployment has one. Without NEXT_PUBLIC_API_URL the web stays fully
 * local (no account, no sync) exactly as before.
 *
 * Every call sends the session cookie (`credentials: "include"`); the API's CORS admits only this
 * origin. Responses are never cached here, and the service worker leaves the API alone.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || undefined

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown }
  request_id: string
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly details?: unknown
  ) {
    super(message)
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, "no_api", "This build has no API")
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
  })
  const text = await res.text()
  const body = text ? (JSON.parse(text) as unknown) : undefined
  if (!res.ok) {
    // Our routes answer { error: { code } }; Better Auth (/api/auth) answers { code } at the top.
    const error =
      (body as Partial<ApiErrorBody> | undefined)?.error ??
      ((body as { code?: string } | undefined)?.code ? (body as { code: string; message: string; details?: unknown }) : undefined)
    throw new ApiError(res.status, error?.code ?? "http_error", error?.message ?? res.statusText, (body as ApiErrorBody | undefined)?.request_id, error?.details)
  }
  return body as T
}
