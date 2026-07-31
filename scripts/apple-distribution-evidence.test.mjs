import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import {
  APP_STORE_CONNECT_ORIGIN,
  createAppStoreConnectToken,
  hashTree,
  selectAppStoreBuild,
  validateIOSDistributionEvidence,
  validateMacOSDistributionEvidence,
} from "./apple-distribution-evidence.mjs";

const context = {
  releaseId: "relay-console-0.1.0-rc1",
  sourceCommit: "a".repeat(40),
  candidateSHA256: "b".repeat(64),
  candidateCreatedAt: "2026-07-15T05:00:00.000Z",
  macOS: {
    version: "0.1.0",
    build: "1",
    bundleIdentifier: "com.relayconsole.app",
    minimumOS: "14.0",
    architectures: ["arm64"],
  },
  iOS: {
    version: "1.0",
    build: "1",
    bundleIdentifier: "com.relayconsole.app",
    minimumOS: "18.0",
  },
};

function common() {
  return {
    releaseId: context.releaseId,
    capturedAt: "2026-07-15T06:00:00.000Z",
    candidate: {
      sourceCommit: context.sourceCommit,
      manifestSHA256: context.candidateSHA256,
    },
  };
}

function macOS() {
  return {
    schemaVersion: "relay.macos-distribution-evidence.v1",
    ...common(),
    artifact: {
      fileName: "RelayConsole-public-beta.dmg",
      dmgSHA256: "c".repeat(64),
      dmgSizeBytes: 1024,
      appVersion: "0.1.0",
      appBuild: "1",
      bundleIdentifier: "com.relayconsole.app",
      minimumOS: "14.0",
      architectures: ["arm64"],
      mainExecutableSHA256: "d".repeat(64),
      bridgeExecutableSHA256: "e".repeat(64),
    },
    signing: {
      mode: "developer-id-hardened-runtime",
      authority: "Developer ID Application: Relay Console Ltd (A1B2C3D4E5)",
      teamIdentifier: "A1B2C3D4E5",
      appCDHash: "1".repeat(40),
      timestamped: true,
      hardenedRuntime: true,
      nestedExecutablesVerified: true,
      appVerified: true,
      dmgVerified: true,
    },
    notarization: {
      appSubmissionId: "123e4567-e89b-42d3-a456-426614174000",
      appStatus: "Accepted",
      appSubmissionSHA256: "f".repeat(64),
      dmgSubmissionId: "123e4567-e89b-42d3-a456-426614174001",
      dmgStatus: "Accepted",
      dmgSubmissionSHA256: "2".repeat(64),
      appStapleValidated: true,
      dmgStapleValidated: true,
    },
    gatekeeper: {
      appAccepted: true,
      dmgAccepted: true,
      quarantinedMountSignatureVerified: true,
      quarantinedMountGatekeeperAccepted: true,
    },
  };
}

function iOS() {
  return {
    schemaVersion: "relay.ios-distribution-evidence.v1",
    ...common(),
    archive: {
      name: "RelayConsole.xcarchive",
      appBundleSHA256: "c".repeat(64),
      appVersion: "1.0",
      appBuild: "1",
      bundleIdentifier: "com.relayconsole.app",
      minimumOS: "18.0",
      architectures: ["arm64"],
    },
    signing: {
      authority: "Apple Distribution: Relay Console Ltd (A1B2C3D4E5)",
      teamIdentifier: "A1B2C3D4E5",
      appCDHash: "1".repeat(40),
      strictVerificationPassed: true,
      distributionSignature: true,
    },
    provisioning: {
      profileUUID: "123e4567-e89b-42d3-a456-426614174002",
      profileName: "Relay Console App Store",
      teamIdentifier: "A1B2C3D4E5",
      applicationIdentifier: "A1B2C3D4E5.com.relayconsole.app",
      expirationDate: "2027-07-15T06:00:00.000Z",
      getTaskAllow: false,
      hasProvisionedDevices: false,
      provisionsAllDevices: false,
    },
    appStoreConnect: {
      apiOrigin: APP_STORE_CONNECT_ORIGIN,
      appId: "app-1",
      buildId: "build-1",
      processingState: "VALID",
      buildAudienceType: "APP_STORE_ELIGIBLE",
      uploadedDate: "2026-07-15T05:50:00.000Z",
      expired: false,
      minimumOS: "18.0",
      marketingVersion: "1.0",
      buildNumber: "1",
    },
  };
}

