#!/usr/bin/env node

import { createHash, createSign } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  lstatSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(SCRIPT_PATH, "../..");
const RELEASE_ROOT = resolve(ROOT, "RelayConsoleSwift/Release");
export const APP_STORE_CONNECT_ORIGIN = "https://api.appstoreconnect.apple.com";

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function compileSchema(name) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(json(resolve(RELEASE_ROOT, name)));
}

const macOSSchema = compileSchema("macos-distribution-evidence.schema.json");
const iOSSchema = compileSchema("ios-distribution-evidence.schema.json");

function formatSchemaErrors(validator) {
  return (validator.errors ?? []).map((error) => {
    const location = error.instancePath || "$";
    if (error.keyword === "additionalProperties") {
      return `${location}: unsupported field ${error.params.additionalProperty}`;
    }
    return `${location}: ${error.message ?? error.keyword}`;
  });
}

function exactArray(left, right) {
  return JSON.stringify([...(left ?? [])].sort()) === JSON.stringify([...(right ?? [])].sort());
}

function evidenceContext(candidate, candidateSHA256) {
  return {
    releaseId: candidate.releaseId,
    sourceCommit: candidate.source?.commit,
    candidateSHA256,
    candidateCreatedAt: candidate.createdAt,
    macOS: candidate.components?.macOS,
    iOS: candidate.components?.iOS,
  };
}

function validateCommon(evidence, context, schemaValidator) {
  const errors = [];
  if (!schemaValidator(evidence)) errors.push(...formatSchemaErrors(schemaValidator));
  if (evidence?.releaseId !== context.releaseId) errors.push("Distribution evidence releaseId differs from the authorized candidate.");
  if (evidence?.candidate?.sourceCommit !== context.sourceCommit) errors.push("Distribution evidence source commit differs from the authorized candidate.");
  if (evidence?.candidate?.manifestSHA256 !== context.candidateSHA256) errors.push("Distribution evidence candidate SHA-256 differs from the authorized candidate.");

  const capturedAt = Date.parse(evidence?.capturedAt ?? "");
  const candidateCreatedAt = Date.parse(context.candidateCreatedAt ?? "");
  if (!Number.isFinite(capturedAt)) errors.push("Distribution evidence capturedAt must be an ISO timestamp.");
  if (Number.isFinite(candidateCreatedAt) && Number.isFinite(capturedAt) && capturedAt < candidateCreatedAt - 300_000) {
    errors.push("Distribution evidence predates the authorized candidate.");
  }
  return errors;
}

export function validateMacOSDistributionEvidence(evidence, context) {
  const errors = validateCommon(evidence, context, macOSSchema);
  if (evidence?.artifact?.appVersion !== context.macOS?.version) errors.push("macOS artifact version differs from the release component.");
  if (evidence?.artifact?.appBuild !== context.macOS?.build) errors.push("macOS artifact build differs from the release component.");
  if (evidence?.artifact?.bundleIdentifier !== context.macOS?.bundleIdentifier) errors.push("macOS artifact bundle identifier differs from the release component.");
  if (evidence?.artifact?.minimumOS !== context.macOS?.minimumOS) errors.push("macOS artifact minimum OS differs from the release component.");
  if (!exactArray(evidence?.artifact?.architectures, context.macOS?.architectures)) errors.push("macOS artifact architectures differ from the release component.");
  return { valid: errors.length === 0, errors };
}

