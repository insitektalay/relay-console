import { NextResponse } from "next/server"
import { buildWebReleaseIdentity } from "@/lib/release-identity"

export const dynamic = "force-dynamic"
export const revalidate = 0

const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
}

export function GET() {
  const identity = buildWebReleaseIdentity(process.env)
  if (!identity) {
    return NextResponse.json(
      {
        schemaVersion: "relay.web-release-identity.error.v1",
        status: "unavailable",
      },
      { status: 503, headers: HEADERS }
    )
  }

  return NextResponse.json(identity, { status: 200, headers: HEADERS })
}
