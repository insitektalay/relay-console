import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const UNUSED_DIAGNOSTIC_CODES = new Set([6133, 6138, 6192, 6196, 6198]);

export function parseTypeScriptDiagnostics(output) {
  const diagnostics = [];
  for (const line of output.split("\n")) {
    const match = line.match(
      /^(.+?)\((\d+),(\d+)\): error TS(\d+):\s*(.*)$/,
    );
    if (!match) continue;
    diagnostics.push({
      file: match[1].replaceAll("\\", "/"),
      line: Number(match[2]),
      column: Number(match[3]),
      code: Number(match[4]),
      message: match[5],
    });
  }
  return diagnostics;
}

export function evaluateUnusedDiagnostics(diagnostics, maximumByFile) {
  const errors = [];
  const actualByFile = {};

  for (const diagnostic of diagnostics) {
    if (!UNUSED_DIAGNOSTIC_CODES.has(diagnostic.code)) {
      errors.push(
        `${diagnostic.file}:${diagnostic.line}:${diagnostic.column} has non-unused TypeScript error TS${diagnostic.code}: ${diagnostic.message}`,
      );
      continue;
    }
    actualByFile[diagnostic.file] =
      (actualByFile[diagnostic.file] ?? 0) + 1;
  }

  for (const [file, actual] of Object.entries(actualByFile)) {
    const maximum = maximumByFile[file] ?? 0;
    if (actual > maximum) {
      errors.push(
        `${file} has ${actual} unused diagnostics; its ratchet allows ${maximum}`,
      );
    }
  }

  const total = Object.values(actualByFile).reduce(
    (sum, value) => sum + value,
    0,
  );
  const maximumTotal = Object.values(maximumByFile).reduce(
    (sum, value) => sum + value,
    0,
  );
  if (total > maximumTotal) {
    errors.push(
      `unused diagnostic total grew from ${maximumTotal} to ${total}`,
    );
  }

  return { errors, actualByFile, total, maximumTotal };
}

export function runUnusedGate(repositoryRoot, surfaceName, surface) {
  const command = spawnSync(
    "pnpm",
    [
      "--dir",
      surface.directory,
      "exec",
      "tsc",
      "--noEmit",
      "--incremental",
      "false",
      "--noUnusedLocals",
      "--noUnusedParameters",
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  if (command.error) throw command.error;

  const output = `${command.stdout ?? ""}\n${command.stderr ?? ""}`;
  const diagnostics = parseTypeScriptDiagnostics(output);
  if (command.status !== 0 && diagnostics.length === 0) {
    throw new Error(
      `TypeScript unused gate could not parse ${surfaceName} compiler failure:\n${output.trim()}`,
    );
  }

  const result = evaluateUnusedDiagnostics(
    diagnostics,
    surface.maximumByFile,
  );
  if (result.errors.length > 0) {
    throw new Error(
      `TypeScript unused gate failed for ${surfaceName}:\n- ${result.errors.join("\n- ")}`,
    );
  }

  console.log(
    `TypeScript unused gate passed for ${surfaceName}: ${result.total}/${result.maximumTotal} diagnostics across ${Object.keys(result.actualByFile).length} files.`,
  );
  return result;
}

function run() {
  const scriptPath = fileURLToPath(import.meta.url);
  const repositoryRoot = resolve(dirname(scriptPath), "..");
  const policy = JSON.parse(
    readFileSync(
      resolve(repositoryRoot, "scripts/typescript-unused-baseline.json"),
      "utf8",
    ),
  );
  if (policy.schemaVersion !== 1) {
    throw new Error("unsupported TypeScript unused baseline schema");
  }

  const requested = process.argv.slice(2);
  const surfaceNames =
    requested.length > 0 ? requested : Object.keys(policy.surfaces);
  for (const surfaceName of surfaceNames) {
    const surface = policy.surfaces[surfaceName];
    if (!surface) {
      throw new Error(`unknown TypeScript unused surface ${surfaceName}`);
    }
    runUnusedGate(repositoryRoot, surfaceName, surface);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
