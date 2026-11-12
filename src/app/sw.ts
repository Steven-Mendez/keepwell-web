/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker"
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { NetworkOnly, Serwist } from "serwist"

import { isApiPath } from "@/lib/api/proxied-paths"

// The app shell is precached at build time and every route is served from cache when offline. Data
// never goes through the service worker: it lives in IndexedDB, so the app works fully offline.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  // `serwist build` injects the manifest; the empty list only satisfies the type before it does.
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // The Keepwell API (and anything else on another origin) is never cached: answers there carry a
  // session and change with every sync. It must come first, before defaultCache's cross-origin rule.
  // Same goes for the API's paths when this deployment proxies them (src/lib/api/proxied-paths.ts).
  runtimeCaching: [
    { matcher: ({ sameOrigin, url }) => !sameOrigin || isApiPath(url.pathname), handler: new NetworkOnly() },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document"
        },
      },
    ],
  },
})

serwist.addEventListeners()

// Push (ADR 0012 in keepwell-api). The API words each notification in the person's language, so the
// worker only shows it; `tag` is the notification's id, so a second send replaces instead of
// stacking, and "clear" closes the ones read or deleted on another device.
type PushMessage =
  | { type: "notification"; id: string; title: string; body: string }
  | { type: "clear"; ids: string[] }

self.addEventListener("push", (event) => {
  const message = event.data?.json() as PushMessage | undefined
  if (!message) return
  if (message.type === "clear") {
    event.waitUntil(
      self.registration.getNotifications().then((shown) => {
        for (const notification of shown) if (message.ids.includes(notification.tag)) notification.close()
      })
    )
    return
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.id,
      icon: "/icon-192.png",
      data: { id: message.id },
    })
  )
})

// Opens the inbox on that notification: the page marks it read (which syncs) and goes where it leads.
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const id = (event.notification.data as { id?: string } | undefined)?.id
  const url = id ? `/notifications?open=${encodeURIComponent(id)}` : "/notifications"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows[0]
      if (open) {
        await open.focus()
        await open.navigate(url)
      } else {
        await self.clients.openWindow(url)
      }
    })
  )
})
