#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadCanonicalMarketplaceReleaseManifest,
} from "./marketplace-release-manifest.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SCRIPT_PATH), "..");

export const MARKETPLACE_PROVIDER_REQUIREMENTS_PATH = resolve(
  ROOT,
  "packages/marketplace-catalog/release/marketplace-provider-requirements.json",
);

const PROVIDER_ROOT = resolve(ROOT, "packages/marketplace-catalog/providers");
const REGISTER_SCHEMA_VERSION = "relay.marketplace-provider-requirements.v1";
const REQUIREMENT_KEYS = Object.freeze([
  "providerReview",
  "quota",
  "paidPlan",
  "customerAdmin",
]);
const REQUIREMENT_STATUSES = Object.freeze({
  providerReview: new Set([
    "required_or_pending",
    "explicitly_not_required",
    "not_identified_verify_before_live",
  ]),
  quota: new Set([
    "documented_or_provider_specific",
    "not_identified_verify_before_live",
  ]),
  paidPlan: new Set([
    "required_or_plan_gated",
    "explicitly_not_required",
    "not_identified_verify_before_live",
  ]),
  customerAdmin: new Set([
    "required_or_owner_controlled",
    "not_identified_verify_before_live",
  ]),
});

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalized(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sourceFragments(provider) {
  const fragments = [];
  const add = (field, value) => {
    if (typeof value === "string" && value.trim()) {
      fragments.push({ field, text: value.trim() });
    }
  };
  add("providerSetup.status", provider.providerSetup?.status);
  add("providerSetup.blocker", provider.providerSetup?.blocker);
  add("providerSetup.nextAction", provider.providerSetup?.nextAction);
  (provider.evidence ?? []).forEach((entry, index) => {
    add(`evidence[${index}].supports`, entry?.supports);
  });
  (provider.securityNotes ?? []).forEach((entry, index) => {
    add(`securityNotes[${index}]`, entry);
  });
  return fragments;
}

function matchingFields(fragments, expression) {
  return fragments
    .filter(({ text }) => expression.test(text))
    .map(({ field }) => field);
}

function requirement(status, basisFields) {
  return {
    status,
    basisFields: [...new Set(basisFields)].sort(),
    acceptanceRequired: status !== "explicitly_not_required",
  };
}

export function classifyProviderRequirements(provider) {
  const fragments = sourceFragments(provider);
  const reviewNotRequired = matchingFields(
    fragments,
    /\b(?:no|does not require|without) (?:separate )?(?:provider |app |partner )?(?:review|approval)\b/i,
  );
  const reviewRequired = matchingFields(
    fragments,
    /\b(?:provider review|app review|partner approval|provider approval|application approval|security review|review pending|approval required)\b/i,
  );
  const quota = matchingFields(
    fragments,
    /\b(?:quota|quotas|rate[- ]?limit|rate limits|throttl(?:e|ing|ed))\b/i,
  );
  const paidNotRequired = matchingFields(
    fragments,
    /\b(?:no (?:paid plan|purchase|subscription) (?:is )?required|available on (?:the )?free plan|free plan access)\b/i,
  );
  const paidRequired = matchingFields(
    fragments,
    /\b(?:paid plan|paid tier|paid account|enterprise plan|enterprise account|premium plan|subscription required|api add-on|eligible plan|plan-gated|plan gated)\b/i,
  );
  const customerAdmin = matchingFields(
    fragments,
    /\b(?:customer admin|organization admin|organisation admin|workspace admin|account admin|room admin|customer owner|account owner|organization owner|organisation owner|workspace owner|authorized owner|authorised owner|administrator)\b/i,
  );

  return {
    providerReview: reviewNotRequired.length
      ? requirement("explicitly_not_required", reviewNotRequired)
      : reviewRequired.length || /review|approval/.test(provider.providerSetup?.status ?? "")
        ? requirement("required_or_pending", [
          ...reviewRequired,
          ...(reviewRequired.length ? [] : ["providerSetup.status"]),
        ])
        : requirement("not_identified_verify_before_live", []),
    quota: quota.length
      ? requirement("documented_or_provider_specific", quota)
      : requirement("not_identified_verify_before_live", []),
    paidPlan: paidNotRequired.length
      ? requirement("explicitly_not_required", paidNotRequired)
      : paidRequired.length
        ? requirement("required_or_plan_gated", paidRequired)
        : requirement("not_identified_verify_before_live", []),
    customerAdmin: customerAdmin.length
      ? requirement("required_or_owner_controlled", customerAdmin)
      : requirement("not_identified_verify_before_live", []),
  };
}

function providerRecord(decision) {
  const sourcePath = resolve(PROVIDER_ROOT, decision.slug, "manifest.json");
  const provider = json(sourcePath);
  if (provider.slug !== decision.slug) {
    throw new Error(`Provider slug mismatch for ${decision.slug}.`);
  }
  return {
    slug: provider.slug,
    name: provider.name,
    reviewedAt: decision.reviewedAt,
    sourceManifest: `packages/marketplace-catalog/providers/${provider.slug}/manifest.json`,
    authenticationModel: provider.authentication?.model ?? "unknown",
    credentialFieldNames: (provider.connection?.credentialRequirements ?? [])
      .map(({ name }) => name)
      .filter((name) => typeof name === "string" && name.trim())
      .sort(),
    providerSetup: {
      status: provider.providerSetup?.status ?? "not_recorded",
      blocker: provider.providerSetup?.blocker ?? null,
      nextAction: provider.providerSetup?.nextAction ?? null,
    },
    requirements: classifyProviderRequirements(provider),
    evidenceURLs: (provider.evidence ?? [])
      .map(({ url }) => url)
      .filter((url) => typeof url === "string" && url.startsWith("https://"))
      .sort(),
    liveVerified: decision.liveVerified,
    liveAcceptanceDisposition: "required_before_live_verified",
  };
}

function requirementCounts(providers, key) {
  return Object.fromEntries(
    [...REQUIREMENT_STATUSES[key]].map((status) => [
      status,
      providers.filter((provider) => provider.requirements[key].status === status).length,
    ]),
  );
}

export function buildMarketplaceProviderRequirements(releaseManifest) {
  const providers = releaseManifest.providers.map(providerRecord);
  return {
    schemaVersion: REGISTER_SCHEMA_VERSION,
    registerVersion: `${releaseManifest.manifestVersion}.requirements.1`,
    generatedFrom: {
      releaseManifest: "packages/marketplace-catalog/release/marketplace-release-manifest.json",
      manifestVersion: releaseManifest.manifestVersion,
      freezeStatus: releaseManifest.freeze.status,
      frozenAt: releaseManifest.freeze.frozenAt,
      sourceRevision: releaseManifest.freeze.sourceRevision,
    },
    policy: {
      unknownIsNotApproval: true,
      liveAcceptanceRequired: true,
      description: "A requirement not identified in current provider documentation remains a live-acceptance check. It is never treated as absent or waived.",
    },
    privacy: {
      credentialValuesIncluded: false,
      customerIdentifiersIncluded: false,
      customerContentIncluded: false,
      providerResponseBodiesIncluded: false,
      privateConsoleOutputIncluded: false,
    },
    summary: {
      cohortCount: providers.length,
      liveVerifiedCount: providers.filter(({ liveVerified }) => liveVerified).length,
      providerReview: requirementCounts(providers, "providerReview"),
      quota: requirementCounts(providers, "quota"),
      paidPlan: requirementCounts(providers, "paidPlan"),
      customerAdmin: requirementCounts(providers, "customerAdmin"),
    },
    providers,
  };
}

export function validateMarketplaceProviderRequirements(register, releaseManifest) {
  const errors = [];
  if (register?.schemaVersion !== REGISTER_SCHEMA_VERSION) {
    errors.push("Unsupported Marketplace provider requirements schemaVersion.");
  }
  if (register?.generatedFrom?.manifestVersion !== releaseManifest.manifestVersion) {
    errors.push("Requirements register manifestVersion differs from the release manifest.");
  }
  if (register?.generatedFrom?.sourceRevision !== releaseManifest.freeze.sourceRevision) {
    errors.push("Requirements register sourceRevision differs from the release manifest.");
  }
  if (register?.policy?.unknownIsNotApproval !== true || register?.policy?.liveAcceptanceRequired !== true) {
    errors.push("Requirements register must fail closed for unknown and unaccepted requirements.");
  }
  if (
    !register?.privacy ||
    Object.values(register.privacy).some((value) => value !== false)
  ) {
    errors.push("Requirements register privacy flags must exclude private values and content.");
  }
  if (!Array.isArray(register?.providers)) {
    errors.push("Requirements register providers must be an array.");
    return { valid: false, errors };
  }
  const expectedSlugs = releaseManifest.providers.map(({ slug }) => slug);
  const actualSlugs = register.providers.map(({ slug }) => slug);
  if (JSON.stringify(actualSlugs) !== JSON.stringify(expectedSlugs)) {
    errors.push("Requirements register must exactly match the ordered launch cohort.");
  }
  register.providers.forEach((provider, index) => {
    const location = `providers[${index}]`;
    if (provider.liveVerified !== false) {
      errors.push(`${location} cannot claim live verification.`);
    }
    if (provider.liveAcceptanceDisposition !== "required_before_live_verified") {
      errors.push(`${location} must require live acceptance.`);
    }
    if (!Array.isArray(provider.credentialFieldNames)) {
      errors.push(`${location}.credentialFieldNames must be an array.`);
    }
    if (!Array.isArray(provider.evidenceURLs) || provider.evidenceURLs.length === 0) {
      errors.push(`${location} must cite provider evidence URLs.`);
    }
    for (const key of REQUIREMENT_KEYS) {
      const entry = provider.requirements?.[key];
      if (!entry || !REQUIREMENT_STATUSES[key].has(entry.status)) {
        errors.push(`${location}.requirements.${key} has an unsupported status.`);
      }
      if (!Array.isArray(entry?.basisFields)) {
        errors.push(`${location}.requirements.${key}.basisFields must be an array.`);
      }
      if (entry?.status?.startsWith("not_identified") && entry.acceptanceRequired !== true) {
        errors.push(`${location}.requirements.${key} must fail closed when not identified.`);
      }
    }
  });
  if (register.summary?.cohortCount !== expectedSlugs.length) {
    errors.push("Requirements register summary cohort count is incorrect.");
  }
  if (register.summary?.liveVerifiedCount !== 0) {
    errors.push("Requirements register summary cannot claim live verification.");
  }
  return { valid: errors.length === 0, errors };
}

export function loadMarketplaceProviderRequirements() {
  return json(MARKETPLACE_PROVIDER_REQUIREMENTS_PATH);
}

export function checkMarketplaceProviderRequirementsRegister(releaseManifest) {
  let register;
  try {
    register = loadMarketplaceProviderRequirements();
  } catch (error) {
    return { valid: false, errors: [`Requirements register is missing or unreadable: ${error.message}`] };
  }
  const validation = validateMarketplaceProviderRequirements(register, releaseManifest);
  const expected = buildMarketplaceProviderRequirements(releaseManifest);
  if (normalized(register) !== normalized(expected)) {
    validation.errors.push("Requirements register is stale relative to the provider manifests.");
  }
  return { valid: validation.errors.length === 0, errors: validation.errors };
}

function main() {
  const releaseManifest = loadCanonicalMarketplaceReleaseManifest();
  const expected = buildMarketplaceProviderRequirements(releaseManifest);
  const validation = validateMarketplaceProviderRequirements(expected, releaseManifest);
  if (!validation.valid) {
    throw new Error(validation.errors.join("\n"));
  }
  if (process.argv.includes("--sync")) {
    writeFileSync(MARKETPLACE_PROVIDER_REQUIREMENTS_PATH, normalized(expected));
  }
  const current = checkMarketplaceProviderRequirementsRegister(releaseManifest);
  if (!current.valid) throw new Error(current.errors.join("\n"));
  const counts = expected.summary;
  process.stdout.write(
    `Validated ${counts.cohortCount} provider requirement records; ${counts.liveVerifiedCount} live verified and every unknown remains acceptance-gated.\n`,
  );
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
