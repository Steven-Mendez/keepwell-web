import { api, API_URL } from "@/lib/api/client"
import { getClientId } from "@/lib/sync/client-id"

// Native notifications in the browser (ADR 0012 in keepwell-api): the API sends them with Web Push
// and VAPID, so they arrive with Keepwell closed. The browser's subscription is registered as one
// of the account's push devices under this installation's `client_id`.

export type BrowserPushStatus =
  /** No service worker, no Push API (Safari outside a Home Screen app), or no API in this build. */
  | "unsupported"
  /** The person said no; only the browser's site settings can undo it. */
  | "denied"
  | "off"
  | "on"

interface PushConfig {
  vapid_public_key: string
}

export function browserPushSupported(): boolean {
  return (
    API_URL !== undefined &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!browserPushSupported()) return undefined
  return navigator.serviceWorker.ready
}

export async function browserPushStatus(): Promise<BrowserPushStatus> {
  if (!browserPushSupported()) return "unsupported"
  if (Notification.permission === "denied") return "denied"
  const subscription = await (await registration())?.pushManager.getSubscription()
  return subscription && Notification.permission === "granted" ? "on" : "off"
}

/** VAPID keys travel base64url; `subscribe` wants the raw bytes. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index)
  return bytes
}

async function register(subscription: PushSubscription): Promise<void> {
  const clientId = await getClientId()
  await api(`/push/devices/${clientId}`, {
    method: "PUT",
    body: JSON.stringify({
      platform: "web",
      token: JSON.stringify(subscription.toJSON()),
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language,
    }),
  })
}

/** Asks for permission (it must follow a click), subscribes and tells the API. */
export async function enableBrowserPush(): Promise<BrowserPushStatus> {
  const worker = await registration()
  if (!worker) return "unsupported"
  const permission = await Notification.requestPermission()
  if (permission !== "granted") return permission === "denied" ? "denied" : "off"
  const { vapid_public_key } = await api<PushConfig>("/push/config")
  const subscription =
    (await worker.pushManager.getSubscription()) ??
    (await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapid_public_key) }))
  await register(subscription)
  return "on"
}

export async function disableBrowserPush(): Promise<void> {
  const worker = await registration()
  const subscription = await worker?.pushManager.getSubscription()
  const clientId = await getClientId()
  await api(`/push/devices/${clientId}`, { method: "DELETE" }).catch(() => undefined)
  await subscription?.unsubscribe()
}

/**
 * Re-registers on launch: browsers rotate subscriptions, and the time zone may have changed since.
 * Quiet when push is off or the person is signed out.
 */
export async function refreshBrowserPush(): Promise<void> {
  if ((await browserPushStatus()) !== "on") return
  const subscription = await (await registration())?.pushManager.getSubscription()
  if (subscription) await register(subscription).catch(() => undefined)
}

/** Closes banners still on screen for notifications read or deleted here or on another device. */
export async function closeHandledNotifications(handled: ReadonlySet<string>): Promise<void> {
  const worker = await registration()
  if (!worker || handled.size === 0) return
  for (const shown of await worker.getNotifications()) {
    if (handled.has(shown.tag)) shown.close()
  }
}
