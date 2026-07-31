import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".swift"]);
const EXCLUDED_SOURCE =
  /(?:\.d\.ts|\.spec\.ts|\.spec\.tsx|\.test\.ts|\.test\.tsx)$/;

function normalizePath(path) {
  return path.split(sep).join("/");
}

function collectSourceFiles(directory, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    const metadata = statSync(path);
    if (metadata.isDirectory()) {
      if (
        ["node_modules", "dist", ".next", ".build", "Tests"].includes(entry)
      ) {
        continue;
      }
      collectSourceFiles(path, files);
    } else if (
      SOURCE_EXTENSIONS.has(extname(path)) &&
      !EXCLUDED_SOURCE.test(path)
    ) {
      files.push(path);
    }
  }
  return files;
}

export function countSourceLines(source) {
  if (source.length === 0) return 0;
  const lines = source.split("\n").length;
  return source.endsWith("\n") ? lines - 1 : lines;
}

function validateOversizedException(path, exception, errors) {
  if (
    !Number.isInteger(exception?.maximumLines) ||
    exception.maximumLines < 1 ||
    typeof exception.reason !== "string" ||
    exception.reason.trim().length < 20 ||
    !/^WP-\d{2}$/.test(exception.workPackage ?? "")
  ) {
    errors.push(`${path} has a malformed oversized-file exception`);
  }
}

function validateOversizedFileOwner(path, owners, errors) {
  const matchingPrefix = Object.keys(owners ?? {})
    .filter((prefix) => path.startsWith(prefix))
    .sort((left, right) => right.length - left.length)[0];
  if (
    !matchingPrefix ||
    typeof owners[matchingPrefix] !== "string" ||
    owners[matchingPrefix].trim().length < 5
  ) {
    errors.push(`${path} has no accountable oversized-file owner`);
  }
}

export function evaluateOversizedFiles(
  actualLines,
  maximumUnlistedFileLines,
  oversizedFiles,
  oversizedFileOwners = {},
) {
  const errors = [];

  for (const [path, lines] of Object.entries(actualLines)) {
    if (lines <= maximumUnlistedFileLines) continue;
    const exception = oversizedFiles[path];
    if (!exception) {
      errors.push(
        `${path} has ${lines} lines without an oversized-file exception`,
      );
      continue;
    }
    validateOversizedException(path, exception, errors);
    validateOversizedFileOwner(path, oversizedFileOwners, errors);
    if (lines > exception.maximumLines) {
      errors.push(
        `${path} grew from its ${exception.maximumLines}-line ratchet to ${lines} lines`,
      );
    }
  }

  for (const [path, exception] of Object.entries(oversizedFiles)) {
    validateOversizedException(path, exception, errors);
    validateOversizedFileOwner(path, oversizedFileOwners, errors);
    const lines = actualLines[path];
    if (lines === undefined) {
      errors.push(`oversized-file exception points to missing source ${path}`);
    } else if (lines <= maximumUnlistedFileLines) {
      errors.push(
        `stale oversized-file exception ${path}; current size is ${lines} lines`,
      );
    }
  }

  return errors;
}

export function evaluateOversizedFileProvenance(
  oversizedFiles,
  baselineSourcePaths,
) {
  return Object.keys(oversizedFiles)
    .filter((path) => !baselineSourcePaths.has(path))
    .map(
      (path) =>
        `${path} was added after the structural baseline and cannot receive an oversized-file exception`,
    );
}

export function evaluateGeneratedSources(
  sourceTexts,
  generatedSources,
  pathExists = () => true,
  oversizedFiles = {},
  functionRatchets = {},
) {
  const errors = [];
  for (const [path, declaration] of Object.entries(generatedSources ?? {})) {
    const hasGenerator =
      typeof declaration?.generator === "string" &&
      declaration.generator.startsWith("scripts/") &&
      declaration.generator.length > "scripts/".length;
    const hasExternalProvenance =
      typeof declaration?.externalProvenance === "string" &&
      declaration.externalProvenance.trim().length >= 20;
    if (
      typeof declaration?.marker !== "string" ||
      declaration.marker.trim().length < 5 ||
      typeof declaration?.owner !== "string" ||
      declaration.owner.trim().length < 5 ||
      hasGenerator === hasExternalProvenance
    ) {
      errors.push(`${path} has a malformed generated-source declaration`);
      continue;
    }

    const source = sourceTexts[path];
    if (source === undefined) {
      errors.push(
        `generated-source declaration points to missing source ${path}`,
      );
      continue;
    }
    const header = source.split("\n").slice(0, 10).join("\n");
    if (!header.includes(declaration.marker)) {
      errors.push(
        `${path} does not contain its generated-source marker in the first 10 lines`,
      );
    }
    if (hasGenerator && !pathExists(declaration.generator)) {
      errors.push(
        `${path} references missing generator ${declaration.generator}`,
      );
    }
    if (oversizedFiles[path]) {
      errors.push(
        `${path} cannot be both generated source and an oversized-file exception`,
      );
    }
    if (functionRatchets[path]) {
      errors.push(
        `${path} cannot be both generated source and a function ratchet`,
      );
    }
  }
  return errors;
}

export function selectHandwrittenSources(sourceTexts, generatedSources) {
  const generatedSourcePaths = new Set(Object.keys(generatedSources ?? {}));
  return Object.fromEntries(
    Object.entries(sourceTexts).filter(
      ([path]) => !generatedSourcePaths.has(path),
    ),
  );
}

function listRevisionPaths(repositoryRoot, revision) {
  const result = spawnSync("git", ["ls-tree", "-r", "--name-only", revision], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `could not read structural baseline revision ${revision}: ${result.stderr.trim()}`,
    );
  }
  return new Set(result.stdout.split("\n").filter(Boolean));
}

