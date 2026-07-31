import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync(
  new URL("../components/artifacts/artifacts-screen.tsx", import.meta.url),
  "utf8"
)
const presentationSource = readFileSync(
  new URL("../lib/artifacts.ts", import.meta.url),
  "utf8"
)

test("Artifacts uses the Swift context/sidebar and detail split", () => {
  assert.match(source, /mode: "sidebar" \| "detail"/)
  assert.match(source, /onSelectedIdChange/)
  assert.match(source, /Search artifacts/)
  assert.match(source, /Docs&nbsp;/)
  assert.match(source, /Media&nbsp;/)
  assert.match(source, /h-\[60px\]/)
})

test("all metadata-only artifact kinds and source states have explicit presentation", () => {
  for (const kind of [
    "document",
    "image",
    "video",
    "audio",
    "data",
    "folder",
    "unknown",
  ]) {
    assert.match(source, new RegExp(`(?:case |value=)"${kind}"`))
  }
  assert.match(source, /External artifact/)
  assert.match(source, /No artifact selected/)
  assert.match(source, /Metadata only/)
  assert.match(source, /Stored on \{selected\.machineLabel\}/)
  for (const state of [
    "available",
    "unavailable",
    "moved",
    "expired",
    "deleted",
    "permission_denied",
  ]) {
    assert.match(presentationSource, new RegExp(`${state}:`))
  }
  assert.match(presentationSource, /source device is offline/i)
})

test("artifact failures are retryable and browser catalogue remains non-destructive", () => {
  assert.match(source, /Some artifact sources failed/)
  assert.match(source, /query\.refetch\(\)/)
  assert.doesNotMatch(source, /Delete artifact/)
  assert.doesNotMatch(source, /artifactsDelete/)
})

test("external artifacts use a prevalidated no-opener no-referrer link", () => {
  assert.match(source, /externalArtifactDestination/)
  assert.match(source, /href=\{selectedExternalDestination\.url\}/)
  assert.match(source, /target="_blank"/)
  assert.match(source, /rel="noopener noreferrer"/)
  assert.match(source, /selectedExternalDestination\.host/)
  assert.doesNotMatch(source, /window\.open/)
})
