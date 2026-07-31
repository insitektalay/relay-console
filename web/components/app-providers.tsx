"use client"

import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { Toaster } from "sonner"
import { useState } from "react"

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="clawchat-classic"
      disableTransitionOnChange
      enableSystem={false}
      storageKey="clawchat.web.theme"
      themes={["clawchat-classic"]}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            className: "!border-border !bg-card !text-card-foreground",
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
