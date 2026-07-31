"use client"

import { useEffect } from "react"
import { captureSanitizedClientError } from "@/lib/telemetry"

export default function AppError({
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
      pagePath: window.location.pathname,
      stack: error.stack ?? null,
    })
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-zinc-100">
      <div className="max-w-md rounded-xl border border-white/10 bg-white/[0.035] p-6 text-center">
        <h1 className="text-xl font-semibold">Relay hit an unexpected error</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Your work is still stored. Try this screen again. If error reporting
          is enabled, Relay has sent a sanitized diagnostic to help us fix it.
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
  )
}