export function validateIOSDistributionEvidence(evidence, context) {
  const errors = validateCommon(evidence, context, iOSSchema);
  if (evidence?.archive?.appVersion !== context.iOS?.version) errors.push("iOS archive version differs from the release component.");
  if (evidence?.archive?.appBuild !== context.iOS?.build) errors.push("iOS archive build differs from the release component.");
  if (evidence?.archive?.bundleIdentifier !== context.iOS?.bundleIdentifier) errors.push("iOS archive bundle identifier differs from the release component.");
  if (evidence?.archive?.minimumOS !== context.iOS?.minimumOS) errors.push("iOS archive minimum OS differs from the release component.");
  if (evidence?.signing?.teamIdentifier !== evidence?.provisioning?.teamIdentifier) errors.push("iOS signing and provisioning team identifiers differ.");
  if (evidence?.provisioning?.applicationIdentifier !== `${evidence?.signing?.teamIdentifier}.${context.iOS?.bundleIdentifier}`) {
    errors.push("iOS provisioning application identifier differs from the signed app identity.");
  }
  if (evidence?.appStoreConnect?.marketingVersion !== evidence?.archive?.appVersion) errors.push("App Store Connect marketing version differs from the archive.");
  if (evidence?.appStoreConnect?.buildNumber !== evidence?.archive?.appBuild) errors.push("App Store Connect build number differs from the archive.");
  if (evidence?.appStoreConnect?.minimumOS !== evidence?.archive?.minimumOS) errors.push("App Store Connect minimum OS differs from the archive.");

  const capturedAt = Date.parse(evidence?.capturedAt ?? "");
  const uploadedAt = Date.parse(evidence?.appStoreConnect?.uploadedDate ?? "");
  const profileExpiresAt = Date.parse(evidence?.provisioning?.expirationDate ?? "");
  if (!Number.isFinite(uploadedAt) || (Number.isFinite(capturedAt) && uploadedAt > capturedAt + 300_000)) {
    errors.push("App Store Connect upload time is invalid or later than evidence capture.");
  }
  if (!Number.isFinite(profileExpiresAt) || (Number.isFinite(capturedAt) && profileExpiresAt <= capturedAt)) {
    errors.push("The iOS distribution profile is expired at evidence capture.");
  }
  return { valid: errors.length === 0, errors };
}

export function hashTree(root) {
  const digest = createHash("sha256");
  function visit(path) {
    const name = relative(root, path).replaceAll("\\", "/") || ".";
    const stat = lstatSync(path);
    if (stat.isDirectory()) {
      digest.update(`directory\0${name}\0`);
      for (const entry of readdirSync(path).sort()) visit(join(path, entry));
    } else if (stat.isSymbolicLink()) {
      digest.update(`symlink\0${name}\0${readlinkSync(path)}\0`);
    } else if (stat.isFile()) {
      digest.update(`file\0${name}\0`);
      digest.update(readFileSync(path));
      digest.update("\0");
    } else {
      throw new Error(`Unsupported archive entry type: ${name}`);
    }
  }
  visit(root);
  return digest.digest("hex");
}

