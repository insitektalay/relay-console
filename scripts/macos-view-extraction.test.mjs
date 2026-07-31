import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const appRoot = resolve(
  root,
  "RelayConsoleSwift/Sources/RelayConsoleApp",
);
const featureRoot = resolve(appRoot, "Features");

function swiftFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? swiftFiles(path)
      : entry.name.endsWith(".swift")
        ? [path]
        : [];
  });
}

function sourceLines(path) {
  return readFileSync(path, "utf8").split(/\r?\n/);
}

test("macOS views stay within the WP-09 extraction limits", () => {
  const viewsPath = resolve(appRoot, "Views.swift");
  const viewsLines = sourceLines(viewsPath);
  const featureFiles = swiftFiles(featureRoot);

  assert.ok(
    viewsLines.length < 5_000,
    `Views.swift has ${viewsLines.length} lines; expected fewer than 5,000`,
  );
  assert.ok(featureFiles.length >= 60, "expected the extracted feature modules");

  for (const path of featureFiles) {
    const displayPath = relative(root, path);
    const lines = sourceLines(path);
    assert.ok(
      lines.length < 2_000,
      `${displayPath} has ${lines.length} lines; expected fewer than 2,000`,
    );
    for (const [index, line] of lines.entries()) {
      assert.ok(
        line.length <= 300,
        `${displayPath}:${index + 1} has ${line.length} characters`,
      );
    }
  }
});

test("macOS feature folders own their expected screen families", () => {
  const expectedLandmarks = new Map([
    ["Agents", "struct AgentsScreen: View"],
    ["AgentOps", "struct AgentOpsSidebarPanel: View"],
    ["Applications", "struct ApplicationsSidebarPanel: View"],
    ["Approvals", "struct ApprovalsSidebarPanel: View"],
    ["Artifacts", "struct ArtifactsSidebarPanel: View"],
    ["Chats", "struct ChatScreen: View"],
    ["Insights", "struct InsightsSidebarPanel: View"],
    ["Settings", "struct SettingsScreen: View"],
  ]);

  for (const [directory, landmark] of expectedLandmarks) {
    const source = swiftFiles(resolve(featureRoot, directory))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    assert.ok(source.includes(landmark), `${directory} is missing ${landmark}`);
  }
});

test("extracted macOS view sources do not redeclare top-level types", () => {
  const sources = [
    resolve(appRoot, "Views.swift"),
    ...swiftFiles(featureRoot),
  ];
  const declarations = new Map();

  for (const path of sources) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(
      /^(?:@[\w().,:\s]+\n)*(?:public |internal )?(?:struct|class|enum|actor|protocol)\s+(\w+)/gm,
    )) {
      const name = match[1];
      const prior = declarations.get(name);
      assert.equal(
        prior,
        undefined,
        `${name} is declared in both ${prior} and ${relative(root, path)}`,
      );
      declarations.set(name, relative(root, path));
    }
  }
});
