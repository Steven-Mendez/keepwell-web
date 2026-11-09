import type { NextConfig } from "next"

import { API_PATHS } from "./src/lib/api/proxied-paths"

// Without a custom domain the API answers only on its API Gateway URL. KEEPWELL_API_ORIGIN makes this
// deployment forward the API's paths there, so the browser talks to one origin (src/lib/api/proxied-paths.ts).
const apiOrigin = process.env.KEEPWELL_API_ORIGIN?.replace(/\/$/, "")

const nextConfig: NextConfig = {
  // Lets a phone on the same network, or 127.0.0.1 (a second, empty browser database), load the
  // dev server.
  allowedDevOrigins: ["192.168.1.19", "127.0.0.1"],
  ...(apiOrigin
    ? {
        async rewrites() {
          return API_PATHS.map((path) => ({ source: path, destination: `${apiOrigin}${path}` }))
        },
      }
    : {}),
}

export default nextConfig
