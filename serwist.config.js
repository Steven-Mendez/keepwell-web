// @ts-check
import { spawnSync } from "node:child_process"

import { serwist } from "@serwist/next/config"

// Versions the offline page, which Serwist can't hash on its own; the build's assets carry hashes.
const revision = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() || crypto.randomUUID()

export default serwist({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
})