function plist(path) {
  return JSON.parse(execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", path], { encoding: "utf8" }));
}

function mobileProvision(path) {
  const xml = execFileSync("/usr/bin/security", ["cms", "-D", "-i", path]);
  return JSON.parse(execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", "-"], { input: xml, encoding: "utf8" }));
}

function codesignDetails(path) {
  const result = spawnSync("/usr/bin/codesign", ["-dv", "--verbose=4", path], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("The archive signing details could not be read.");
  const value = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const authority = value.match(/^Authority=(.+)$/m)?.[1] ?? null;
  const teamIdentifier = value.match(/^TeamIdentifier=(.+)$/m)?.[1] ?? null;
  const appCDHash = value.match(/^CDHash=([A-Fa-f0-9]+)$/m)?.[1] ?? null;
  if (!authority || !teamIdentifier || !appCDHash) throw new Error("The signed archive lacks authority, team, or CDHash details.");
  return { authority, teamIdentifier, appCDHash };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) throw new Error(`Unexpected argument: ${value}`);
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) options[key] = true;
    else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}

function requiredOption(options, name) {
  const value = options[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`--${name} is required.`);
  return resolve(value);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

export function createAppStoreConnectToken({ issuerId, keyId, privateKey, now = Date.now() }) {
  const issuedAt = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: issuerId,
    iat: issuedAt,
    exp: issuedAt + 600,
    aud: "appstoreconnect-v1",
  }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign({ key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${unsigned}.${signature}`;
}

async function apiJSON(path, token, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(`${APP_STORE_CONNECT_ORIGIN}${path}`, {
    redirect: "error",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`App Store Connect ${path.split("?")[0]} returned HTTP ${response.status}.`);
  return response.json();
}

export function selectAppStoreBuild(appResponse, buildResponse, expected) {
  const apps = Array.isArray(appResponse?.data) ? appResponse.data : [];
  if (apps.length !== 1) throw new Error("App Store Connect did not return one Relay Console app.");
  const app = apps[0];
  if (app.type !== "apps" || app.attributes?.bundleId !== expected.bundleIdentifier) {
    throw new Error("App Store Connect returned a different bundle identifier.");
  }
  const builds = Array.isArray(buildResponse?.data) ? buildResponse.data : [];
  if (builds.length !== 1) throw new Error("App Store Connect did not return one exact version/build record.");
  const build = builds[0];
  if (build.type !== "builds" || build.attributes?.version !== expected.build) {
    throw new Error("App Store Connect returned a different build number.");
  }
  if (build.relationships?.app?.data?.id !== app.id) throw new Error("The App Store Connect build belongs to a different app.");
  const prereleaseId = build.relationships?.preReleaseVersion?.data?.id;
  const prerelease = (buildResponse.included ?? []).find((item) => item.type === "preReleaseVersions" && item.id === prereleaseId);
  if (!prerelease || prerelease.attributes?.version !== expected.version || prerelease.attributes?.platform !== "IOS") {
    throw new Error("The App Store Connect build belongs to a different iOS marketing version.");
  }
  return { app, build, prerelease };
}

async function captureIOS({ candidate, candidatePath, archivePath, env = process.env, fetchImpl = globalThis.fetch }) {
  if (candidate.status !== "candidate") throw new Error("iOS distribution evidence must be captured from a candidate manifest.");
  const { validateReleaseCandidate } = await import("./release-candidate-manifest.mjs");
  const candidateValidation = validateReleaseCandidate(candidate, "candidate", { repositoryRoot: ROOT });
  if (!candidateValidation.valid) throw new Error(`Candidate validation failed: ${candidateValidation.errors.join(" ")}`);

  const archiveInfo = plist(resolve(archivePath, "Info.plist"));
  const applicationPath = archiveInfo.ApplicationProperties?.ApplicationPath;
  if (typeof applicationPath !== "string" || !applicationPath.endsWith(".app")) throw new Error("The xcarchive does not identify an application bundle.");
  const appPath = resolve(archivePath, "Products", "Applications", basename(applicationPath));
  const appInfo = plist(resolve(appPath, "Info.plist"));
  const executable = resolve(appPath, appInfo.CFBundleExecutable);
  const architectures = execFileSync("/usr/bin/lipo", ["-archs", executable], { encoding: "utf8" }).trim().split(/\s+/).filter(Boolean);
  execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", appPath], { stdio: "pipe" });
  const signing = codesignDetails(appPath);
  if (!/^(?:Apple Distribution|iPhone Distribution):/.test(signing.authority)) throw new Error("The archive does not use an Apple distribution certificate.");

  const profile = mobileProvision(resolve(appPath, "embedded.mobileprovision"));
  const profileTeam = profile.TeamIdentifier?.[0];
  const applicationIdentifier = profile.Entitlements?.["application-identifier"];
  if (profileTeam !== signing.teamIdentifier) throw new Error("The archive signer and provisioning profile use different teams.");
  if (profile.Entitlements?.["get-task-allow"] !== false) throw new Error("The archive provisioning profile permits debugging.");
  if (Array.isArray(profile.ProvisionedDevices) && profile.ProvisionedDevices.length > 0) throw new Error("The archive uses a device-scoped provisioning profile.");
  if (profile.ProvisionsAllDevices === true) throw new Error("The archive uses an enterprise provisioning profile.");

  const keyId = env.RELAY_APP_STORE_CONNECT_KEY_ID?.trim();
  const issuerId = env.RELAY_APP_STORE_CONNECT_ISSUER_ID?.trim();
  const privateKeyPath = env.RELAY_APP_STORE_CONNECT_PRIVATE_KEY_PATH?.trim();
  if (!keyId || !issuerId || !privateKeyPath) {
    throw new Error("RELAY_APP_STORE_CONNECT_KEY_ID, RELAY_APP_STORE_CONNECT_ISSUER_ID, and RELAY_APP_STORE_CONNECT_PRIVATE_KEY_PATH are required.");
  }
  const token = createAppStoreConnectToken({ issuerId, keyId, privateKey: readFileSync(resolve(privateKeyPath), "utf8") });
  const expected = {
    bundleIdentifier: appInfo.CFBundleIdentifier,
    version: appInfo.CFBundleShortVersionString,
    build: appInfo.CFBundleVersion,
  };
  const appParams = new URLSearchParams({
    "filter[bundleId]": expected.bundleIdentifier,
    "fields[apps]": "name,bundleId",
    limit: "2",
  });
  const buildParams = new URLSearchParams({
    "filter[app]": "__APP_ID__",
    "filter[version]": expected.build,
    "filter[preReleaseVersion.version]": expected.version,
    "filter[preReleaseVersion.platform]": "IOS",
    include: "preReleaseVersion",
    "fields[builds]": "version,uploadedDate,expirationDate,expired,minOsVersion,processingState,buildAudienceType,usesNonExemptEncryption,preReleaseVersion,app",
    "fields[preReleaseVersions]": "version,platform",
    limit: "2",
  });
  const appResponse = await apiJSON(`/v1/apps?${appParams}`, token, fetchImpl);
  const appId = appResponse?.data?.[0]?.id;
  if (!appId) throw new Error("App Store Connect did not return the Relay Console app ID.");
  buildParams.set("filter[app]", appId);
  const buildResponse = await apiJSON(`/v1/builds?${buildParams}`, token, fetchImpl);
  const selected = selectAppStoreBuild(appResponse, buildResponse, expected);
  const capturedAt = new Date().toISOString();
  const evidence = {
    schemaVersion: "relay.ios-distribution-evidence.v1",
    releaseId: candidate.releaseId,
    capturedAt,
    candidate: {
      sourceCommit: candidate.source.commit,
      manifestSHA256: sha256File(candidatePath),
    },
    archive: {
      name: basename(archivePath),
      appBundleSHA256: hashTree(appPath),
      appVersion: expected.version,
      appBuild: expected.build,
      bundleIdentifier: expected.bundleIdentifier,
      minimumOS: appInfo.MinimumOSVersion,
      architectures,
    },
    signing: {
      ...signing,
      strictVerificationPassed: true,
      distributionSignature: true,
    },
    provisioning: {
      profileUUID: profile.UUID,
      profileName: profile.Name,
      teamIdentifier: profileTeam,
      applicationIdentifier,
      expirationDate: new Date(profile.ExpirationDate).toISOString(),
      getTaskAllow: false,
      hasProvisionedDevices: false,
      provisionsAllDevices: false,
    },
    appStoreConnect: {
      apiOrigin: APP_STORE_CONNECT_ORIGIN,
      appId: selected.app.id,
      buildId: selected.build.id,
      processingState: selected.build.attributes.processingState,
      buildAudienceType: selected.build.attributes.buildAudienceType,
      uploadedDate: selected.build.attributes.uploadedDate,
      expired: selected.build.attributes.expired,
      minimumOS: selected.build.attributes.minOsVersion,
      marketingVersion: selected.prerelease.attributes.version,
      buildNumber: selected.build.attributes.version,
    },
  };
  const validation = validateIOSDistributionEvidence(evidence, evidenceContext(candidate, sha256File(candidatePath)));
  if (!validation.valid) throw new Error(`iOS evidence validation failed: ${validation.errors.join(" ")}`);
  return evidence;
}

function readCandidate(path) {
  const candidate = json(path);
  return { candidate, context: evidenceContext(candidate, sha256File(path)) };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const candidatePath = requiredOption(options, "candidate");
  const { candidate, context } = readCandidate(candidatePath);
  if (options["validate-macos"]) {
    const result = validateMacOSDistributionEvidence(json(resolve(String(options["validate-macos"]))), context);
    for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
    if (!result.valid) process.exitCode = 1;
    else process.stdout.write("macOS distribution evidence valid.\n");
    return;
  }
  if (options["validate-ios"]) {
    const result = validateIOSDistributionEvidence(json(resolve(String(options["validate-ios"]))), context);
    for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
    if (!result.valid) process.exitCode = 1;
    else process.stdout.write("iOS distribution evidence valid.\n");
    return;
  }
  if (options["capture-ios"]) {
    const archivePath = requiredOption(options, "archive");
    const outputPath = requiredOption(options, "output");
    const evidence = await captureIOS({ candidate, candidatePath, archivePath });
    writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`${outputPath}\n`);
    return;
  }
  throw new Error("Use --validate-macos, --validate-ios, or --capture-ios.");
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
