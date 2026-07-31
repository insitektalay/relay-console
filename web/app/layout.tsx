import type { Metadata } from "next"
import type { ReactNode } from "react"
import { headers } from "next/headers"
import { AppProviders } from "@/components/app-providers"
import { ClientErrorMonitor } from "@/components/monitoring/client-error-monitor"
import { isValidCspNonce } from "@/security/content-security-policy"
import { TelemetryConsentProvider } from "@/components/telemetry/telemetry-consent-provider"
import "./globals.css"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Relay Console",
  description: "Browser client for Relay Console",
  icons: {
    icon: [{ url: "/brand/relay-console-logo.png", type: "image/png" }],
    shortcut: [{ url: "/favicon.ico" }],
    apple: [{ url: "/brand/relay-console-logo.png", type: "image/png" }],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const nonce = (await headers()).get("x-nonce")
  if (!isValidCspNonce(nonce)) {
    throw new Error("Relay Console document rendering requires a CSP nonce.")
  }

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="dark font-sans antialiased"
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-background text-foreground antialiased"
      >
        <AppProviders>
          <TelemetryConsentProvider>
            <ClientErrorMonitor />
            {children}
          </TelemetryConsentProvider>
        </AppProviders>
      </body>
    </html>
  )
}
