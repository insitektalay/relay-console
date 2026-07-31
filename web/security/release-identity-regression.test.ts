import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  buildWebReleaseIdentity,
  RELEASE_REPOSITORY,
} from "../lib/release-identity"

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function productionEnvironment() {
  const [owner, repository] = RELEASE_REPOSITORY.split("/")
  return {
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_GIT_PROVIDER: "github",
    VERCEL_GIT_REPO_OWNER: owner,
    VERCEL_GIT_REPO_SLUG: repository,
    RELAY_RELEASE_REPOSITORY: RELEASE_REPOSITORY,
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
    VERCEL_GIT_COMMIT_REF: "release/relay-console-1.0.0-rc1",
    VERCEL_DEPLOYMENT_ID: "dpl_Release123",
    VERCEL_URL: "relay-console-release-abc.vercel.app",
    DATABASE_URL: "must-not-be-returned",
    STRIPE_SECRET_KEY: "must-not-be-returned",
  }
}

test("release identity exposes only deployment and source identity", () => {
  const identity = buildWebReleaseIdentity(productionEnvironment())

  assert.deepEqual(identity, {
    schemaVersion: "relay.web-release-identity.v1",
    repository: RELEASE_REPOSITORY,
    sourceCommit: "a".repeat(40),
    sourceBranch: "release/relay-console-1.0.0-rc1",
    environment: "production",
    deploymentId: "dpl_Release123",
    deploymentURL: "https://relay-console-release-abc.vercel.app",
  })
  assert.doesNotMatch(
    JSON.stringify(identity),
    /DATABASE|STRIPE|must-not-be-returned/
  )
})

test("release identity fails closed outside an exact Vercel production release", () => {
  for (const [name, value] of [
    ["VERCEL_ENV", "preview"],
    ["VERCEL_GIT_PROVIDER", "gitlab"],
    ["RELAY_RELEASE_REPOSITORY", "different-owner/different-repository"],
    ["VERCEL_GIT_COMMIT_SHA", "short"],
    ["VERCEL_GIT_COMMIT_REF", "main"],
    ["VERCEL_DEPLOYMENT_ID", "invalid"],
    ["VERCEL_URL", "relayconsole.work"],
  ]) {
    const environment = { ...productionEnvironment(), [name]: value }
    assert.equal(buildWebReleaseIdentity(environment), null, name)
  }
})

test("public route is dynamic, uncached, and returns a bounded error", () => {
  const source = readFileSync(
    resolve(webRoot, "app/release-identity.json/route.ts"),
    "utf8"
  )

  assert.match(source, /dynamic = "force-dynamic"/)
  assert.match(source, /revalidate = 0/)
  assert.match(source, /Cache-Control": "no-store, max-age=0"/)
  assert.match(source, /status: 503/)
  assert.doesNotMatch(source, /DATABASE_URL|STRIPE_SECRET|process\.env\[/)
})
