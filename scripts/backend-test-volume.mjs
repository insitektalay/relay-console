import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(scriptPath, "../..");
const backendRoot = resolve(repositoryRoot, "backend");
const sourceRoot = resolve(backendRoot, "src");
const requireFromBackend = createRequire(resolve(backendRoot, "package.json"));
const ts = requireFromBackend("typescript");

function normalizePath(path) {
  return path.split(sep).join("/");
}

function collectSpecs(directory, specs = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      collectSpecs(path, specs);
    } else if (entry.name.endsWith(".spec.ts")) {
      specs.push(normalizePath(relative(sourceRoot, path)));
    }
  }
  return specs;
}

function rootTestIdentifier(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    return rootTestIdentifier(expression.expression);
  }
  if (ts.isCallExpression(expression)) {
    return rootTestIdentifier(expression.expression);
  }
  return null;
}

export function countTestDeclarations(path, source) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let count = 0;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      !(ts.isCallExpression(node.parent) && node.parent.expression === node) &&
      ["it", "test"].includes(rootTestIdentifier(node.expression) ?? "")
    ) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return count;
}

export function classifyBackendSpec(path, coreRiskSpecs) {
  if (coreRiskSpecs.has(path)) return "core-risk";
  if (
    path.startsWith("modules/marketplace/packs/") ||
    /^modules\/marketplace\/connectors\/[^/]+\//.test(path)
  ) {
    return "marketplace-provider";
  }
  if (path.startsWith("modules/marketplace/")) return "marketplace-core";
  return "other-backend";
}

export function buildBackendTestVolumeReport() {
  const plan = JSON.parse(
    readFileSync(resolve(backendRoot, "core-risk-test-plan.json"), "utf8"),
  );
  if (plan.schemaVersion !== 1 || !plan.domains) {
    throw new Error("unsupported backend core-risk test plan");
  }
  const coreRiskSpecs = new Set(
    Object.values(plan.domains).flatMap(({ specs }) => specs),
  );
  const missingPlanFiles = [
    ...coreRiskSpecs,
    ...Object.values(plan.domains).flatMap(({ sources }) => sources),
  ].filter((path) => !existsSync(resolve(sourceRoot, path)));
  if (missingPlanFiles.length > 0) {
    throw new Error(
      `backend core-risk plan references missing files: ${missingPlanFiles.join(", ")}`,
    );
  }

  const buckets = {};
  for (const path of collectSpecs(sourceRoot).sort()) {
    const bucket = classifyBackendSpec(path, coreRiskSpecs);
    const summary = buckets[bucket] ?? { files: 0, tests: 0 };
    summary.files += 1;
    summary.tests += countTestDeclarations(
      path,
      readFileSync(resolve(sourceRoot, path), "utf8"),
    );
    buckets[bucket] = summary;
  }

  return {
    schemaVersion: 1,
    total: Object.values(buckets).reduce(
      (summary, bucket) => ({
        files: summary.files + bucket.files,
        tests: summary.tests + bucket.tests,
      }),
      { files: 0, tests: 0 },
    ),
    buckets,
  };
}

function run() {
  const report = buildBackendTestVolumeReport();
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] === scriptPath) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
