#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(SCRIPT_PATH, "../..");
const RELEASE_ROOT = resolve(ROOT, "RelayConsoleSwift/Release");
const SCHEMA_PATH = resolve(RELEASE_ROOT, "free-local-release-candidate.schema.json");
const METADATA_PATH = resolve(ROOT, "RelayConsoleSwift/Sources/RelayConsoleCore/Resources/relay-console-release.json");
const DEFAULT_OUTPUT = resolve(RELEASE_ROOT, "free-local-release-candidate.json");
const REQUIRED_ACCEPTANCE = [
  "automated-release-gate",
  "schema-38-to-40-upgrade",
  "same-mac-hermes",
  "same-mac-openclaw",
  "signed-notarized-quarantined-install",
  "clean-supported-mac",
  "accessibility-smoke",
  "https-publication-and-checksum",
  "human-go-no-go",
];

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const schemaValidator = ajv.compile(json(SCHEMA_PATH));

function schemaErrors() {
  return (schemaValidator.errors ?? []).map((error) => {
    const location = error.instancePath || "$";
    if (error.keyword === "additionalProperties") {
      return `${location}: unsupported field ${error.params.additionalProperty}`;
    }
    return `${location}: ${error.message ?? error.keyword}`;
  });
}

function runGit(repositoryRoot, args) {
  return execFileSync("git", ["-C", repositoryRoot, ...args], { encoding: "utf8" }).trim();
}

export function freeLocalGitIdentity(repositoryRoot = ROOT) {
  return {
    branch: runGit(repositoryRoot, ["branch", "--show-current"]),
    commit: runGit(repositoryRoot, ["rev-parse", "HEAD"]),
    clean: runGit(repositoryRoot, ["status", "--porcelain", "--untracked-files=all"]) === "",
  };
}

function exactSet(left, right) {
  return JSON.stringify([...(left ?? [])].sort()) === JSON.stringify([...right].sort());
}

export function validateFreeLocalReleaseCandidateSchema(candidate) {
  const valid = schemaValidator(candidate);
  return { valid, errors: valid ? [] : schemaErrors() };
}

