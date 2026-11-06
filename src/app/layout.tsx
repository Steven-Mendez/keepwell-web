import { SerwistProvider } from "@serwist/next/react"
import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { AppBootstrap } from "@/components/app/app-bootstrap"
import { AppShell } from "@/components/app/app-shell"
import { Toaster } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"
import { I18nProvider } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// Inter, the family iOS bundles (KWFonts). next/font self-hosts it, so it works offline.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  applicationName: "Keepwell",
  title: { default: "Keepwell", template: "%s · Keepwell" },
  description: "Personal finances that live on your device.",
  appleWebApp: { capable: true, title: "Keepwell", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: { icon: "/icon.svg", apple: "/icon-180.png" },
}

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // Dark only, like iOS (`preferredColorScheme(.dark)`).
    <html lang="en" suppressHydrationWarning className={cn("dark antialiased", fontMono.variable, "font-sans", inter.variable)}>
      <body>
        {/* The service worker would cache dev bundles and hide changes, so it only runs in production. */}
        <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV === "development"}>
          <AppBootstrap />
          {/* Providers the shadcn tooltip and toast need, once for the whole app. */}
          <I18nProvider>
            <TooltipProvider>
              <Toaster>
                <AppShell>{children}</AppShell>
              </Toaster>
            </TooltipProvider>
          </I18nProvider>
        </SerwistProvider>
      </body>
    </html>
  )
}
