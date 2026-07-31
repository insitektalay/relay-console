import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  createFreeLocalReleaseCandidate,
  validateFreeLocalReleaseCandidate,
  validateFreeLocalReleaseCandidateSchema,
} from "./free-local-release-candidate.mjs";

function fixture() {
  return {
    schemaVersion: "relay.free-local-release-candidate.v2",
    status: "draft",
    releaseId: "relay-console-free-local-0.1.1-build-4",
    createdAt: "2026-07-22T16:00:00.000Z",
    source: { branch: "codex/free-local-0.1.1-rc1", commit: "a".repeat(40), clean: false },
    product: { edition: "free-local", price: "free", cloudAccountRequired: false, paidEntitlementRequired: false, runtimeOwnership: "user-managed" },
    scope: {
      localConversations: true,
      localAgents: true,
      runtimeConnectivity: "same-mac-direct",
      supportedRuntimes: ["hermes", "openclaw"],
      marketplace: { mode: "local-preview", productionGuarantee: false },
      outOfScope: { relayCloud: true, relayConnect: true, webClient: true, iOS: true, managedRuntimeHosting: true, bridgePluginDistribution: true },
    },
    components: { macOS: { version: "0.1.1", build: "4", bundleIdentifier: "com.relayconsole.app", minimumOS: "14.0", architectures: ["arm64"], releaseChannel: "public-beta" } },
    distribution: { method: "direct-download", artifact: "dmg", signing: "developer-id-hardened-runtime", notarization: "apple-notary-service", updatePolicy: "manual-signed" },
    requiredAcceptance: ["automated-release-gate", "schema-38-to-40-upgrade", "same-mac-hermes", "same-mac-openclaw", "signed-notarized-quarantined-install", "clean-supported-mac", "accessibility-smoke", "https-publication-and-checksum", "human-go-no-go"],
    authorization: { signedArtifactCreation: true, publicPublication: false, finalOwner: "human-release-owner" },
  };
}

function metadataFile() {
  const directory = mkdtempSync(join(tmpdir(), "relay-free-local-metadata-"));
  const path = join(directory, "release.json");
  writeFileSync(path, JSON.stringify({
    version: "0.1.1",
    build: "4",
    bundleIdentifier: "com.relayconsole.app",
    minimumMacOSVersion: "14.0",
    releaseChannel: "public-beta",
  }));
  return path;
}

test("schema accepts the explicit Free Local product boundary", () => {
  assert.deepEqual(validateFreeLocalReleaseCandidateSchema(fixture()), { valid: true, errors: [] });
});

test("semantic validation rejects a hidden cloud or incomplete runtime scope", () => {
  const candidate = fixture();
  candidate.scope.outOfScope.relayCloud = false;
  candidate.scope.supportedRuntimes = ["hermes"];
  const result = validateFreeLocalReleaseCandidate(candidate, null, { metadataPath: metadataFile() });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /relayCloud|both same-Mac Hermes/);
});

test("candidate status fails closed on source identity and cleanliness", () => {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "relay-free-local-repo-"));
  execFileSync("git", ["init", "-b", "codex/free-local-test"], { cwd: repositoryRoot });
  execFileSync("git", ["config", "user.email", "release-test@relay.invalid"], { cwd: repositoryRoot });
  execFileSync("git", ["config", "user.name", "Relay Release Test"], { cwd: repositoryRoot });
  writeFileSync(join(repositoryRoot, "tracked.txt"), "release\n");
  execFileSync("git", ["add", "tracked.txt"], { cwd: repositoryRoot });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: repositoryRoot });
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
  const candidate = fixture();
  candidate.status = "candidate";
  candidate.source = { branch: "codex/free-local-test", commit, clean: true };
  assert.equal(validateFreeLocalReleaseCandidate(candidate, "candidate", { repositoryRoot, metadataPath: metadataFile() }).valid, true);
  writeFileSync(join(repositoryRoot, "untracked.txt"), "dirty\n");
  const dirty = validateFreeLocalReleaseCandidate(candidate, "candidate", { repositoryRoot, metadataPath: metadataFile() });
  assert.equal(dirty.valid, false);
  assert.match(dirty.errors.join("\n"), /dirty/);
});

test("generator derives version, build and clean source identity", () => {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "relay-free-local-generator-"));
  execFileSync("git", ["init", "-b", "codex/free-local-generated"], { cwd: repositoryRoot });
  execFileSync("git", ["config", "user.email", "release-test@relay.invalid"], { cwd: repositoryRoot });
  execFileSync("git", ["config", "user.name", "Relay Release Test"], { cwd: repositoryRoot });
  writeFileSync(join(repositoryRoot, "tracked.txt"), "release\n");
  execFileSync("git", ["add", "tracked.txt"], { cwd: repositoryRoot });
  execFileSync("git", ["commit", "-m", "fixture"], { cwd: repositoryRoot });
  const candidate = createFreeLocalReleaseCandidate({ repositoryRoot, metadataPath: metadataFile(), status: "candidate", now: new Date("2026-07-22T16:00:00Z") });
  assert.equal(candidate.releaseId, "relay-console-free-local-0.1.1-build-4");
  assert.equal(candidate.source.clean, true);
  assert.equal(candidate.authorization.publicPublication, false);
});