export function validateFreeLocalReleaseCandidate(candidate, requiredStatus = null, options = {}) {
  const errors = [];
  const schema = validateFreeLocalReleaseCandidateSchema(candidate);
  if (!schema.valid) errors.push(...schema.errors);

  if (requiredStatus && candidate?.status !== requiredStatus) {
    errors.push(`Free Local release status must be ${requiredStatus}.`);
  }

  const metadataPath = options.metadataPath ?? METADATA_PATH;
  let metadata;
  try {
    metadata = json(metadataPath);
  } catch (error) {
    errors.push(`Release metadata could not be read: ${error.message}`);
  }
  const macOS = candidate?.components?.macOS;
  if (metadata && macOS) {
    const comparisons = [
      ["version", metadata.version, macOS.version],
      ["build", metadata.build, macOS.build],
      ["bundle identifier", metadata.bundleIdentifier, macOS.bundleIdentifier],
      ["minimum macOS", metadata.minimumMacOSVersion, macOS.minimumOS],
      ["release channel", metadata.releaseChannel, macOS.releaseChannel],
    ];
    for (const [label, expected, actual] of comparisons) {
      if (actual !== expected) errors.push(`Free Local ${label} differs from relay-console-release.json.`);
    }
    const expectedReleaseId = `relay-console-free-local-${metadata.version}-build-${metadata.build}`;
    if (candidate.releaseId !== expectedReleaseId) errors.push("Free Local releaseId differs from the app version/build.");
  }

  if (!exactSet(candidate?.scope?.supportedRuntimes, ["hermes", "openclaw"])) {
    errors.push("Free Local must explicitly gate both same-Mac Hermes and same-Mac OpenClaw.");
  }
  if (!exactSet(candidate?.requiredAcceptance, REQUIRED_ACCEPTANCE)) {
    errors.push("Free Local required acceptance gates are incomplete or unexpected.");
  }
  if (candidate?.authorization?.publicPublication !== false) {
    errors.push("A build candidate must not authorize public publication.");
  }

  if (requiredStatus === "candidate") {
    if (candidate?.source?.clean !== true) errors.push("A Free Local candidate must record a clean source checkout.");
    const repositoryRoot = options.repositoryRoot ?? ROOT;
    try {
      const checkout = freeLocalGitIdentity(repositoryRoot);
      if (checkout.branch !== candidate?.source?.branch) errors.push("Release checkout branch differs from the Free Local candidate.");
      if (checkout.commit !== candidate?.source?.commit) errors.push("Release checkout HEAD differs from the Free Local candidate.");
      if (!checkout.clean) errors.push("Release checkout is dirty at candidate validation time.");
    } catch (error) {
      errors.push(`Release checkout identity could not be read: ${error.message}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function createFreeLocalReleaseCandidate({
  repositoryRoot = ROOT,
  metadataPath = METADATA_PATH,
  status = "draft",
  now = new Date(),
  architectures = ["arm64"],
} = {}) {
  if (!["draft", "candidate"].includes(status)) throw new Error("Free Local status must be draft or candidate.");
  const metadata = json(metadataPath);
  const source = freeLocalGitIdentity(repositoryRoot);
  if (status === "candidate" && !source.clean) throw new Error("A Free Local candidate can only be created from a clean checkout.");
  return {
    schemaVersion: "relay.free-local-release-candidate.v2",
    status,
    releaseId: `relay-console-free-local-${metadata.version}-build-${metadata.build}`,
    createdAt: now.toISOString(),
    source,
    product: {
      edition: "free-local",
      price: "free",
      cloudAccountRequired: false,
      paidEntitlementRequired: false,
      runtimeOwnership: "user-managed",
    },
    scope: {
      localConversations: true,
      localAgents: true,
      runtimeConnectivity: "same-mac-direct",
      supportedRuntimes: ["hermes", "openclaw"],
      marketplace: { mode: "local-preview", productionGuarantee: false },
      outOfScope: {
        relayCloud: true,
        relayConnect: true,
        webClient: true,
        iOS: true,
        managedRuntimeHosting: true,
        bridgePluginDistribution: true,
      },
    },
    components: {
      macOS: {
        version: metadata.version,
        build: metadata.build,
        bundleIdentifier: metadata.bundleIdentifier,
        minimumOS: metadata.minimumMacOSVersion,
        architectures,
        releaseChannel: metadata.releaseChannel,
      },
    },
    distribution: {
      method: "direct-download",
      artifact: "dmg",
      signing: "developer-id-hardened-runtime",
      notarization: "apple-notary-service",
      updatePolicy: "manual-signed",
    },
    requiredAcceptance: REQUIRED_ACCEPTANCE,
    authorization: {
      signedArtifactCreation: true,
      publicPublication: false,
      finalOwner: "human-release-owner",
    },
  };
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

function printValidation(result) {
  if (!result.valid) throw new Error(result.errors.join("\n"));
  process.stdout.write("Free Local release candidate validation passed\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.validate) {
    const candidate = json(resolve(String(options.validate)));
    const requiredStatus = typeof options.require === "string" ? options.require : null;
    printValidation(validateFreeLocalReleaseCandidate(candidate, requiredStatus));
    return;
  }

  const status = typeof options.status === "string" ? options.status : "draft";
  const output = resolve(typeof options.write === "string" ? options.write : DEFAULT_OUTPUT);
  const architecture = typeof options.architecture === "string" ? options.architecture : "arm64";
  const candidate = createFreeLocalReleaseCandidate({ status, architectures: architecture === "universal2" ? ["arm64", "x86_64"] : [architecture] });
  printValidation(validateFreeLocalReleaseCandidate(candidate, status === "candidate" ? "candidate" : null));
  writeFileSync(output, `${JSON.stringify(candidate, null, 2)}\n`);
  process.stdout.write(`${output}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
