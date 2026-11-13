import { SerwistProvider } from "@serwist/next/react"
import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { AppBootstrap } from "@/components/app/app-bootstrap"
import { AppShell } from "@/components/app/app-shell"
import { MotionProvider } from "@/components/kw/motion"
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
  appleWebApp: {
    capable: true,
    title: "Keepwell",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: { icon: "/icon.svg", apple: "/icon-180.png" },
}

export const viewport: Viewport = {
  // The browser chrome matches the page background (Surface.bg) in each appearance.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F3F7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  colorScheme: "light dark",
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // Light or dark with the system appearance, like iOS; tokens.css switches the palette.
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        {/* The service worker would cache dev bundles and hide changes, so it only runs in production.
            A classic worker (the bundle has no imports): Chrome fetches a module worker without
            cookies, which Vercel's preview protection redirects, and a redirected script can't
            register. No reload when the connection returns: the data is local, the sync
            scheduler already runs on "online", and a reload would drop a half-written form. */}
        <SerwistProvider
          swUrl="/sw.js"
          disable={process.env.NODE_ENV === "development"}
          options={{ type: "classic" }}
          reloadOnOnline={false}
        >
          <AppBootstrap />
          {/* Providers the shadcn tooltip and toast need, once for the whole app. */}
          <I18nProvider>
            <TooltipProvider>
              <Toaster>
                <MotionProvider>
                  <AppShell>{children}</AppShell>
                </MotionProvider>
              </Toaster>
            </TooltipProvider>
          </I18nProvider>
        </SerwistProvider>
      </body>
    </html>
  )
}
