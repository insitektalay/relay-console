import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtimeConfig = readFileSync(
  new URL("../ios/ClawChat/App/AppRuntimeConfig.swift", import.meta.url),
  "utf8",
);
const originPolicy = readFileSync(
  new URL("../ios/ClawChat/App/RelayDeploymentOriginPolicy.swift", import.meta.url),
  "utf8",
);
const websocketClient = readFileSync(
  new URL(
    "../ios/ClawChat/Infrastructure/WebSocket/WebSocketClient.swift",
    import.meta.url,
  ),
  "utf8",
);
const infoPlist = readFileSync(
  new URL("../ios/ClawChat/App/Info.plist", import.meta.url),
  "utf8",
);
const projectConfig = readFileSync(
  new URL("../ios/project.yml", import.meta.url),
  "utf8",
);

test("runtime config applies one fail-closed deployment-origin policy", () => {
  assert.match(runtimeConfig, /RelayDeploymentOriginPolicy\.validate\(/);
  assert.match(runtimeConfig, /return production/);
  assert.doesNotMatch(runtimeConfig, /configuredValue|fallbackURL|isLoopback/);
  assert.doesNotMatch(runtimeConfig, /attributes:[\s\S]{0,160}(rawAPI|rawWebSocket|rawWeb)/);

  assert.match(originPolicy, /apiComponents\.percentEncodedPath == "\/api\/v1"/);
  assert.match(originPolicy, /websocketComponents\.percentEncodedPath\.isEmpty/);
  assert.match(originPolicy, /\$0\.user == nil && \$0\.password == nil/);
  assert.match(originPolicy, /\$0\.query == nil && \$0\.fragment == nil/);
  assert.match(originPolicy, /\$0\.port == nil/);
  assert.match(originPolicy, /candidate == production/);
});

test("production iOS build metadata remains on the approved origin triple", () => {
  assert.match(
    infoPlist,
    /<key>RelayConsoleAPIBaseURL<\/key>\s*<string>https:\/\/api\.relayconsole\.work\/api\/v1<\/string>/,
  );
  assert.match(
    infoPlist,
    /<key>RelayConsoleWebSocketBaseURL<\/key>\s*<string>wss:\/\/api\.relayconsole\.work<\/string>/,
  );
  assert.match(
    infoPlist,
    /<key>RelayConsoleWebAssetBaseURL<\/key>\s*<string>https:\/\/relayconsole\.work<\/string>/,
  );
  assert.match(
    projectConfig,
    /RelayConsoleAPIBaseURL: https:\/\/api\.relayconsole\.work\/api\/v1/,
  );
  assert.match(
    projectConfig,
    /RelayConsoleWebSocketBaseURL: wss:\/\/api\.relayconsole\.work/,
  );
  assert.match(
    projectConfig,
    /RelayConsoleWebAssetBaseURL: https:\/\/relayconsole\.work/,
  );
});

test("websocket telemetry never records raw payloads, close reasons, or error descriptions", () => {
  assert.match(websocketClient, /websocketDiagnosticMetadata\(/);
  assert.match(websocketClient, /case disconnected\b/);
  assert.doesNotMatch(websocketClient, /disconnected\(reason:/);
  assert.doesNotMatch(websocketClient, /"payload"\s*:/);
  assert.doesNotMatch(websocketClient, /"reason"\s*:/);
  assert.doesNotMatch(websocketClient, /error\.localizedDescription/);
  assert.doesNotMatch(websocketClient, /String\(data:\s*(payload|reason)/);
  assert.doesNotMatch(websocketClient, /WebSocket event \\\(type\)/);
});
