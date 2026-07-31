import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const sourceDirectory = path.join(
  repositoryRoot,
  "RelayConsoleSwift/Sources/RelayConsoleCore",
);
const readSource = (file) =>
  readFileSync(path.join(sourceDirectory, file), "utf8");
const lineCount = (source) => source.split("\n").length - 1;
const adapterFiles = readdirSync(sourceDirectory)
  .filter((file) => /^ProviderConnectionService\+.*\.swift$/.test(file))
  .sort();
const supportFiles = new Set([
  "ProviderConnectionService+Orchestration.swift",
  "ProviderConnectionService+Presentation.swift",
  "ProviderConnectionService+ProviderPolicy.swift",
  "ProviderConnectionService+ValidationPolicy.swift",
]);
const familyFiles = new Map([
  ["social", ["SocialA", "SocialB"]],
  [
    "google",
    [
      "GoogleCredentialsA",
      "GoogleCredentialsB",
      "GoogleGmail",
      "GoogleRelayA",
      "GoogleRelayB",
      "GoogleRelayC",
    ],
  ],
  ["microsoft", ["MicrosoftA", "MicrosoftB"]],
  ["communications", ["Communications", "LinkedIn"]],
  [
    "developer-collaboration",
    ["DeveloperCollaboration", "DeveloperTelemetry"],
  ],
  ["work-management", ["WorkManagement"]],
  ["commerce-finance", ["CommerceFinance"]],
  ["crm-support", ["CRMAndSupport"]],
  ["work-signature", ["WorkAndSignature"]],
  ["marketing", ["MarketingAndContent", "MarketingAndSocial"]],
  ["push-data", ["PushAndData"]],
  ["observability", ["CredentialHealth", "Observability"]],
  ["infrastructure-hr", ["InfrastructureAndHR"]],
  ["legal", ["Legal"]],
]);
const railwayManagedFamilySlugs = new Map([
  ["social", new Set(["eventbrite", "meetup", "nextdoor"])],
  [
    "communications",
    new Set([
      "dialpad",
      "goto-meeting",
      "line",
      "ringcentral",
      "twist",
      "webex",
      "zoho-mail",
    ]),
  ],
]);

function parseProductionAdapters() {
  const source = readSource("ProviderConnectionAdapterRegistry.swift");
  const adapters = new Map();
  const pattern =
    /ProviderConnectionFamilyAdapter\(\s*id: "([^"]+)",\s*providerSlugs: \[([\s\S]*?)\](?:,\s*railwayManagedProviderSlugs: \[([\s\S]*?)\])?\)/g;
  for (const match of source.matchAll(pattern)) {
    const nativeSlugs = new Set(
      [...match[2].matchAll(/"([^"]+)"/g)].map((slugMatch) => slugMatch[1]),
    );
    const railwayManagedSlugs = new Set(
      [...(match[3] ?? "").matchAll(/"([^"]+)"/g)].map(
        (slugMatch) => slugMatch[1],
      ),
    );
    assert.equal(adapters.has(match[1]), false, `duplicate adapter ID ${match[1]}`);
    adapters.set(match[1], {
      nativeSlugs,
      railwayManagedSlugs,
      slugs: new Set([...nativeSlugs, ...railwayManagedSlugs]),
    });
  }
  return adapters;
}

function fallbackSlugs(file) {
  return new Set(
    [...readSource(file).matchAll(/fallbackSlug:\s*"([^"]+)"/g)].map(
      (match) => match[1],
    ),
  );
}

test("provider connection root and family adapters stay bounded", () => {
  const root = readSource("ProviderConnectionService.swift");
  assert.ok(lineCount(root) < 5_000, "root provider connection service exceeded 5,000 lines");
  assert.equal(
    /fallbackSlug:\s*"/.test(root),
    false,
    "provider-specific connection behavior returned to the root service",
  );
  for (const file of [
    "ProviderConnectionValidators.swift",
    "ProviderConnectionAdapterRegistry.swift",
    "ProviderConnectionApprovalRegistry.swift",
    ...adapterFiles,
  ]) {
    assert.ok(
      lineCount(readSource(file)) < 2_000,
      `${file} exceeded the 2,000-line adapter limit`,
    );
  }
});

