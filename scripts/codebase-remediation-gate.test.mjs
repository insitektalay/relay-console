import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  auditRepository,
  countLines,
  parseCompletionLedger,
} from "./codebase-remediation-gate.mjs";

const workPackages = ["WP-00", "WP-01"];
const requiredDocuments = [
  "README.md",
  "01-baseline-and-scope.md",
  "02-target-architecture.md",
  "03-work-breakdown.md",
  "04-verification-and-deployment.md",
  "05-completion-ledger.md",
  "06-goal-audit-loop.md",
  "07-risk-and-decision-log.md",
];

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "clawchat-remediation-gate-"));
  const program = join(root, "docs/program");
  mkdirSync(program, { recursive: true });
  mkdirSync(
    join(root, "backend/src/modules/marketplace/connectors"),
    { recursive: true },
  );
  mkdirSync(join(root, "RelayConsoleSwift/Sources"), {
    recursive: true,
  });
  mkdirSync(join(root, "web/components/marketplace"), {
    recursive: true,
  });

  for (const document of requiredDocuments) {
    writeFileSync(join(program, document), `# ${document}\n`);
  }
  writeFileSync(
    join(program, "05-completion-ledger.md"),
    [
      "# Completion ledger",
      "",
      "| ID | State | Evidence | Next action |",
      "| --- | --- | --- | --- |",
      "| WP-00 | complete | revision abc123 | none |",
      "| WP-01 | pending | pending | implement it |",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(
      root,
      "backend/src/modules/marketplace/connectors/connector-execution.service.ts",
    ),
    'if (manifest.slug === "example") return;\n',
  );
  writeFileSync(
    join(
      root,
      "backend/src/modules/marketplace/connectors/connector-oauth.service.ts",
    ),
    "export class OAuth {}\n",
  );
  writeFileSync(
    join(root, "web/components/clawchat-web-app.tsx"),
    "export function App() {}\n",
  );
  writeFileSync(
    join(root, "web/components/marketplace/marketplace-screen.tsx"),
    "export function Screen() {}\n",
  );
  writeFileSync(
    join(root, "RelayConsoleSwift/Sources/Views.swift"),
    "struct View {}\n",
  );

  const baseline = {
    schemaVersion: 1,
    programDirectory: "docs/program",
    requiredDocuments,
    targetFiles: {
      "backend/src/modules/marketplace/connectors/connector-execution.service.ts": 1,
      "backend/src/modules/marketplace/connectors/connector-oauth.service.ts": 1,
      "web/components/clawchat-web-app.tsx": 1,
      "web/components/marketplace/marketplace-screen.tsx": 1,
      "RelayConsoleSwift/Sources/Views.swift": 1,
    },
    structuralRatchets: {
      maxSwiftLinesOver300Characters: 0,
      maxConnectorSlugConditionals: 1,
    },
    workPackages,
  };

  return { root, baseline };
}

test("countLines handles trailing and unterminated lines", () => {
  assert.equal(countLines(""), 0);
  assert.equal(countLines("one\n"), 1);
  assert.equal(countLines("one\ntwo"), 2);
});

test("parseCompletionLedger reads work-package rows", () => {
  assert.deepEqual(
    parseCompletionLedger(
      "| WP-00 | in-progress | docs exist | add command |\n",
    ),
    [
      {
        id: "WP-00",
        state: "in-progress",
        evidence: "docs exist",
        nextAction: "add command",
      },
    ],
  );
});

test("auditRepository reports the first incomplete work package", () => {
  const fixture = createFixture();
  try {
    const result = auditRepository(fixture.root, fixture.baseline);
    assert.deepEqual(result.errors, []);
    assert.equal(result.nextWorkPackage?.id, "WP-01");
    assert.equal(result.metrics.connectorSlugConditionals, 1);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("auditRepository rejects structural growth", () => {
  const fixture = createFixture();
  try {
    writeFileSync(
      join(
        fixture.root,
        "backend/src/modules/marketplace/connectors/connector-execution.service.ts",
      ),
      [
        'if (manifest.slug === "one") return;',
        'if (manifest.slug === "two") return;',
        "",
      ].join("\n"),
    );
    const result = auditRepository(fixture.root, fixture.baseline);
    assert.ok(
      result.errors.some((error) =>
        error.includes("grew from its 1-line ratchet to 2 lines"),
      ),
    );
    assert.ok(
      result.errors.some((error) =>
        error.includes("connector slug conditionals grew from 1 to 2"),
      ),
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("auditRepository rejects unsupported completion claims", () => {
  const fixture = createFixture();
  try {
    writeFileSync(
      join(
        fixture.root,
        "docs/program/05-completion-ledger.md",
      ),
      [
        "| ID | State | Evidence | Next action |",
        "| --- | --- | --- | --- |",
        "| WP-00 | complete | revision abc123 | none |",
        "| WP-01 | complete | pending | none |",
        "",
      ].join("\n"),
    );
    const result = auditRepository(fixture.root, fixture.baseline);
    assert.ok(
      result.errors.includes("WP-01 claims completion without evidence"),
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
