import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { test } from "node:test";
import { readRelayConsoleViewSource } from "./swift-view-source.mjs";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

function sourceFiles(directory, extensions) {
  const absolute = resolve(root, directory);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = join(absolute, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path.slice(root.length + 1), extensions);
    }
    return extensions.includes(extname(entry.name)) ? [path] : [];
  });
}

function assertFilesDoNotMatch(files, forbidden) {
  for (const file of files) {
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      forbidden,
      file.slice(root.length + 1),
    );
  }
}

const landingFiles = sourceFiles("Relay Console landing page/app", [".tsx"]);
const webFiles = [
  ...sourceFiles("web/app", [".ts", ".tsx"]),
  ...sourceFiles("web/components", [".ts", ".tsx"]),
];
const macAppFiles = sourceFiles(
  "RelayConsoleSwift/Sources/RelayConsoleApp",
  [".swift"],
);
const macCustomerServiceFiles = sourceFiles(
  "RelayConsoleSwift/Sources/RelayConsoleCore",
  [".swift"],
).filter(
  (file) =>
    !file.endsWith("/Migrations.swift"),
);
const iosFiles = sourceFiles("ios/ClawChat", [".swift"]);
const appStoreFiles = [
  "ios/AppStore/app-store-metadata.en-GB.json",
  "ios/AppStore/app-privacy-disclosures.json",
  "ios/APP_STORE_LISTING.md",
  "ios/APP_STORE_REVIEW_PATH.md",
].map((path) => resolve(root, path));
const transactionalEmailFiles = [
  resolve(root, "backend/src/modules/auth/transactional-email.service.ts"),
];
const backendCustomerFiles = [
  resolve(root, "backend/src/gateways/events.gateway.ts"),
  resolve(
    root,
    "backend/src/modules/cloud-commercial/cloud-commercial.service.ts",
  ),
  resolve(
    root,
    "backend/src/modules/cloud-commercial/entitlement-write.guard.ts",
  ),
  resolve(
    root,
    "backend/src/modules/runtime/runtime-authority.controller.ts",
  ),
  resolve(
    root,
    "backend/src/modules/marketplace/catalog/generated-provider-catalog.json",
  ),
];
const customerProductFiles = [
  ...landingFiles,
  ...webFiles,
  ...macAppFiles,
  ...macCustomerServiceFiles,
  ...iosFiles,
  ...appStoreFiles,
  ...transactionalEmailFiles,
  ...backendCustomerFiles,
];

const launchOfferFiles = [
  resolve(root, "Relay Console landing page/app/page.tsx"),
  resolve(root, "Relay Console landing page/app/terms/page.tsx"),
  resolve(root, "Relay Console landing page/app/privacy/page.tsx"),
  resolve(root, "Relay Console landing page/app/support/page.tsx"),
  resolve(root, "web/app/page.tsx"),
  resolve(root, "web/app/connect/page.tsx"),
  resolve(root, "web/components/clawchat-web-app.tsx"),
  resolve(
    root,
    "RelayConsoleSwift/Sources/RelayConsoleApp/CloudRelaySettingsView.swift",
  ),
  resolve(root, "ios/ClawChat/Features/Operations/SettingsView.swift"),
  ...appStoreFiles,
  ...transactionalEmailFiles,
];

test("the current contract defines one paid Relay product", () => {
  const contract = read("docs/relay-cloud/LAUNCH_PRODUCT_CONTRACT.md");

  for (const required of [
    "## Relay: US$9.99 per month",
    "The customer installs and operates Hermes Agent or OpenClaw",
    "does not include runtime compute",
    "managed-runtime feature flag disabled",
  ]) {
    assert.match(
      contract,
      new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    );
  }
  assert.match(contract, /superseded plan names/i);
  assert.match(contract, /Customer-facing copy uses\s+`Relay`/i);
  assert.match(contract, /do not\s+advertise managed Cloud/i);
  assert.match(contract, /Enterprise is outside the first release/i);
});

test("active customer surfaces reject retired Relay plan names", () => {
  assertFilesDoNotMatch(
    customerProductFiles,
    /\b(?:Free Local|Relay Local|Relay Connect|Relay Cloud)\b/,
  );
});

test("launch offer surfaces reject deferred or alternative Relay offers", () => {
  assertFilesDoNotMatch(
    launchOfferFiles,
    /\bComing later\b|\bRelay Enterprise\b|name:\s*["']Enterprise["']|Enterprise (?:plan|tier|offer)|managed Hermes hosting/i,
  );
});

test("launch offer surfaces reject retired plan prices", () => {
  assertFilesDoNotMatch(
    launchOfferFiles,
    /\$39(?:\.00)?(?:\D|$)|\$(?:10|10\.00)(?:\D|$)/,
  );
});

test("independent provider Enterprise requirements remain valid Marketplace copy", () => {
  const marketplace = readRelayConsoleViewSource(root);
  const catalog = read(
    "backend/src/modules/marketplace/catalog/marketplace-catalog.ts",
  );

  assert.match(marketplace, /Feedly Enterprise API access token/);
  assert.match(catalog, /Slack Enterprise Grid/);
  assert.doesNotMatch(marketplace, /\bRelay Enterprise\b/);
  assert.doesNotMatch(catalog, /\bRelay Enterprise\b/);
});

test("every advertised platform states the same subscription and customer-host boundary", () => {
  const landing = read("Relay Console landing page/app/page.tsx");
  const web = read("web/app/page.tsx");
  const mac = read(
    "RelayConsoleSwift/Sources/RelayConsoleApp/CloudRelaySettingsView.swift",
  );
  const metadata = JSON.parse(
    read("ios/AppStore/app-store-metadata.en-GB.json"),
  );

  assert.match(landing, /One subscription for Mac, web, iPhone, and iPad/);
  assert.match(landing, /\$9\.99/);
  assert.match(web, /One Relay subscription/);
  assert.match(mac, /user-managed Hermes Agent or OpenClaw runtime/);
  assert.match(mac, /connects outbound to Relay/);
  assert.equal(metadata.subscription.displayName, "Relay Monthly");
  assert.equal(metadata.subscription.usReferencePrice, "$9.99");

  for (const source of [landing, web, mac, metadata.description]) {
    assert.match(source, /Hermes|OpenClaw/);
    assert.match(source, /(?:computer|host)/i);
  }
});
