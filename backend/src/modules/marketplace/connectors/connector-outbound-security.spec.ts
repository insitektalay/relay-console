import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import * as ts from "typescript";

const connectorRoot = __dirname;

function productionTypescriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      return productionTypescriptFiles(absolute);
    }
    return entry.endsWith(".ts") && !entry.endsWith(".spec.ts")
      ? [absolute]
      : [];
  });
}

function globalFetchCalls(filename: string) {
  const sourceText = readFileSync(filename, "utf8");
  const source = ts.createSourceFile(
    filename,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const calls: number[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "fetch"
    ) {
      calls.push(
        source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return calls;
}

describe("H-05 connector outbound transport boundary", () => {
  const productionFiles = productionTypescriptFiles(connectorRoot);

  it("has no production connector call to global fetch", () => {
    const violations = productionFiles.flatMap((filename) =>
      globalFetchCalls(filename).map(
        (line) => `${relative(connectorRoot, filename)}:${line}`,
      ),
    );
    expect(violations).toEqual([]);
  });

  it("routes every fetch-based connector through the pinned safe transport", () => {
    const migrated = productionFiles.filter((filename) =>
      readFileSync(filename, "utf8").includes("safeConnectorFetch"),
    );
    expect(migrated.length).toBeGreaterThanOrEqual(380);
    for (const filename of migrated) {
      if (filename.endsWith("safe-connector-fetch.ts")) continue;
      expect(readFileSync(filename, "utf8")).toContain("safe-connector-fetch");
    }

    const wrapper = readFileSync(
      join(connectorRoot, "safe-connector-fetch.ts"),
      "utf8",
    );
    expect(wrapper).toContain("safeOutboundHttpClient.requestBuffer");
    expect(wrapper).toContain("allowedHosts: [url.hostname]");
    expect(wrapper).toContain("maxResponseBytes");
    expect(wrapper).toContain("maxEncodedResponseBytes");
  });

  it("keeps custom HTTPS transports pinned and bounded", () => {
    const customHttpsFiles = productionFiles.filter((filename) =>
      readFileSync(filename, "utf8").includes("httpsRequest("),
    );
    expect(
      customHttpsFiles.map((filename) => relative(connectorRoot, filename)),
    ).toEqual([
      "archbee/archbee-api.adapter.ts",
      "knowledgeowl/knowledgeowl-api.adapter.ts",
      "mastodon/mastodon-api.adapter.ts",
      "tettra/tettra-api.adapter.ts",
      "tresorit/tresorit-s3.adapter.ts",
    ]);

    for (const name of [
      "mastodon/mastodon-api.adapter.ts",
      "tresorit/tresorit-s3.adapter.ts",
    ]) {
      const source = readFileSync(join(connectorRoot, name), "utf8");
      expect(source).toContain("isPublicIpAddress");
      expect(source).toMatch(/lookup:\s*\([^)]*\)\s*=>/);
      expect(source).toMatch(/response exceed/i);
    }
  });

  it("restricts tenant-selected Bynder portals to the provider domain", () => {
    const bynder = readFileSync(
      join(connectorRoot, "bynder/bynder-api.adapter.ts"),
      "utf8",
    );
    expect(bynder).toContain('=== "bynder.com"');
    expect(bynder).toContain('endsWith(".bynder.com")');
  });

  it("covers the X and Bluesky marketplace OAuth transports", () => {
    const marketplaceRoot = join(connectorRoot, "..");
    const xService = join(marketplaceRoot, "x-marketplace.service.ts");
    expect(globalFetchCalls(xService)).toEqual([]);
    expect(readFileSync(xService, "utf8")).toContain("safeConnectorFetch");

    const bluesky = readFileSync(
      join(marketplaceRoot, "bluesky/bluesky-oauth-security.ts"),
      "utf8",
    );
    expect(bluesky).toContain("isPublicIpAddress");
    expect(bluesky).toMatch(/lookup:\s*\([^)]*\)\s*=>/);
    expect(bluesky).toContain("MAX_JSON_BYTES");
  });
});
