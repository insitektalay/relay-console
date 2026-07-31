import assert from "node:assert/strict"
import test from "node:test"
import {
  artifactKind,
  artifactTitle,
  cronArtifactGroup,
  externalArtifactDestination,
  isArtifactFile,
  parseExternalArtifactPointer,
} from "../lib/artifacts"

test("classifies the reference artifact kinds", () => {
  assert.equal(artifactKind("brief.md"), "document")
  assert.equal(artifactKind("hero.png"), "image")
  assert.equal(artifactKind("results.csv"), "data")
  assert.equal(artifactKind("clip.mp4"), "video")
  assert.equal(artifactKind("voice.wav"), "audio")
  assert.equal(artifactKind("output.bin"), "unknown")
})

test("interprets only safe external artifact pointer manifests", () => {
  const pointer = parseExternalArtifactPointer(
    "brief.artifact.json",
    JSON.stringify({
      title: "Board brief",
      kind: "document",
      external_url: "https://docs.example.test/brief",
      provider: "docs",
    })
  )
  assert.equal(pointer?.title, "Board brief")
  assert.equal(pointer?.externalProvider, "docs")
  assert.equal(pointer?.externalUrl, "https://docs.example.test/brief")
  for (const external_url of [
    "http://docs.example.test/brief",
    "//docs.example.test/brief",
    "https:docs.example.test/brief",
    " https://docs.example.test/brief",
    "https://user:secret@docs.example.test/brief",
    "https://docs.example.test\\@attacker.test/brief",
    "https://docs.example.test/\nattacker",
    "javascript:alert(1)",
  ]) {
    assert.throws(
      () =>
        parseExternalArtifactPointer(
          "unsafe.artifact.json",
          JSON.stringify({ external_url })
        ),
      /approved HTTPS URL/
    )
  }
})

test("canonicalizes an external destination and exposes only its host", () => {
  assert.deepEqual(
    externalArtifactDestination(
      "HTTPS://Docs.Example.test:443/brief?token=provider#section"
    ),
    {
      url: "https://docs.example.test/brief?token=provider#section",
      host: "docs.example.test",
    }
  )
})

test("excludes scheduler configuration and secrets from artifact rows", () => {
  assert.equal(isArtifactFile("jobs.json"), false)
  assert.equal(isArtifactFile("runtime.env"), false)
  assert.equal(isArtifactFile("provider-token.txt"), false)
  assert.equal(isArtifactFile("README.md"), true)
  assert.equal(isArtifactFile("output.bin"), true)
})

test("groups cron outputs and derives readable titles", () => {
  assert.equal(
    cronArtifactGroup("cron/output/daily-brief/report.md"),
    "daily-brief"
  )
  assert.equal(artifactTitle("daily_brief-report.md"), "Daily Brief Report")
})
