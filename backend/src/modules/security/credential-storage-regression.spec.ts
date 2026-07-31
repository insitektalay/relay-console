import { readFileSync } from "fs";
import { resolve } from "path";

const backendRoot = resolve(__dirname, "../../..");

function readBackendFile(relativePath: string) {
  return readFileSync(resolve(backendRoot, relativePath), "utf8");
}

function columnProperties(source: string) {
  const columns: string[] = [];
  let pendingColumnDecorator = false;

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("@Column")) {
      pendingColumnDecorator = true;
      continue;
    }

    if (!pendingColumnDecorator) continue;
    const property = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)(?:!|\?)?:/);
    if (property) {
      columns.push(property[1]);
      pendingColumnDecorator = false;
    }
  }

  return columns;
}

function columnDecoratorForProperty(source: string, propertyName: string) {
  const lines = source.split(/\r?\n/);
  const propertyPattern = new RegExp(
    `^\\s*${propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:!|\\?)?:`,
  );
  const propertyIndex = lines.findIndex((line) => propertyPattern.test(line));
  if (propertyIndex === -1) return "";

  let decoratorIndex = propertyIndex - 1;
  while (
    decoratorIndex >= 0 &&
    !lines[decoratorIndex].trim().startsWith("@Column")
  ) {
    decoratorIndex -= 1;
  }
  return decoratorIndex >= 0
    ? lines.slice(decoratorIndex, propertyIndex).join("\n")
    : "";
}

describe("stored connection credential regressions", () => {
  it("keeps third-party connection secrets in encrypted select-false columns", () => {
    const contracts = [
      {
        file: "src/entities/openclaw-connection.entity.ts",
        required: [
          "apiKeyCiphertext",
          "apiKeyIv",
          "apiKeyAuthTag",
          "apiKeyKeyVersion",
        ],
        forbiddenPlaintext: ["apiKey"],
      },
      {
        file: "src/entities/paperclip-connection.entity.ts",
        required: [
          "bearerTokenCiphertext",
          "bearerTokenIv",
          "bearerTokenAuthTag",
          "bearerTokenKeyVersion",
        ],
        forbiddenPlaintext: ["bearerToken"],
      },
      {
        file: "src/entities/marketplace-connection.entity.ts",
        required: [
          "secretCiphertext",
          "secretIv",
          "secretAuthTag",
          "secretKeyVersion",
        ],
        forbiddenPlaintext: ["secret"],
      },
      {
        file: "src/entities/marketplace-oauth-state.entity.ts",
        required: [
          "codeVerifierCiphertext",
          "codeVerifierIv",
          "codeVerifierAuthTag",
          "codeVerifierKeyVersion",
          "clientSecretCiphertext",
          "clientSecretIv",
          "clientSecretAuthTag",
          "clientSecretKeyVersion",
        ],
        forbiddenPlaintext: ["clientSecret", "codeVerifier"],
        legacySelectFalse: ["legacyCodeVerifier"],
      },
    ];

    for (const contract of contracts) {
      const source = readBackendFile(contract.file);
      const columns = columnProperties(source);

      expect(columns).toEqual(expect.arrayContaining(contract.required));
      for (const forbidden of contract.forbiddenPlaintext) {
        expect(columns).not.toContain(forbidden);
      }
      for (const encryptedColumn of contract.required) {
        expect(columnDecoratorForProperty(source, encryptedColumn)).toMatch(
          /select:\s*false/,
        );
      }
      const legacySelectFalse =
        "legacySelectFalse" in contract ? contract.legacySelectFalse : [];
      for (const legacyColumn of legacySelectFalse) {
        expect(columnDecoratorForProperty(source, legacyColumn)).toMatch(
          /select:\s*false/,
        );
      }
    }
  });

  it("does not directly log or audit raw connection secret variables", () => {
    const files = [
      "src/modules/bridge/bridge.service.ts",
      "src/modules/paperclip/paperclip-connection.service.ts",
      "src/modules/marketplace/marketplace.service.ts",
      "src/modules/marketplace/connectors/connector-oauth.service.ts",
      "src/modules/marketplace/connectors/oauth/service-extensions/oauth-start.extension.ts",
      "src/modules/marketplace/connectors/oauth/service-extensions/oauth-complete.extension.ts",
      "src/modules/marketplace/connectors/connector-credential.service.ts",
      "src/modules/marketplace/x-marketplace.service.ts",
    ];
    const directSecretLoggingPatterns = [
      /console\.(?:log|warn|error|debug)\s*\([^)]*\b(?:apiKey|bearerToken|clientSecret|codeVerifier|accessToken|refreshToken|credentials)\b/gs,
      /logger\.(?:log|warn|error|debug|verbose)\s*\(\s*`[^`]*\$\{[^}]*(?:apiKey|bearerToken|clientSecret|codeVerifier|accessToken|refreshToken|credentials)[^}]*\}/gs,
      /logger\.(?:log|warn|error|debug|verbose)\s*\([^)]*\b(?:dto\.credentials|input\.apiKey|dto\.bearerToken|clientSecret|codeVerifier|accessToken|refreshToken)\b/gs,
    ];

    for (const file of files) {
      const source = readBackendFile(file);
      for (const pattern of directSecretLoggingPatterns) {
        expect(source.match(pattern) ?? []).toEqual([]);
      }
    }

    const auditedConnectionWriteMarkers = [
      [
        "src/modules/bridge/bridge.service.ts",
        'eventType: "bridge.connection.created"',
      ],
      [
        "src/modules/bridge/bridge.service.ts",
        'eventType: "bridge.connection.configured"',
      ],
      [
        "src/modules/marketplace/marketplace.service.ts",
        'eventType: "marketplace.connection.created"',
      ],
      [
        "src/modules/marketplace/marketplace.service.ts",
        'eventType: "marketplace.connection.updated"',
      ],
      [
        "src/modules/marketplace/x-marketplace.service.ts",
        'eventType: "marketplace.x.oauth.started"',
      ],
      [
        "src/modules/marketplace/x-marketplace.service.ts",
        'eventType: "marketplace.x.oauth.completed"',
      ],
      [
        "src/modules/marketplace/connectors/oauth/service-extensions/oauth-start-phases.ts",
        "eventType: `marketplace.${context.manifest.slug}.oauth.started`",
      ],
      [
        "src/modules/marketplace/connectors/oauth/service-extensions/oauth-complete-phases-final.ts",
        "eventType: `marketplace.${context.manifest.slug}.oauth.completed`",
      ],
    ] as const;

    for (const [file, marker] of auditedConnectionWriteMarkers) {
      const source = readBackendFile(file);
      const markerIndex = source.indexOf(marker);
      expect(markerIndex).toBeGreaterThanOrEqual(0);
      const snippet = source.slice(
        Math.max(0, markerIndex - 300),
        markerIndex + 900,
      );
      expect(snippet).not.toMatch(
        /\b(?:apiKey|bearerToken|clientSecret|codeVerifier|accessToken|refreshToken|credentials)\s*:/i,
      );
      expect(snippet).not.toMatch(
        /\$\{[^}]*(?:apiKey|bearerToken|clientSecret|codeVerifier|accessToken|refreshToken|credentials)[^}]*\}/i,
      );
    }
  });
});
