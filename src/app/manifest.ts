import type { MetadataRoute } from "next"

/** Installable, standalone and dark like the iOS app (black background, brand-blue icon). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Keepwell",
    short_name: "Keepwell",
    description: "Personal finances that live on your device.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["finance"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  }
}
