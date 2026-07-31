import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  readRelayConsoleAppViewModelSource,
  readRelayConsoleViewSource,
} from "./swift-view-source.mjs";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

function sourceFiles(directory, extension) {
  const absolute = resolve(root, directory);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = join(absolute, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path.slice(root.length + 1), extension);
    }
    return entry.name.endsWith(extension) ? [path] : [];
  });
}

function readSourceTree(directory, extensions) {
  return extensions
    .flatMap((extension) => sourceFiles(directory, extension))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

test("public landing page offers one $9.99 Relay subscription", () => {
  const landing = read("Relay Console landing page/app/page.tsx");
  for (const value of [
    "$9.99",
    "One subscription for Mac, web, iPhone, and iPad",
    "Run Hermes or OpenClaw on a computer you control",
    "Relay does not include model usage or computer",
    "use an always-on Mac mini, server, or VPS",
  ])
    assert.ok(landing.includes(value), `missing launch copy: ${value}`);

  for (const forbidden of [
    "Free Local",
    "Relay Local",
    "Relay Connect",
    "Relay Cloud",
    "Coming later",
    "Enterprise",
    "$39",
    'price: "$10"',
    "Self-Hosted Cloud",
    "Managed Runtime",
    "use your own Railway",
    "Relay hosts Hermes",
    "Relay hosts OpenClaw",
  ])
    assert.ok(
      !landing.includes(forbidden),
      `forbidden launch option remains: ${forbidden}`,
    );
});

test("customer-owned Railway provisioning is absent from shipping source", () => {
  assert.equal(
    existsSync(resolve(root, "scripts/railway-provision.mjs")),
    false,
  );
  assert.equal(
    existsSync(resolve(root, "scripts/railway-provision.test.mjs")),
    false,
  );
  assert.equal(
    existsSync(
      resolve(
        root,
        "RelayConsoleSwift/Sources/RelayConsoleCore/RailwaySelfHostedProvisioningService.swift",
      ),
    ),
    false,
  );
  const scripts = JSON.parse(read("package.json")).scripts;
  assert.equal(scripts["provision:railway"], undefined);
  assert.equal(scripts["test:provisioning"], undefined);
});

test("macOS and iOS accept only the Relay-managed canonical service", () => {
  const macCore = read(
    "RelayConsoleSwift/Sources/RelayConsoleCore/CloudRelaySync.swift",
  );
  assert.match(macCore, /deploymentOwnership = "relay_managed"/);
  assert.match(
    macCore,
    /apiOrigin = "https:\/\/api\.relayconsole\.work\/api\/v1"/,
  );
  assert.match(macCore, /websocketOrigin = "wss:\/\/api\.relayconsole\.work"/);
  assert.match(macCore, /try RelayCloudLaunchContract\.validate\(manifest\)/);

  const macSettings = read(
    "RelayConsoleSwift/Sources/RelayConsoleApp/CloudRelaySettingsView.swift",
  );
  assert.match(
    macSettings,
    /private let origin = RelayCloudLaunchContract\.apiOrigin/,
  );
  assert.doesNotMatch(macSettings, /TextField\([^\n]*origin/);

  const mobileOnboarding = read(
    "ios/ClawChat/Infrastructure/Network/CloudConnectionOnboarding.swift",
  );
  assert.match(mobileOnboarding, /ownershipType = "relay_managed"/);
  assert.match(mobileOnboarding, /https:\/\/api\.relayconsole\.work\/api\/v1/);
  assert.match(mobileOnboarding, /unsupportedDeployment/);
  assert.match(mobileOnboarding, /manifest\["ownershipType"\]/);
});

test("supported runtime bridge is outbound and customer-operated on every advertised host", () => {
  const macSettings = read(
    "RelayConsoleSwift/Sources/RelayConsoleApp/CloudRelaySettingsView.swift",
  );
  const mobileSettings = read(
    "ios/ClawChat/Features/Operations/SettingsView.swift",
  );
  const mobileRuntimeSurfaces = [
    mobileSettings,
    read("ios/ClawChat/Features/Auth/PairingView.swift"),
    read("ios/ClawChat/Features/Agents/HiringFlowView.swift"),
    read("ios/ClawChat/Infrastructure/Network/APIEndpoints.swift"),
  ].join("\n");
  const listing = read("ios/AppStore/app-store-metadata.en-GB.json");

  assert.match(macSettings, /connects outbound to Relay\./);
  assert.match(macSettings, /user-managed Hermes Agent or OpenClaw runtime/);
  for (const file of sourceFiles(
    "RelayConsoleSwift/Sources/RelayConsoleApp",
    ".swift",
  )) {
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /Relay Local|Relay Connect|Relay Cloud|Coming later|managed Hermes hosting/,
      file.slice(root.length + 1),
    );
  }
  assert.match(mobileSettings, /Mac, PC, Mac mini, or VPS/);
  assert.match(mobileSettings, /connects outbound to Relay,/);
  assert.match(mobileSettings, /do not open a public port/);
  assert.doesNotMatch(
    mobileRuntimeSurfaces,
    /newInstanceURL|Bridge Instance URL|createConnection\(|instanceUrl|instanceURL|OpenClaw Instance URL/,
  );
  assert.match(listing, /own Mac, PC, Mac mini or VPS/);
  assert.match(listing, /does not install or host that runtime/);
});

test("iPhone and iPad surfaces present one Relay subscription", () => {
  const swiftFiles = [
    ...sourceFiles("ios/ClawChat", ".swift"),
    ...sourceFiles("ios/ClawChatTests", ".swift"),
  ];
  const submissionFiles = [
    "ios/AppStore/app-store-metadata.en-GB.json",
    "ios/AppStore/app-privacy-disclosures.json",
    "ios/APP_STORE_LISTING.md",
    "ios/APP_STORE_REVIEW_PATH.md",
  ].map((path) => resolve(root, path));

  for (const file of [...swiftFiles, ...submissionFiles]) {
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /Relay Local|Relay Connect|Relay Cloud|managed Hermes hosting/,
      file.slice(root.length + 1),
    );
  }

  for (const file of submissionFiles) {
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /Coming later|separate (?:Local|Connect|Cloud|managed) plan/i,
      file.slice(root.length + 1),
    );
  }

  const metadata = JSON.parse(
    read("ios/AppStore/app-store-metadata.en-GB.json"),
  );
  const settings = read("ios/ClawChat/Features/Operations/SettingsView.swift");
  assert.equal(metadata.subscription.displayName, "Relay Monthly");
  assert.equal(metadata.subscription.productId, "com.relayconsole.cloud.monthly");
  assert.match(settings, /Section\("Relay subscription"\)/);
  assert.match(settings, /Subscribe to Relay/);
  assert.doesNotMatch(settings, /managed Hermes|separate plan/);
});

