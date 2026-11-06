import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Lets a phone or another computer on the same network load the dev server.
  allowedDevOrigins: ["192.168.1.19"],
}

export default nextConfig