test("accepts exact Developer ID/notarization and App Store distribution records", () => {
  assert.deepEqual(validateMacOSDistributionEvidence(macOS(), context), { valid: true, errors: [] });
  assert.deepEqual(validateIOSDistributionEvidence(iOS(), context), { valid: true, errors: [] });
});

test("rejects substituted artifacts, ad-hoc claims, debug profiles, and arbitrary iOS labels", () => {
  const mac = macOS();
  mac.candidate.sourceCommit = "9".repeat(40);
  mac.signing.mode = "ad-hoc-hardened-runtime";
  mac.notarization.dmgStatus = "Invalid";
  const macResult = validateMacOSDistributionEvidence(mac, context);
  assert.equal(macResult.valid, false);
  assert.match(macResult.errors.join("\n"), /source commit differs|developer-id-hardened-runtime|Accepted/);

  const ios = iOS();
  ios.archive.appBuild = "arbitrary-label";
  ios.provisioning.getTaskAllow = true;
  ios.appStoreConnect.processingState = "PROCESSING";
  const iosResult = validateIOSDistributionEvidence(ios, context);
  assert.equal(iosResult.valid, false);
  assert.match(iosResult.errors.join("\n"), /archive build differs|false|VALID/);
});

test("schemas reject unsupported evidence fields", () => {
  const mac = macOS();
  mac.signing.privateKey = "must-not-pass";
  assert.match(validateMacOSDistributionEvidence(mac, context).errors.join("\n"), /unsupported field privateKey/);
  const ios = iOS();
  ios.appStoreConnect.token = "must-not-pass";
  assert.match(validateIOSDistributionEvidence(ios, context).errors.join("\n"), /unsupported field token/);
});

test("selects only the exact App Store Connect app, build, and iOS prerelease version", () => {
  const appResponse = {
    data: [{ type: "apps", id: "app-1", attributes: { bundleId: "com.relayconsole.app" } }],
  };
  const buildResponse = {
    data: [{
      type: "builds",
      id: "build-1",
      attributes: { version: "1" },
      relationships: {
        app: { data: { type: "apps", id: "app-1" } },
        preReleaseVersion: { data: { type: "preReleaseVersions", id: "pre-1" } },
      },
    }],
    included: [{ type: "preReleaseVersions", id: "pre-1", attributes: { version: "1.0", platform: "IOS" } }],
  };
  assert.equal(selectAppStoreBuild(appResponse, buildResponse, {
    bundleIdentifier: "com.relayconsole.app",
    version: "1.0",
    build: "1",
  }).build.id, "build-1");

  buildResponse.included[0].attributes.platform = "MAC_OS";
  assert.throws(() => selectAppStoreBuild(appResponse, buildResponse, {
    bundleIdentifier: "com.relayconsole.app",
    version: "1.0",
    build: "1",
  }), /different iOS marketing version/);
});

test("creates a short-lived ES256 App Store Connect token without embedding the private key", () => {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ format: "pem", type: "pkcs8" });
  const token = createAppStoreConnectToken({
    issuerId: "issuer-1",
    keyId: "KEY1234567",
    privateKey: pem,
    now: Date.parse("2026-07-15T06:00:00.000Z"),
  });
  const [header, payload, signature] = token.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url")), { alg: "ES256", kid: "KEY1234567", typ: "JWT" });
  const claims = JSON.parse(Buffer.from(payload, "base64url"));
  assert.equal(claims.aud, "appstoreconnect-v1");
  assert.equal(claims.exp - claims.iat, 600);
  assert.equal(Buffer.from(signature, "base64url").length, 64);
  assert.doesNotMatch(token, /PRIVATE KEY/);
});

test("hashTree binds file names, bytes, and symlink targets", () => {
  const root = mkdtempSync(join(tmpdir(), "relay-ios-archive-hash-"));
  try {
    mkdirSync(join(root, "Payload"));
    writeFileSync(join(root, "Payload", "Info.plist"), "one");
    const first = hashTree(root);
    writeFileSync(join(root, "Payload", "Info.plist"), "two");
    assert.notEqual(hashTree(root), first);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