test("web stays on Railway-backed /api/v1 while customer copy hides Railway", () => {
  const config = read("web/lib/config.ts");
  const next = read("web/next.config.mjs");
  const shell = readSourceTree("web/components", [".ts", ".tsx"]);
  const mobileFeatures =
    read("ios/ClawChat/Features/Auth/LoginView.swift") +
    read("ios/ClawChat/Features/Operations/SettingsView.swift");

  assert.match(config, /const apiBaseUrl = "\/api\/v1"/);
  assert.match(config, /NEXT_PUBLIC_RAILWAY_WS_BASE_URL/);
  assert.match(next, /CLAWCHAT_RAILWAY_ORIGIN/);
  assert.match(shell, /Checking the Relay service/);
  assert.match(shell, /Relay service unavailable/);
  assert.match(shell, /Could not reach the Relay service/);
  assert.doesNotMatch(
    shell,
    /Checking Railway for your Relay Console workspaces|Railway workspace sync/,
  );
  assert.doesNotMatch(
    shell,
    /Railway backend unavailable|Could not reach the Railway backend|Could not load workspaces from Railway/,
  );
  assert.doesNotMatch(
    mobileFeatures,
    /Railway workspace|Railway account security/,
  );
});

test("server advertises customer runtime hosts and zero managed-runtime capacity", () => {
  const cloud = read(
    "backend/src/modules/cloud-commercial/cloud-commercial.service.ts",
  );
  assert.match(cloud, /return "relay_managed"/);
  assert.match(cloud, /customerRuntimeHosts: true,\s+managedRuntime: false/);
  assert.match(cloud, /managedRuntimeMinutes: 0/);
});

