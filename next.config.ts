import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Lets a phone on the same network, or 127.0.0.1 (a second, empty browser database), load the
  // dev server.
  allowedDevOrigins: ["192.168.1.19", "127.0.0.1"],
}

export default nextConfig
