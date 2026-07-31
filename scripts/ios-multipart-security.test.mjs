import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const multipartPolicy = read(
  "ios/ClawChat/Infrastructure/Network/MultipartFormDataSecurity.swift",
);
const apiClient = read("ios/ClawChat/Infrastructure/Network/APIClient.swift");
const xcodeProject = read("ios/ClawChat.xcodeproj/project.pbxproj");
const agentController = read("backend/src/modules/agent/agent.controller.ts");
const relaySyncService = read(
  "backend/src/modules/relay-sync/relay-sync.service.ts",
);
const relayAttachmentStorage = read(
  "backend/src/modules/relay-sync/relay-attachment-storage.service.ts",
);
const boxAdapter = read(
  "backend/src/modules/marketplace/connectors/box/box-api.adapter.ts",
);
const boxTests = read(
  "backend/src/modules/marketplace/connectors/box/box.connector.spec.ts",
);

test("iOS multipart headers are built only from the canonical safe encoder", () => {
  assert.match(apiClient, /MultipartFormDataSecurity\.encodeFile\(/);
  assert.doesNotMatch(
    apiClient,
    /Content-Disposition:[^\n]*\\\(filename\)/,
  );
  assert.match(multipartPolicy, /CharacterSet\.controlCharacters\.contains/);
  assert.match(multipartPolicy, /!rawValue\.contains\("\\""\)/);
  assert.match(
    multipartPolicy,
    /replacingOccurrences\(of: "\\\\", with: "\/"\)/,
  );
  assert.match(multipartPolicy, /maximumFilenameBytes = 120/);
  assert.match(multipartPolicy, /safeMIMEType/);
  assert.match(multipartPolicy, /parts\.count == 2/);
  assert.match(xcodeProject, /MultipartFormDataSecurity\.swift in Sources/);
});

test("the hostile matrix covers header, path, Unicode, size, MIME, and body cardinality", () => {
  const hostContract = read(
    "ios/HostTests/MultipartFormDataSecurityContract.swift",
  );
  const appTests = read("ios/ClawChatTests/ClawChatTests.swift");
  for (const required of [
    "\\r\\n",
    "\\u{0000}",
    "Résumé",
    "String(repeating: \"a\", count: 200)",
    "text/plain; charset=utf-8",
    "components(separatedBy: \"Content-Disposition:\")",
  ]) {
    assert.ok(
      hostContract.includes(required),
      `missing multipart host fixture: ${required}`,
    );
  }
  assert.match(
    appTests,
    /testMultipartUploadNormalizesFilenameAndMIMEBeforeSerializingHeaders/,
  );
  assert.match(
    appTests,
    /testMultipartUploadRejectsHeaderSyntaxBeforeNetworkAccess/,
  );
});

test("the absent legacy Railway upload route cannot be mistaken for a storage boundary", () => {
  assert.doesNotMatch(agentController, /@(?:Post|Put|Patch)\([^)]*library/);
  assert.doesNotMatch(
    agentController,
    /FileInterceptor|UploadedFile|originalname|multipart/i,
  );
  assert.match(
    relaySyncService,
    /new RelayAttachmentStorageService\(/,
  );
  assert.match(
    relayAttachmentStorage,
    /"storageKey" = 'postgres-chunks:' \|\| attachment\.id::text/,
  );
  for (const source of [relaySyncService, relayAttachmentStorage]) {
    assert.doesNotMatch(
      source,
      /storageKey\s*=\s*(?:attachment\.)?fileName/,
    );
  }
});

test("the Box manual serializer rejects header grammar before provider fetch", () => {
  assert.match(boxAdapter, /name\.includes\('\"'\)/);
  assert.match(boxAdapter, /\\p\{Cc\}/);
  assert.match(boxAdapter, /\\p\{Cf\}/);
  assert.doesNotMatch(boxAdapter, /name\.replace\(/);
  for (const required of [
    "carriage return",
    "line feed",
    "quote",
    "NUL",
    "directional format control",
    "not.toHaveBeenCalled",
  ]) {
    assert.ok(boxTests.includes(required), `missing Box fixture: ${required}`);
  }
});
