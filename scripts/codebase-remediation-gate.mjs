import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VALID_STATES = new Set([
  "pending",
  "in-progress",
  "implemented-not-live",
  "blocked",
  "complete",
]);

const PLACEHOLDER_EVIDENCE = /^(?:pending|none|n\/a|tbd|-)?$/i;

export function countLines(source) {
  if (source.length === 0) return 0;
  const lines = source.split("\n").length;
  return source.endsWith("\n") ? lines - 1 : lines;
}

export function parseCompletionLedger(source) {
  const packages = [];
  for (const line of source.split("\n")) {
    const match = line.match(
      /^\|\s*(WP-\d{2})\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|$/,
    );
    if (!match) continue;
    packages.push({
      id: match[1],
      state: match[2].trim(),
      evidence: match[3].trim(),
      nextAction: match[4].trim(),
    });
  }
  return packages;
}

function collectFiles(directory, extension, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    const metadata = statSync(path);
    if (metadata.isDirectory()) {
      collectFiles(path, extension, files);
    } else if (extname(path) === extension) {
      files.push(path);
    }
  }
  return files;
}

function countLongLines(source, maximumLength) {
  return source
    .split("\n")
    .filter((line) => line.length > maximumLength).length;
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function validateRelativeMarkdownLinks(documentPath, source) {
  const errors = [];
  for (const match of source.matchAll(
    /\[[^\]]+\]\((\.\/[^)#]+)(?:#[^)]+)?\)/g,
  )) {
    const target = resolve(dirname(documentPath), match[1]);
    if (!existsSync(target)) {
      errors.push(
        `${documentPath} links to missing relative target ${match[1]}`,
      );
    }
  }
  return errors;
}

export function auditRepository(repositoryRoot, baseline) {
  const errors = [];
  const metrics = {
    targetLines: {},
    swiftLinesOver300Characters: 0,
    connectorSlugConditionals: 0,
  };

  if (baseline.schemaVersion !== 1) {
    errors.push("unsupported remediation baseline schema");
  }

  const programDirectory = resolve(
    repositoryRoot,
    baseline.programDirectory,
  );
  for (const document of baseline.requiredDocuments ?? []) {
    const documentPath = resolve(programDirectory, document);
    if (!existsSync(documentPath)) {
      errors.push(`missing remediation document ${document}`);
      continue;
    }
    const source = readFileSync(documentPath, "utf8");
    if (source.trim().length === 0) {
      errors.push(`remediation document ${document} is empty`);
    }
    errors.push(...validateRelativeMarkdownLinks(documentPath, source));
  }

  for (const [relativePath, maximumLines] of Object.entries(
    baseline.targetFiles ?? {},
  )) {
    const targetPath = resolve(repositoryRoot, relativePath);
    if (!existsSync(targetPath)) {
      errors.push(`missing structural target ${relativePath}`);
      continue;
    }
    const lines = countLines(readFileSync(targetPath, "utf8"));
    metrics.targetLines[relativePath] = lines;
    if (lines > maximumLines) {
      errors.push(
        `${relativePath} grew from its ${maximumLines}-line ratchet to ${lines} lines`,
      );
    }
  }

  const swiftSourceRoot = resolve(repositoryRoot, "RelayConsoleSwift/Sources");
  for (const path of collectFiles(swiftSourceRoot, ".swift")) {
    metrics.swiftLinesOver300Characters += countLongLines(
      readFileSync(path, "utf8"),
      300,
    );
  }
  const swiftRatchet =
    baseline.structuralRatchets?.maxSwiftLinesOver300Characters;
  if (
    Number.isInteger(swiftRatchet) &&
    metrics.swiftLinesOver300Characters > swiftRatchet
  ) {
    errors.push(
      `handwritten Swift lines over 300 characters grew from ${swiftRatchet} to ${metrics.swiftLinesOver300Characters}`,
    );
  }

  const connectorExecutionPath = resolve(
    repositoryRoot,
    "backend/src/modules/marketplace/connectors/connector-execution.service.ts",
  );
  if (existsSync(connectorExecutionPath)) {
    metrics.connectorSlugConditionals = countMatches(
      readFileSync(connectorExecutionPath, "utf8"),
      /manifest\.slug ===/g,
    );
  }
  const connectorRatchet =
    baseline.structuralRatchets?.maxConnectorSlugConditionals;
  if (
    Number.isInteger(connectorRatchet) &&
    metrics.connectorSlugConditionals > connectorRatchet
  ) {
    errors.push(
      `connector slug conditionals grew from ${connectorRatchet} to ${metrics.connectorSlugConditionals}`,
    );
  }

  const ledgerPath = resolve(programDirectory, "05-completion-ledger.md");
  const ledger = existsSync(ledgerPath)
    ? parseCompletionLedger(readFileSync(ledgerPath, "utf8"))
    : [];
  const expectedPackages = baseline.workPackages ?? [];
  const packagesById = new Map();
  for (const workPackage of ledger) {
    if (packagesById.has(workPackage.id)) {
      errors.push(`duplicate completion-ledger row ${workPackage.id}`);
    }
    packagesById.set(workPackage.id, workPackage);
    if (!VALID_STATES.has(workPackage.state)) {
      errors.push(
        `${workPackage.id} has unknown state ${workPackage.state}`,
      );
    }
    if (
      workPackage.state === "complete" &&
      PLACEHOLDER_EVIDENCE.test(workPackage.evidence)
    ) {
      errors.push(`${workPackage.id} claims completion without evidence`);
    }
  }
  for (const id of expectedPackages) {
    if (!packagesById.has(id)) {
      errors.push(`completion ledger is missing ${id}`);
    }
  }
  for (const id of packagesById.keys()) {
    if (!expectedPackages.includes(id)) {
      errors.push(`completion ledger contains unexpected work package ${id}`);
    }
  }

  const nextWorkPackage = expectedPackages
    .map((id) => packagesById.get(id))
    .find((item) => item && item.state !== "complete");

  return {
    errors,
    metrics,
    nextWorkPackage: nextWorkPackage ?? null,
  };
}

function run() {
  const scriptPath = fileURLToPath(import.meta.url);
  const repositoryRoot = resolve(dirname(scriptPath), "..");
  const baselinePath = resolve(
    repositoryRoot,
    "scripts/codebase-remediation-baseline.json",
  );
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const result = auditRepository(repositoryRoot, baseline);

  if (result.errors.length > 0) {
    throw new Error(
      `Codebase remediation goal audit failed:\n- ${result.errors.join("\n- ")}`,
    );
  }

  console.log(
    `Codebase remediation structural audit passed: ${result.metrics.swiftLinesOver300Characters} Swift lines over 300 characters, ${result.metrics.connectorSlugConditionals} connector slug conditionals.`,
  );
  if (result.nextWorkPackage) {
    console.log(
      `Next incomplete work package: ${result.nextWorkPackage.id} (${result.nextWorkPackage.state}). ${result.nextWorkPackage.nextAction}`,
    );
  } else {
    console.log(
      "All ledger rows claim completion. Run the three-pass completion challenge before closing the goal.",
    );
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
