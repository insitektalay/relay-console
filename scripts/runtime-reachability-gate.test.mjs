import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import {
  collectModuleSpecifiers,
  evaluateOrphans,
} from "./runtime-reachability-gate.mjs";

const require = createRequire(
  new URL("../backend/package.json", import.meta.url),
);
const ts = require("typescript");

test("collectModuleSpecifiers reads all static references and literal dynamic loads", () => {
  const source = ts.createSourceFile(
    "example.ts",
    [
      'import value from "./value";',
      'import "./side-effect";',
      'import type { TypeOnly } from "./type-only";',
      'import { type InlineType } from "./inline-type-only";',
      'import { type MixedType, mixedValue } from "./mixed";',
      'export { other } from "./other";',
      'export type { ExportedType } from "./export-type-only";',
      'export { type InlineExportType } from "./inline-export-type-only";',
      'export { type MixedExportType, mixedExportValue } from "./mixed-export";',
      'const lazy = import("./lazy");',
      'const legacy = require("./legacy");',
      'const ignored = import(`./${value}`);',
    ].join("\n"),
    ts.ScriptTarget.Latest,
    true,
  );
  assert.deepEqual(collectModuleSpecifiers(source, ts), [
    "./value",
    "./side-effect",
    "./type-only",
    "./inline-type-only",
    "./mixed",
    "./other",
    "./export-type-only",
    "./inline-export-type-only",
    "./mixed-export",
    "./lazy",
    "./legacy",
  ]);
});

test("collectModuleSpecifiers can restrict the graph to runtime bindings", () => {
  const source = ts.createSourceFile(
    "example.ts",
    [
      'import type { TypeOnly } from "./type-only";',
      'import { type InlineType } from "./inline-type-only";',
      'import { type MixedType, mixedValue } from "./mixed";',
      'export type { ExportedType } from "./export-type-only";',
      'export { runtimeValue } from "./runtime";',
    ].join("\n"),
    ts.ScriptTarget.Latest,
    true,
  );
  assert.deepEqual(
    collectModuleSpecifiers(source, ts, { includeTypeOnly: false }),
    ["./mixed", "./runtime"],
  );
});

test("evaluateOrphans accepts explained work-package debt", () => {
  assert.deepEqual(
    evaluateOrphans(["src/old.ts"], {
      "src/old.ts": {
        reason: "Confirmed runtime orphan scheduled for deletion.",
        workPackage: "WP-03",
      },
    }),
    [],
  );
});

test("evaluateOrphans accepts an explained generator pattern", () => {
  assert.deepEqual(
    evaluateOrphans(
      ["src/generators/example/input.ts"],
      {},
      [
        {
          pattern: "^src/generators/[^/]+/input\\.ts$",
          reason: "Generator scripts discover this source through the filesystem.",
          workPackage: "WP-12",
        },
      ],
    ),
    [],
  );
});

test("evaluateOrphans rejects new, malformed and stale exceptions", () => {
  const errors = evaluateOrphans(["src/new.ts", "src/bad.ts"], {
    "src/bad.ts": {
      reason: "short",
      workPackage: "later",
    },
    "src/stale.ts": {
      reason: "This entry no longer matches an orphan.",
      workPackage: "WP-03",
    },
  });
  assert.ok(errors.includes("unexplained runtime orphan src/new.ts"));
  assert.ok(
    errors.includes("runtime orphan src/bad.ts has a malformed exception"),
  );
  assert.ok(errors.includes("stale runtime orphan exception src/stale.ts"));
});

test("evaluateOrphans rejects a stale pattern", () => {
  assert.deepEqual(
    evaluateOrphans([], {}, [
      {
        pattern: "^src/generated/",
        reason: "Generated sources use this explicitly reviewed path.",
        workPackage: "WP-12",
      },
    ]),
    ["stale runtime orphan pattern ^src/generated/"],
  );
});
