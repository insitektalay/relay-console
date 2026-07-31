import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = resolve(fileURLToPath(import.meta.url), "../..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const json = (path) => JSON.parse(read(path));

const metadata = json("ios/AppStore/app-store-metadata.en-GB.json");
const privacy = json("ios/AppStore/app-privacy-disclosures.json");
const privacyManifest = read("ios/ClawChat/App/PrivacyInfo.xcprivacy");
const infoPlist = read("ios/ClawChat/App/Info.plist");
const project = read("ios/project.yml");
const telemetry = read("ios/ClawChat/Shared/Telemetry/Telemetry.swift");
const settings = read("ios/ClawChat/Features/Operations/SettingsView.swift");
const departmentInbox = read("ios/ClawChat/Features/Teams/DepartmentInboxView.swift");
const directThread = read("ios/ClawChat/Features/Thread/ThreadView.swift");
const teamThread = read("ios/ClawChat/Features/Thread/TeamChatView.swift");
const privacyPolicy = read("Relay Console landing page/app/privacy/page.tsx");
const subprocessors = read("Relay Console landing page/app/subprocessors/page.tsx");
const thirdPartyNotices = read("ios/THIRD_PARTY_NOTICES.md");
const resolvedPackages = read(
  "ios/ClawChat.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"
);
const iosSources = [
  read("ios/ClawChat/App/ClawChatApp.swift"),
  read("ios/ClawChat/App/AppStore.swift"),
  read("ios/ClawChat/Features/Operations/SettingsView.swift"),
].join("\n");

const manifestTypes = new Map([
  ["Name", "NSPrivacyCollectedDataTypeName"],
  ["Email Address", "NSPrivacyCollectedDataTypeEmailAddress"],
  ["Emails or Text Messages", "NSPrivacyCollectedDataTypeEmailsorTextMessages"],
  ["Photos or Videos", "NSPrivacyCollectedDataTypePhotosorVideos"],
  ["Audio Data", "NSPrivacyCollectedDataTypeAudioData"],
  ["Other User Content", "NSPrivacyCollectedDataTypeOtherUserContent"],
  ["User ID", "NSPrivacyCollectedDataTypeUserID"],
  ["Purchase History", "NSPrivacyCollectedDataTypePurchaseHistory"],
  ["Product Interaction", "NSPrivacyCollectedDataTypeProductInteraction"],
  ["Device ID", "NSPrivacyCollectedDataTypeDeviceID"],
  ["Crash Data", "NSPrivacyCollectedDataTypeCrashData"],
  ["Performance Data", "NSPrivacyCollectedDataTypePerformanceData"],
  ["Other Diagnostic Data", "NSPrivacyCollectedDataTypeOtherDiagnosticData"],
]);

test("prepared listing metadata fits Apple's current field limits", () => {
  assert.equal(metadata.name.length <= 30, true);
  assert.equal(metadata.subtitle.length <= 30, true);
  assert.equal(metadata.promotionalText.length <= 170, true);
  assert.equal(metadata.description.length <= 4000, true);
  assert.equal(Buffer.byteLength(metadata.keywords, "utf8") <= 100, true);
  assert.equal(Buffer.byteLength(metadata.review.notes, "utf8") <= 4000, true);
  assert.equal(metadata.name, "Relay Console");
  assert.equal(metadata.subscription.productId, "com.relayconsole.cloud.monthly");
  assert.equal(metadata.subscription.usReferencePrice, "$9.99");
  assert.equal(metadata.subscription.introductoryTrial, false);
});

test("listing links use the canonical public domain and required policy routes", () => {
  assert.deepEqual(metadata.urls, {
    marketing: "https://relayconsole.work",
    support: "https://relayconsole.work/support",
    privacyPolicy: "https://relayconsole.work/privacy",
    privacyChoices: "https://relayconsole.work/data-deletion",
    terms: "https://relayconsole.work/terms",
  });
  assert.match(metadata.description, /install and manage your chosen runtime on your own Mac, PC, Mac mini or VPS/i);
  assert.match(metadata.description, /Relay does not install or host Hermes Agent or OpenClaw/i);
  assert.match(metadata.description, /keep that computer online/i);
});

test("App Store metadata presents one Relay subscription and no retired plan", () => {
  assert.equal(metadata.subscription.displayName, "Relay Monthly");
  assert.equal(metadata.subscription.productId, "com.relayconsole.cloud.monthly");
  for (const value of [
    metadata.promotionalText,
    metadata.description,
    metadata.screenshots.shotList.join("\n"),
    metadata.distributionCompliance.thirdPartyAIConsent.evidence,
    metadata.review.notes,
  ]) {
    assert.doesNotMatch(
      value,
      /Relay Local|Relay Connect|Relay Cloud|managed Hermes hosting|Coming later/,
    );
  }
});

test("privacy, terms, deletion, acceptable-use, and support links are reachable from Settings", () => {
  for (const route of ["privacy", "terms", "data-deletion", "acceptable-use", "support"]) {
    assert.match(settings, new RegExp(`https://relayconsole\\.work/${route}`));
  }
});

test("agent messages require revocable model-provider sharing consent", () => {
  for (const source of [directThread, teamThread]) {
    assert.match(source, /privacy\.third_party_model_sharing\.consent/);
    assert.match(source, /Share with your model provider\?/);
    assert.match(source, /user-managed agent runtime/);
    assert.match(source, /AI model provider configured/);
    assert.match(source, /withdraw this permission in Settings/);
    assert.match(source, /Allow and Continue/);
  }
  assert.match(settings, /Share agent messages with model providers/);
  assert.match(settings, /Turn this off to require permission again/);
  assert.match(privacyPolicy, /asks for permission\s+to\s+share that message/i);
});

test("a dormant department inbox fails closed instead of loading fabricated release data", () => {
  assert.match(departmentInbox, /Department inbox is not available in this release/);
  assert.match(departmentInbox, /No sample messages are shown as live data/);
  assert.doesNotMatch(departmentInbox, /loadMockData/);
  assert.doesNotMatch(departmentInbox, /Budget threshold at 85%|Gamma Force: repeated task failure|Daily Operations Summary/);
});

test("privacy answer source and shipping privacy manifest cover the same collected types", () => {
  assert.equal(privacy.tracking, false);
  assert.match(privacyManifest, /<key>NSPrivacyTracking<\/key>\s*<false\/>/);
  for (const disclosure of privacy.dataTypes) {
    const manifestType = manifestTypes.get(disclosure.type);
    assert.ok(manifestType, `Unmapped privacy type: ${disclosure.type}`);
    assert.match(privacyManifest, new RegExp(`<string>${manifestType}<\\/string>`));
    assert.equal(disclosure.linkedToUser, true);
    assert.equal(disclosure.tracking, false);
  }
  assert.equal(privacy.dataTypes.length, manifestTypes.size);
});

test("the Device ID disclosure covers opt-in analytics without inventing push-token collection", () => {
  const deviceId = privacy.dataTypes.find(({ type }) => type === "Device ID");
  assert.deepEqual(deviceId?.purposes, ["Analytics"]);
  assert.match(deviceId?.evidence ?? "", /PostHog.*only after product analytics opt-in/i);
  assert.match(privacyManifest, /NSPrivacyCollectedDataTypeDeviceID/);
  assert.doesNotMatch(iosSources, /registerForRemoteNotifications|didRegisterForRemoteNotifications|UserNotifications/);
  assert.doesNotMatch(project, /aps-environment|SystemCapabilities.*Push/i);
});

test("Sentry's opt-in diagnostic boundary is stated in public copy", () => {
  assert.match(privacyPolicy, /Both choices start off/i);
  assert.match(privacyPolicy, /change either choice later in Settings/i);
  assert.match(privacyPolicy, /does not use this\s*information\s*for\s*advertising or cross-app tracking/i);
  assert.match(
    subprocessors,
    /Sentry: bounded crash and error diagnostics.*only after the user enables crash reporting/i,
  );
  for (const setting of [
    "sendDefaultPii = false",
    "attachScreenshot = false",
    "attachViewHierarchy = false",
    "enableNetworkBreadcrumbs = false",
    "enableNetworkTracking = false",
    "enableFileIOTracing = false",
  ]) {
    assert.match(telemetry, new RegExp(setting.replaceAll(" ", "\\s*")));
  }
  assert.match(telemetry, /options\.beforeBreadcrumb/);
  assert.match(telemetry, /event\.request = nil/);
  assert.match(telemetry, /event\.extra = nil/);
});

test("the pinned Sentry dependency has a matching distributable notice", () => {
  assert.match(resolvedPackages, /"identity"\s*:\s*"sentry-cocoa"/);
  assert.match(resolvedPackages, /"version"\s*:\s*"8\.58\.2"/);
  assert.match(
    resolvedPackages,
    /"revision"\s*:\s*"cf44aa8cb4147f39e698c1f28be0b6b2c89f79d2"/
  );
  assert.match(thirdPartyNotices, /Sentry Cocoa 8\.58\.2/);
  assert.match(
    thirdPartyNotices,
    /cf44aa8cb4147f39e698c1f28be0b6b2c89f79d2/
  );
  assert.match(thirdPartyNotices, /The MIT License \(MIT\)/);
  assert.match(thirdPartyNotices, /Copyright \(c\) 2015 Sentry/);
});

test("external legal and review attestations remain fail-closed", () => {
  assert.equal(metadata.ageRating.status, "pending_frozen_binary_questionnaire");
  assert.equal(metadata.exportCompliance.status, "pending_owner_attestation");
  assert.equal(metadata.review.status, "blocked_on_external_account_and_runtime");
  assert.equal(metadata.screenshots.status, "pending_frozen_signed_build");
  assert.equal(metadata.distributionCompliance.euTraderStatus.status, "pending_account_holder_declaration_and_verification");
  assert.equal(metadata.distributionCompliance.contentRights.status, "pending_owner_attestation");
  assert.equal(metadata.distributionCompliance.userGeneratedContent.status, "pending_frozen_product_review");
  assert.equal(metadata.distributionCompliance.thirdPartyAIConsent.status, "implemented_pending_signed_build_acceptance");
  assert.equal(metadata.distributionCompliance.loginServices.status, "sign_in_with_apple_not_currently_required");
  assert.match(metadata.distributionCompliance.appleToolchain.requirement, /Xcode 26 or later/);
  for (const source of [project, infoPlist]) {
    assert.doesNotMatch(source, /ITSAppUsesNonExemptEncryption/);
  }
});
