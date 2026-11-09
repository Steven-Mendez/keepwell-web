// Copies src/lib/{domain,schema,fixtures} into an empty project that only has `zod` and
// `decimal.js`, and type-checks it there. This is the contract keepwell-api relies on when it
// copies the folders: if it fails here, the copy would fail there.
import { execFileSync } from "node:child_process"
import { cpSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const web = resolve(import.meta.dirname, "..")
const dir = mkdtempSync(join(tmpdir(), "keepwell-shared-"))
try {
  for (const folder of ["domain", "schema", "fixtures"]) {
    cpSync(join(web, "src/lib", folder), join(dir, "src", folder), { recursive: true })
  }
  mkdirSync(join(dir, "node_modules"))
  for (const dep of ["zod", "decimal.js"]) {
    symlinkSync(join(web, "node_modules", dep), join(dir, "node_modules", dep))
  }
  writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module", private: true }))
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        // Web Crypto (`crypto.randomUUID`) is global in browsers and in Node 22.
        lib: ["ES2023", "DOM"],
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        noUncheckedIndexedAccess: true,
        skipLibCheck: true,
        noEmit: true,
        types: [],
      },
      include: ["src"],
    })
  )
  execFileSync(join(web, "node_modules/.bin/tsc"), ["-p", dir], { stdio: "inherit" })
  console.log("Shared domain compiles alone with zod and decimal.js")
} finally {
  rmSync(dir, { recursive: true, force: true })
}
