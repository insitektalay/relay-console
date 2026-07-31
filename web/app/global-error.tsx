"use client"

import { useEffect } from "react"
import { captureSanitizedClientError } from "@/lib/telemetry"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    void captureSanitizedClientError({
      event: "web.client.error",
      message: error.message,
      name: error.name,
      pagePath:
        typeof window === "undefined" ? null : window.location.pathname,
      stack: error.stack ?? null,
    })
  }, [error])

  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100">
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-white/10 bg-white/[0.035] p-6 text-center">
            <h1 className="text-xl font-semibold">
              Relay could not load this view
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Try loading it again. Optional error reporting never includes
              message content or credentials.
            </p>
            <button
              type="button"
              className="mt-5 rounded-md bg-violet-500 px-4 py-2 text-sm font-semibold text-white"
              onClick={reset}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
