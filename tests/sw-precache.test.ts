import { describe, expect, it } from "vitest"

import { conflictingUrls, precacheEntries } from "../scripts/check-sw-precache.mjs"

// The worker's precache list comes from `next build` + `serwist build`, which CI runs after the
// tests; scripts/check-sw-precache.mjs checks the real list at the end of `pnpm build`. These cover
// the check itself, with the shape that kept the worker from ever starting.
describe("service worker precache check", () => {
  it("finds a URL precached twice with different revisions", () => {
    const built =
      'var x=[{revision:"c31cb1d9",url:"/~offline"},{revision:"44934f77",url:"/welcome"},' +
      '{revision:null,url:"/_next/static/chunks/a.js"},{revision:"7f918b55",url:"/~offline"}];'
    const entries = precacheEntries(built)
    expect(entries.map((entry) => entry.url)).toEqual(["/~offline", "/welcome", "/_next/static/chunks/a.js", "/~offline"])
    expect(conflictingUrls(entries)).toEqual(["/~offline"])
  })

  it("accepts a list with every URL once, in either key order", () => {
    const built = '[{url:"/",revision:"1"},{revision:"2",url:"/~offline"},{url:"/icon.svg",revision:null}]'
    expect(precacheEntries(built)).toHaveLength(3)
    expect(conflictingUrls(precacheEntries(built))).toEqual([])
  })
})
