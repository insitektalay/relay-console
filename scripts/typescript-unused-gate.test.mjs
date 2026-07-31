import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateUnusedDiagnostics,
  parseTypeScriptDiagnostics,
} from "./typescript-unused-gate.mjs";

test("parseTypeScriptDiagnostics reads compiler locations and codes", () => {
  assert.deepEqual(
    parseTypeScriptDiagnostics(
      "components/app.tsx(10,3): error TS6133: 'unused' is declared but its value is never read.\n",
    ),
    [
      {
        file: "components/app.tsx",
        line: 10,
        column: 3,
        code: 6133,
        message: "'unused' is declared but its value is never read.",
      },
    ],
  );
});

test("evaluateUnusedDiagnostics accepts a decreasing baseline", () => {
  const result = evaluateUnusedDiagnostics(
    [
      {
        file: "src/app.ts",
        line: 1,
        column: 1,
        code: 6133,
        message: "unused",
      },
      {
        file: "src/app.ts",
        line: 2,
        column: 1,
        code: 6138,
        message: "unused property",
      },
    ],
    { "src/app.ts": 2 },
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.total, 2);
  assert.equal(result.maximumTotal, 2);
});

test("evaluateUnusedDiagnostics rejects a new unused file", () => {
  const result = evaluateUnusedDiagnostics(
    [
      {
        file: "src/new.ts",
        line: 1,
        column: 1,
        code: 6133,
        message: "unused",
      },
    ],
    { "src/app.ts": 2 },
  );
  assert.ok(
    result.errors.includes(
      "src/new.ts has 1 unused diagnostics; its ratchet allows 0",
    ),
  );
});

test("evaluateUnusedDiagnostics rejects non-unused compiler errors", () => {
  const result = evaluateUnusedDiagnostics(
    [
      {
        file: "src/app.ts",
        line: 1,
        column: 1,
        code: 2322,
        message: "Type 'string' is not assignable to type 'number'.",
      },
    ],
    {},
  );
  assert.match(result.errors[0], /non-unused TypeScript error TS2322/);
});
