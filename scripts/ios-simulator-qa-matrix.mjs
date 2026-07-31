#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const developerDir = process.env.DEVELOPER_DIR ?? "/Applications/Xcode.app/Contents/Developer";
const toolEnv = { ...process.env, DEVELOPER_DIR: developerDir };

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function capture(command, args) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    env: toolEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: toolEnv,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

function availableTemplates() {
  const listing = JSON.parse(capture("xcrun", ["simctl", "list", "devices", "available", "--json"]));
  return Object.entries(listing.devices).flatMap(([runtimeId, devices]) =>
    devices
      .filter((device) => device.isAvailable)
      .map((device) => ({ ...device, runtimeId })),
  );
}

function chooseTemplate(templates, family, requestedName) {
  const familyTemplates = templates.filter((device) =>
    device.deviceTypeIdentifier.includes(`.${family}-`),
  );
  const match = requestedName
    ? familyTemplates.find((device) => device.name === requestedName)
    : familyTemplates[0];
  if (!match) {
    const available = familyTemplates.map((device) => device.name).join(", ");
    throw new Error(`No available ${family} simulator named ${requestedName}. Available: ${available}`);
  }
  return match;
}

function createDisposableSimulator(template, label) {
  const name = `Relay Console QA ${label} ${Date.now()}`;
  const udid = capture("xcrun", [
    "simctl",
    "create",
    name,
    template.deviceTypeIdentifier,
    template.runtimeId,
  ]);
  if (!/^[0-9A-F-]{36}$/i.test(udid)) {
    throw new Error(`simctl returned an invalid device identifier: ${udid}`);
  }
  return { ...template, name, udid };
}

function deleteDisposableSimulator(device) {
  if (!device || !/^[0-9A-F-]{36}$/i.test(device.udid)) return;
  try {
    capture("xcrun", ["simctl", "delete", device.udid]);
  } catch (error) {
    console.warn(`Could not remove disposable simulator ${device.name}: ${error.message}`);
  }
}

function testSummary(resultBundlePath) {
  return JSON.parse(
    capture("xcrun", [
      "xcresulttool",
      "get",
      "test-results",
      "summary",
      "--path",
      resultBundlePath,
      "--format",
      "json",
    ]),
  );
}

const requestedPhone = readOption("--phone") ?? "iPhone 17";
const requestedTablet = readOption("--tablet") ?? "iPad Pro 13-inch (M5)";
const requestedArtifacts = readOption("--artifacts-dir");
const artifactsRoot = requestedArtifacts
  ? resolve(requestedArtifacts, new Date().toISOString().replaceAll(":", "-"))
  : mkdtempSync(resolve(tmpdir(), "relay-ios-simulator-matrix-"));
mkdirSync(artifactsRoot, { recursive: true });

const templates = availableTemplates();
const selected = [
  ["iphone", chooseTemplate(templates, "iPhone", requestedPhone)],
  ["ipad", chooseTemplate(templates, "iPad", requestedTablet)],
];
const devices = [];
const results = [];

try {
  for (const [label, template] of selected) {
    const device = createDisposableSimulator(template, label);
    devices.push(device);
    console.log(`\n${label}: ${template.name} on ${template.runtimeId}`);

    const testRuns = [
      { label: "unit", onlyTesting: "ClawChatTests", minimumTests: 66 },
      {
        label: "signed-out-ui",
        onlyTesting:
          "ClawChatUITests/ClawChatUITests/testUnattendedSignedOutAccessibilityAndInputMatrix",
        minimumTests: 1,
      },
    ];

    for (const testRun of testRuns) {
      const resultBundlePath = resolve(artifactsRoot, `${label}-${testRun.label}.xcresult`);
      run("xcodebuild", [
        "test",
        "-quiet",
        "-project",
        "ios/ClawChat.xcodeproj",
        "-scheme",
        "ClawChat",
        "-destination",
        `platform=iOS Simulator,id=${device.udid}`,
        "-derivedDataPath",
        resolve(artifactsRoot, "DerivedData"),
        "-onlyUsePackageVersionsFromResolvedFile",
        "-skipPackageUpdates",
        "-skipPackagePluginValidation",
        "-skipMacroValidation",
        "-parallel-testing-enabled",
        "NO",
        "-only-testing",
        testRun.onlyTesting,
        "-resultBundlePath",
        resultBundlePath,
      ]);

      const summary = testSummary(resultBundlePath);
      if (summary.result !== "Passed" || summary.totalTestCount < testRun.minimumTests) {
        throw new Error(
          `${label} ${testRun.label} produced ${summary.result} with ${summary.totalTestCount} tests`,
        );
      }
      results.push({
        deviceFamily: label,
        templateName: template.name,
        runtimeId: template.runtimeId,
        testRun: testRun.label,
        result: summary.result,
        totalTestCount: summary.totalTestCount,
        passedTests: summary.passedTests,
        failedTests: summary.failedTests,
        skippedTests: summary.skippedTests,
        resultBundlePath,
      });
    }
  }

  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    xcode: capture("xcodebuild", ["-version"]).split("\n"),
    scope: "Disposable iOS simulators; no provider or customer credentials; no Railway writes.",
    results,
  };
  const summaryPath = resolve(artifactsRoot, "summary.json");
  writeFileSync(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`\nAll iPhone and iPad simulator checks passed. Evidence: ${summaryPath}`);
} finally {
  for (const device of devices) deleteDisposableSimulator(device);
}
