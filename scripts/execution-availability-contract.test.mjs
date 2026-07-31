import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const contracts = source("packages/contracts/src/index.ts");
const web = source("web/components/clawchat-web-app.tsx");
const ios = source("ios/ClawChat/Domain/Models/CoreModels.swift");
const macModels = source("RelayConsoleSwift/Sources/RelayConsoleCore/Models.swift");
const macSync = source("RelayConsoleSwift/Sources/RelayConsoleCore/CloudRelaySync.swift");

test("the shared agent contract carries one explicit fail-closed execution decision", () => {
  assert.match(contracts, /executionAvailable\?: boolean/);
  assert.match(contracts, /executionUnavailableReason\?/);
});

test("web never infers execution authority from online or ready presentation state", () => {
  const functionBody = web.match(
    /function isAgentExecutionAvailable\(agent: Agent\) \{([\s\S]*?)\n\}/,
  )?.[1] ?? "";
  assert.match(functionBody, /agent\.executionAvailable === true/);
  assert.doesNotMatch(functionBody, /runtimeAvailability|healthStatus|online|ready/);
});

test("iPhone and iPad require the explicit backend decision and active lifecycle", () => {
  const extensionBody = ios.match(
    /extension Agent \{([\s\S]*?)\n\}/,
  )?.[1] ?? "";
  assert.match(extensionBody, /isActiveSurfaceEligible && executionAvailable == true/);
  assert.doesNotMatch(extensionBody, /runtimeAvailability == \.online/);
});

test("macOS persists and consumes the Railway decision for Connect and Cloud agents", () => {
  assert.match(macSync, /"executionAvailable": \(payload\["executionAvailable"\] as\? Bool\) == true/);
  assert.match(macSync, /"executionUnavailableReason": payload\["executionUnavailableReason"\]/);
  assert.match(macModels, /if productMode != \.local \{[\s\S]*?config\["executionAvailable"\]\?\.bool == true/);
});
