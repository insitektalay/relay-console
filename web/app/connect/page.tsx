"use client"

import { useMemo } from "react"

export default function ConnectRelayPage() {
  const descriptor =
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("descriptor") ?? "")
  const details = useMemo(() => {
    if (!descriptor) return null
    try {
      const normalized = descriptor.replace(/-/g, "+").replace(/_/g, "/")
      const envelope = JSON.parse(
        atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="))
      )
      return envelope?.payload as
        | {
            displayName?: string
            deploymentId?: string
            ownershipType?: string
          }
        | undefined
    } catch {
      return null
    }
  }, [descriptor])
  const appLink = descriptor
    ? `clawchat://connect?descriptor=${encodeURIComponent(descriptor)}`
    : null
  const isSupported = details?.ownershipType === "relay_managed"

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0e0e10] p-6 text-zinc-100">
      <section className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <p className="text-sm font-semibold text-blue-400">Relay connection</p>
        <h1 className="mt-2 text-3xl font-bold">
          {details?.displayName ?? "Connect to Relay"}
        </h1>
        {details && isSupported ? (
          <div className="mt-5 space-y-2 text-sm text-zinc-300">
            <p>
              Deployment ID:{" "}
              <span className="font-mono text-xs">{details.deploymentId}</span>
            </p>
            <p>Service: Relay control plane</p>
            <p>
              The descriptor identifies the server only. You will still sign in,
              and no server or administrator secret is included.
            </p>
          </div>
        ) : (
          <p className="mt-5 text-amber-300">
            This Relay link is missing, invalid, or unsupported.
          </p>
        )}
        {appLink && isSupported ? (
          <a
            className="mt-7 inline-flex rounded-lg bg-blue-500 px-5 py-3 font-semibold text-white"
            href={appLink}
          >
            Open in Relay Console for iPhone
          </a>
        ) : null}
      </section>
    </main>
  )
}
