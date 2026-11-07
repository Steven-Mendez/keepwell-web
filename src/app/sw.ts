/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker"
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { NetworkOnly, Serwist } from "serwist"

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
  runtimeCaching: [{ matcher: ({ sameOrigin }) => !sameOrigin, handler: new NetworkOnly() }, ...defaultCache],
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