test("every provider connection slug has exactly one family adapter", () => {
  const adapters = parseProductionAdapters();
  assert.deepEqual(
    [...adapters.keys()].sort(),
    [...familyFiles.keys()].sort(),
    "production adapter IDs do not match the family extraction map",
  );

  const mappedFiles = new Set();
  const expectedOwners = new Map();
  for (const [familyID, familyParts] of familyFiles) {
    const expectedSlugs = new Set();
    for (const part of familyParts) {
      const file = `ProviderConnectionService+${part}.swift`;
      mappedFiles.add(file);
      for (const slug of fallbackSlugs(file)) expectedSlugs.add(slug);
    }
    const adapter = adapters.get(familyID);
    assert.deepEqual(
      [...adapter.nativeSlugs].sort(),
      [...expectedSlugs].sort(),
      `${familyID} native registry slugs do not match its implementation files`,
    );
    assert.deepEqual(
      [...adapter.railwayManagedSlugs].sort(),
      [...(railwayManagedFamilySlugs.get(familyID) ?? [])].sort(),
      `${familyID} Railway-managed registry slugs changed`,
    );
    for (const slug of adapter.slugs) {
      assert.equal(
        expectedOwners.has(slug),
        false,
        `${slug} is owned by both ${expectedOwners.get(slug)} and ${familyID}`,
      );
      expectedOwners.set(slug, familyID);
    }
  }

  assert.deepEqual(
    adapterFiles.filter((file) => !supportFiles.has(file) && !mappedFiles.has(file)),
    [],
    "an implementation file is missing from the family adapter map",
  );
  assert.equal(expectedOwners.size, 164, "provider adapter coverage changed");
});

test("provider connection operations are unique and outside the root service", () => {
  const root = readSource("ProviderConnectionService.swift");
  const providerOperation =
    /public func ((?:save|rotate|refresh|replace|connect|record|validateSaved)[A-Za-z0-9]+)\b/g;
  assert.deepEqual(
    [...root.matchAll(providerOperation)]
      .map((match) => match[1])
      .filter((name) => name !== "saveConnection"),
    [],
    "provider operations returned to the root service",
  );

  const owners = new Map();
  for (const file of adapterFiles.filter((candidate) => !supportFiles.has(candidate))) {
    for (const match of readSource(file).matchAll(providerOperation)) {
      assert.equal(
        owners.has(match[1]),
        false,
        `${match[1]} is implemented by both ${owners.get(match[1])} and ${file}`,
      );
      owners.set(match[1], file);
    }
  }
  assert.equal(owners.size, 281, "provider operation coverage changed");
  const publicServiceFunctions = [
    ...root.matchAll(/public func [A-Za-z0-9_]+/g),
    ...readSource("ProviderConnectionValidators.swift").matchAll(
      /public func [A-Za-z0-9_]+/g,
    ),
    ...adapterFiles.flatMap((file) => [
      ...readSource(file).matchAll(/public func [A-Za-z0-9_]+/g),
    ]),
  ];
  assert.equal(
    publicServiceFunctions.length,
    302,
    "the pre-extraction public provider connection surface changed",
  );
});

test("relay-owned approval policies are complete and registry-dispatched", () => {
  const orchestration = readSource("ProviderConnectionService+Orchestration.swift");
  const policy = readSource("ProviderConnectionService+ProviderPolicy.swift");
  const registry = readSource("ProviderConnectionApprovalRegistry.swift");
  const policyNamePattern = /isApprovedRelayOwned[A-Za-z0-9]+Provider/g;
  const definitions = [
    ...policy.matchAll(/func (isApprovedRelayOwned[A-Za-z0-9]+Provider)\b/g),
  ].map((match) => match[1]);
  const registrations = [...registry.matchAll(policyNamePattern)]
    .map((match) => match[0])
    .filter((name) => name !== "isApprovedRelayOwnedProvider");

  assert.equal(definitions.length, 116, "relay-owned approval definition count changed");
  assert.deepEqual(
    [...registrations].sort(),
    [...definitions].sort(),
    "approval policy registry is missing or duplicating a provider predicate",
  );
  assert.match(orchestration, /!Self\.isApprovedRelayOwnedProvider\(/);
  assert.equal(
    [...orchestration.matchAll(policyNamePattern)].length,
    0,
    "provider-specific approval chain returned to orchestration",
  );
});
