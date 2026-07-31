"use client"

import type { RealtimeConnectionState } from "@/hooks/use-clawchat-realtime"

export function RealtimeConnectionStatus({
  connectionState,
}: {
  connectionState: RealtimeConnectionState
}) {
  if (connectionState === "connected" || connectionState === "disconnected") {
    return null
  }

  const authenticationFailed = connectionState === "auth_failed"
  const label = authenticationFailed
    ? "Realtime authentication failed"
    : connectionState === "reconnecting"
      ? "Realtime reconnecting"
      : "Realtime connecting"

  return (
    <div
      aria-live={authenticationFailed ? "assertive" : "polite"}
      className={`fixed top-3 right-3 z-[120] max-w-sm rounded-[6px] border px-3 py-2 text-sm shadow-lg ${
        authenticationFailed
          ? "border-red-400/50 bg-red-950 text-red-100"
          : "border-blue-400/40 bg-slate-950 text-slate-100"
      }`}
      role={authenticationFailed ? "alert" : "status"}
    >
      <div className="font-semibold">{label}</div>
      {authenticationFailed ? (
        <div className="mt-1 text-xs text-red-100/80">
          Authentication failed. Sign in again to reconnect.
        </div>
      ) : null}
    </div>
  )
}
