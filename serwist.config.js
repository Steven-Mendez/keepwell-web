// @ts-check
import { serwist } from "@serwist/next/config"

// Every prerendered page (`.next/server/app/**/*.html`, `/~offline` among them) is precached with a
// hash of its HTML as the revision (`precachePrerendered`, on by default), so the offline page needs
// no entry of its own: adding one listed `/~offline` twice with two revisions, and Serwist refused
// to start the worker. scripts/check-sw-precache.mjs fails the build if a URL is ever repeated.
export default serwist({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
})
