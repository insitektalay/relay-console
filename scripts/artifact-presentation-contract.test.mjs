import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { readRelayConsoleViewSource } from "./swift-view-source.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const states = [
  "available",
  "unavailable",
  "moved",
  "expired",
  "deleted",
  "permission_denied",
]

const sources = {
  contract: "packages/contracts/src/index.ts",
  backend: "backend/src/modules/workspace/workspace-artifact.service.ts",
  web: "web/lib/artifacts.ts",
  macOS:
    "RelayConsoleSwift/Sources/RelayConsoleCore/ArtifactLibraryService.swift",
  iOS: "ios/ClawChat/Domain/Models/CoreModels.swift",
}

for (const [surface, relative] of Object.entries(sources)) {
  test(`${surface} declares every canonical artifact presentation state`, async () => {
    const source = await readFile(path.join(root, relative), "utf8")
    for (const state of states) {
      const spelling =
        state === "permission_denied" && (surface === "macOS" || surface === "iOS")
          ? 'permissionDenied = "permission_denied"'
          : state
      assert.match(
        source,
        new RegExp(spelling.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `${surface} is missing ${state}`
      )
    }
  })
}

test("clients suppress open actions for terminal artifact states", async () => {
  const [web, macOS, iOS] = await Promise.all([
    readFile(path.join(root, "web/components/artifacts/artifacts-screen.tsx"), "utf8"),
    Promise.resolve(readRelayConsoleViewSource(root)),
    readFile(path.join(root, "ios/ClawChat/Features/Library/ArtifactsView.swift"), "utf8"),
  ])
  assert.match(web, /presentationState !== "available"/)
  assert.match(web, /\["available", "moved"\]\.includes/)
  assert.match(macOS, /effectivePresentationState\.allowsOpen/)
  assert.match(iOS, /presentationState\.allowsExternalOpen/)
})