export function analyzeTypeScriptFunctions(path, source, ts) {
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  let maximumFunctionLines = 0;
  let maximumFunctionName = null;
  let functionsOver500Lines = 0;

  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) {
      const start =
        sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
          .line + 1;
      const end = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
      const lines = end - start + 1;
      if (lines > 500) functionsOver500Lines += 1;
      if (lines > maximumFunctionLines) {
        maximumFunctionLines = lines;
        maximumFunctionName = node.name?.getText(sourceFile) ?? "<anonymous>";
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  return {
    maximumFunctionLines,
    maximumFunctionName,
    functionsOver500Lines,
  };
}

export function auditSourceStructure(repositoryRoot, policy, ts) {
  const errors = [];
  const sourceTexts = {};
  const actualLines = {};
  const typeScriptSources = {};
  for (const sourceDirectory of policy.sourceDirectories ?? []) {
    for (const path of collectSourceFiles(
      resolve(repositoryRoot, sourceDirectory),
    )) {
      const relativePath = normalizePath(relative(repositoryRoot, path));
      const source = readFileSync(path, "utf8");
      sourceTexts[relativePath] = source;
    }
  }

  errors.push(
    ...evaluateGeneratedSources(
      sourceTexts,
      policy.generatedSources ?? {},
      (path) => existsSync(resolve(repositoryRoot, path)),
      policy.oversizedFiles ?? {},
      policy.functionRatchets ?? {},
    ),
  );
  const handwrittenSources = selectHandwrittenSources(
    sourceTexts,
    policy.generatedSources,
  );
  for (const [relativePath, source] of Object.entries(handwrittenSources)) {
    actualLines[relativePath] = countSourceLines(source);
    if (relativePath.endsWith(".ts") || relativePath.endsWith(".tsx")) {
      typeScriptSources[relativePath] = source;
    }
  }

  errors.push(
    ...evaluateOversizedFiles(
      actualLines,
      policy.maximumUnlistedFileLines,
      policy.oversizedFiles ?? {},
      policy.oversizedFileOwners ?? {},
    ),
  );
  if (
    typeof policy.oversizedExceptionBaselineRevision !== "string" ||
    policy.oversizedExceptionBaselineRevision.trim().length < 7
  ) {
    errors.push("source structure policy has no valid exception baseline");
  } else {
    errors.push(
      ...evaluateOversizedFileProvenance(
        policy.oversizedFiles ?? {},
        listRevisionPaths(
          repositoryRoot,
          policy.oversizedExceptionBaselineRevision,
        ),
      ),
    );
    errors.push(
      ...evaluateOversizedFileProvenance(
        policy.functionRatchets ?? {},
        listRevisionPaths(
          repositoryRoot,
          policy.oversizedExceptionBaselineRevision,
        ),
      ).map((error) =>
        error.replace("oversized-file exception", "function ratchet"),
      ),
    );
  }

  const functionMetrics = {};
  for (const [path, source] of Object.entries(typeScriptSources)) {
    const metrics = analyzeTypeScriptFunctions(path, source, ts);
    functionMetrics[path] = metrics;
    if (
      metrics.maximumFunctionLines >
        (policy.maximumUnlistedFunctionLines ?? 500) &&
      !policy.functionRatchets?.[path]
    ) {
      errors.push(
        `${path} has a ${metrics.maximumFunctionLines}-line ${metrics.maximumFunctionName} function without a function ratchet`,
      );
    }
  }
  for (const [path, ratchet] of Object.entries(policy.functionRatchets ?? {})) {
    const absolutePath = resolve(repositoryRoot, path);
    if (!existsSync(absolutePath)) {
      errors.push(`function ratchet points to missing source ${path}`);
      continue;
    }
    const metrics =
      functionMetrics[path] ??
      analyzeTypeScriptFunctions(path, readFileSync(absolutePath, "utf8"), ts);
    functionMetrics[path] = metrics;
    if (metrics.maximumFunctionLines > ratchet.maximumFunctionLines) {
      errors.push(
        `${path} maximum function grew from ${ratchet.maximumFunctionLines} to ${metrics.maximumFunctionLines} lines`,
      );
    }
    if (metrics.functionsOver500Lines > ratchet.maximumFunctionsOver500Lines) {
      errors.push(
        `${path} functions over 500 lines grew from ${ratchet.maximumFunctionsOver500Lines} to ${metrics.functionsOver500Lines}`,
      );
    }
  }

  return {
    errors,
    actualLines,
    functionMetrics,
    generatedSourceCount: Object.keys(policy.generatedSources ?? {}).length,
  };
}

function run() {
  const scriptPath = fileURLToPath(import.meta.url);
  const repositoryRoot = resolve(scriptPath, "../..");
  const policy = JSON.parse(
    readFileSync(
      resolve(repositoryRoot, "scripts/source-structure-policy.json"),
      "utf8",
    ),
  );
  if (policy.schemaVersion !== 1) {
    throw new Error("unsupported source structure policy schema");
  }
  const requireFromBackend = createRequire(
    resolve(repositoryRoot, "backend/package.json"),
  );
  const ts = requireFromBackend("typescript");
  const result = auditSourceStructure(repositoryRoot, policy, ts);
  if (result.errors.length > 0) {
    throw new Error(
      `Source structure gate failed:\n- ${result.errors.join("\n- ")}`,
    );
  }
  const oversizedCount = Object.values(result.actualLines).filter(
    (lines) => lines > policy.maximumUnlistedFileLines,
  ).length;
  console.log(
    `Source structure gate passed: ${oversizedCount} allowlisted handwritten files exceed ${policy.maximumUnlistedFileLines} lines; ${result.generatedSourceCount} exact generated sources are excluded by policy; no file or function ratchet grew.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
