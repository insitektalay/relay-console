import { NextResponse } from "next/server"
import { buildMacOSUpdateManifest } from "../../../lib/macos-update-manifest"
import { buildWebReleaseIdentity } from "../../../lib/release-identity"

export const dynamic = "force-dynamic"
export const revalidate = 0

const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
}

export function GET() {
  const identity = buildWebReleaseIdentity(process.env)
  const manifest = buildMacOSUpdateManifest(process.env)
  if (!identity || !manifest) {
    return NextResponse.json(
      {
        schemaVersion: "relay.macos-update-manifest.error.v1",
        status: "unavailable",
      },
      { status: 503, headers: HEADERS }
    )
  }

  return NextResponse.json(manifest, { status: 200, headers: HEADERS })
}
