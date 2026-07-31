"use client"

import { RelayConsoleWebApp } from "@/components/clawchat-web-app"

export function RelayConsoleAppEntry({
  initialAuthMode = "login",
}: {
  initialAuthMode?: "login" | "register"
}) {
  return <RelayConsoleWebApp initialAuthMode={initialAuthMode} />
}