test("every client fails closed when no active execution owner is online", () => {
  const backend = read(
    "backend/src/modules/runtime/execution-availability.ts",
  );
  const macModel = readRelayConsoleAppViewModelSource(root);
  const macViews = readRelayConsoleViewSource(root);
  const web = readSourceTree("web/components", [".ts", ".tsx"]);
  const iosModel = read("ios/ClawChat/Domain/Models/CoreModels.swift");
  const iosDirect = read("ios/ClawChat/Features/Thread/ThreadView.swift");
  const iosTeam = read("ios/ClawChat/Features/Thread/TeamChatView.swift");

  for (const reason of [
    "binding_disabled",
    "ownership_inactive",
    "host_inactive",
    "host_stale",
    "assignment_epoch_invalid",
  ]) {
    assert.match(backend, new RegExp(reason));
  }
  assert.match(macModel, /visibleAgents\.filter[^{]*\{[^}]*executionAvailable/s);
  assert.match(macViews, /\.disabled\(!agent\.executionAvailable\)/);
  assert.match(web, /return agent\.executionAvailable === true/);
  assert.match(
    iosModel,
    /isActiveSurfaceEligible && executionAvailable == true/,
  );
  for (const source of [iosDirect, iosTeam]) {
    assert.ok(source.includes("contains(where: \\.isExecutionAvailable)"));
    assert.match(source, /No execution owner is online for this chat\./);
  }
});

test("Mac offline entitlement is bounded to the approved seven-day policy", () => {
  const policy = read(
    "docs/production-launch-current/OFFLINE_ENTITLEMENT_POLICY_2026-07-25.md",
  );
  const contract = read("docs/relay-cloud/LAUNCH_PRODUCT_CONTRACT.md");
  const terms = read("Relay Console landing page/app/terms/page.tsx");

  for (const source of [policy, contract, terms]) {
    assert.match(source, /seven consecutive days/i);
    assert.match(source, /disables? (?:agent )?execution/i);
  }

  assert.match(policy, /read existing local conversations and export Relay data/i);
  assert.match(contract, /permits reading and export/i);
  assert.match(terms, /permits reading local conversations and exporting Relay data/i);
  assert.match(policy, /does not extend the separate three-day failed-payment grace/i);
  assert.match(policy, /last successful online entitlement check/i);
  assert.match(policy, /must not stop, uninstall, modify, or delete Hermes Agent, OpenClaw/i);
});

test("macOS enforces the signed paid entitlement at UI sync and execution boundaries", () => {
  const entitlement = read(
    "RelayConsoleSwift/Sources/RelayConsoleCore/RelayEntitlementService.swift",
  );
  const dispatch = read(
    "RelayConsoleSwift/Sources/RelayConsoleCore/DispatchService.swift",
  );
  const sync = read(
    "RelayConsoleSwift/Sources/RelayConsoleCore/CloudRelaySync.swift",
  );
  const services = read(
    "RelayConsoleSwift/Sources/RelayConsoleCore/RelayConsoleServices.swift",
  );
  const viewModel = readRelayConsoleAppViewModelSource(root);
  const views = readRelayConsoleViewSource(root);
  const cloudSettings = read(
    "RelayConsoleSwift/Sources/RelayConsoleApp/CloudRelaySettingsView.swift",
  );

  assert.match(entitlement, /offlineAllowance: TimeInterval = 7 \* 24 \* 60 \* 60/);
  assert.match(entitlement, /HMAC<SHA256>\.authenticationCode/);
  assert.match(entitlement, /publicKey\.isValidSignature/);
  assert.match(entitlement, /installationPublicId/);
  assert.match(entitlement, /accountId/);
  assert.match(entitlement, /clockRollbackTolerance/);
  assert.match(entitlement, /let expiresAtText = payload\["expiresAt"\]/);
  assert.match(entitlement, /case expired/);
  assert.match(entitlement, /case clockInvalid/);
  assert.match(dispatch, /try entitlement\.requireSameMacExecution\(\)/);
  assert.match(sync, /verifiedControlPlaneToken/);
  assert.match(sync, /entitlement\.refreshOnlineAccess/);
  assert.match(sync, /try entitlement\.requireControlPlaneAccess\(\)/);
  assert.match(services, /public let entitlement: RelayEntitlementService/);
  assert.match(viewModel, /relayEntitlementAccess/);
  assert.match(viewModel, /retryRelayEntitlementVerification/);
  assert.match(views, /RelayEntitlementGateView/);
  assert.match(views, /CloudRelaySettingsPanel\(presentation: \.accountSignIn\)/);
  assert.match(views, /Button\("Access local data"\)/);
  assert.match(views, /Export local data/);
  assert.match(views, /Local conversations/);
  assert.match(cloudSettings, /appIconImage\(\)/);
  assert.match(cloudSettings, /relayConsoleWordmarkImage\(\)/);
  assert.match(cloudSettings, /Text\(busy \? "Signing in…" : "Sign in"\)/);

  const activeMacSources = sourceFiles(
    "RelayConsoleSwift/Sources",
    ".swift",
  ).map((file) => readFileSync(file, "utf8")).join("\n");
  const activeMacTests = [
    ...sourceFiles("RelayConsoleSwift/Tests", ".swift"),
  ].map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(activeMacSources, /Free Local/);
  assert.doesNotMatch(activeMacTests, /Free Local/);
});

test("cancellation preserves local recovery controls and bounds Railway retention", () => {
  const policy = read(
    "docs/production-launch-current/CANCELLATION_AND_REACTIVATION_POLICY_2026-07-25.md",
  );
  const terms = read("Relay Console landing page/app/terms/page.tsx");

  for (const source of [policy, terms]) {
    assert.match(source, /disables? agent execution/i);
    assert.match(source, /read(?:ing)?(?: existing)? local conversations|local conversation reading/i);
    assert.match(source, /30 days/i);
    assert.match(source, /reactivation during (?:the|that) (?:30-day )?(?:retention )?period/i);
    assert.match(source, /later reactivation starts fresh Railway state|Reactivation after 30 days creates fresh Railway workspace state/i);
  }

  assert.match(policy, /reset Relay data stored on that Mac/i);
  assert.match(policy, /request permanent Relay account deletion/i);
  assert.match(policy, /must not stop, modify, uninstall, or delete Hermes Agent/i);
});

test("macOS launch label always binds to the latest exact frozen source", () => {
  const policy = read(
    "docs/production-launch-current/MACOS_LAUNCH_CANDIDATE_POLICY_2026-07-25.md",
  );
  const download = read("Relay Console landing page/app/download/page.tsx");

  assert.match(policy, /Marketing version: `1\.0\.0`/);
  assert.match(policy, /First one-product candidate build: `1`/);
  assert.match(policy, /Apple silicon `arm64`/);
  assert.match(policy, /macOS 14\.0/);
  assert.match(policy, /exact clean Swift source\s+commit approved at launch freeze/i);
  assert.match(policy, /change after candidate generation invalidates that candidate/i);
  assert.match(policy, /increment the build number/i);
  assert.match(download, /1\.0\.0 launch target/);
  assert.match(download, /current exact source at release freeze/);
});

test("commercial distribution stays closed without a legal seller", () => {
  const policy = read(
    "docs/production-launch-current/COMMERCIAL_DISTRIBUTION_POLICY_2026-07-26.md",
  );
  const contract = read("docs/relay-cloud/LAUNCH_PRODUCT_CONTRACT.md");
  const terms = read("Relay Console landing page/app/terms/page.tsx");

  for (const source of [policy, contract, terms])
    assert.match(source, /legal seller/i);

  assert.match(policy, /must keep web checkout disabled/i);
  assert.match(contract, /must keep\s+web checkout disabled/i);
  assert.match(terms, /Web checkout\s+remains disabled/i);
  assert.match(policy, /standard Stripe checkout with Stripe Tax/i);
  assert.match(policy, /Stripe does not become the\s+merchant of record/i);
  assert.match(policy, /mandatory consumer refund rights/i);
  assert.match(policy, /except France/i);
  assert.match(policy, /must not describe the app as\s+available worldwide/i);
});
