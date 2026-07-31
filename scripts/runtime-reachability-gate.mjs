import { createRequire } from "node:module";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSION = /\.(?:ts|tsx)$/;
const EXCLUDED_SOURCE = /(?:\.d\.ts|\.spec\.ts|\.spec\.tsx|\.test\.ts|\.test\.tsx)$/;

function normalizePath(path) {
  return path.split(sep).join("/");
}

function collectSourceFiles(directory, files = []) {
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    const metadata = statSync(path);
    if (metadata.isDirectory()) {
      if (["node_modules", "dist", ".next"].includes(entry)) continue;
      collectSourceFiles(path, files);
    } else if (SOURCE_EXTENSION.test(path) && !EXCLUDED_SOURCE.test(path)) {
      files.push(path);
    }
  }
  return files;
}

export function collectModuleSpecifiers(
  sourceFile,
  ts,
  { includeTypeOnly = true } = {},
) {
  const specifiers = new Set();
  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      const clause = node.importClause;
      const hasRuntimeBinding =
        !clause ||
        (!clause.isTypeOnly &&
          (Boolean(clause.name) ||
            !clause.namedBindings ||
            ts.isNamespaceImport(clause.namedBindings) ||
            clause.namedBindings.elements.some(
              (element) => !element.isTypeOnly,
            )));
      if (includeTypeOnly || hasRuntimeBinding) {
        specifiers.add(node.moduleSpecifier.text);
      }
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      const hasRuntimeBinding =
        !node.isTypeOnly &&
        (!node.exportClause ||
          !ts.isNamedExports(node.exportClause) ||
          node.exportClause.elements.some((element) => !element.isTypeOnly));
      if (includeTypeOnly || hasRuntimeBinding) {
        specifiers.add(node.moduleSpecifier.text);
      }
    }
    if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      specifiers.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return [...specifiers];
}

function loadCompilerOptions(surfaceRoot, tsconfigPath, ts) {
  const configPath = resolve(surfaceRoot, tsconfigPath);
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  if (loaded.error) {
    throw new Error(
      ts.flattenDiagnosticMessageText(loaded.error.messageText, "\n"),
    );
  }
  return ts.parseJsonConfigFileContent(
    loaded.config,
    ts.sys,
    dirname(configPath),
  ).options;
}

function isInside(directory, path) {
  const pathFromDirectory = relative(directory, path);
  return (
    pathFromDirectory === "" ||
    (!pathFromDirectory.startsWith(`..${sep}`) &&
      pathFromDirectory !== "..")
  );
}

function resolveInternalImport({
  compilerOptions,
  importer,
  specifier,
  surfaceRoot,
  sourceFiles,
  ts,
}) {
  const resolved = ts.resolveModuleName(
    specifier,
    importer,
    compilerOptions,
    ts.sys,
  ).resolvedModule?.resolvedFileName;
  if (!resolved) return null;
  const absolute = resolve(resolved.replace(/\.d\.ts$/, ".ts"));
  if (!isInside(surfaceRoot, absolute)) return null;
  if (sourceFiles.has(absolute)) return absolute;
  return null;
}

function loadEntryFiles(surfaceRoot, surface, errors) {
  const entries = new Set();
  for (const entryFile of surface.entryFiles ?? []) {
    const path = resolve(surfaceRoot, entryFile);
    if (!existsSync(path)) {
      errors.push(`missing reachability entry file ${entryFile}`);
    } else {
      entries.add(path);
    }
  }
  for (const entryDirectory of surface.entryDirectories ?? []) {
    const path = resolve(surfaceRoot, entryDirectory);
    if (!existsSync(path)) {
      errors.push(`missing reachability entry directory ${entryDirectory}`);
      continue;
    }
    for (const file of collectSourceFiles(path)) entries.add(file);
  }
  return entries;
}

function validateException(orphan, exception, errors) {
  if (
    typeof exception.reason !== "string" ||
    exception.reason.trim().length < 20 ||
    !/^WP-\d{2}$/.test(exception.workPackage ?? "")
  ) {
    errors.push(`runtime orphan ${orphan} has a malformed exception`);
  }
}

export function evaluateOrphans(
  orphans,
  allowlist,
  allowlistPatterns = [],
) {
  const errors = [];
  const orphanSet = new Set(orphans);
  const patterns = allowlistPatterns.map((entry) => ({
    ...entry,
    expression: new RegExp(entry.pattern),
    matches: 0,
  }));

  for (const orphan of orphans) {
    const exception = allowlist[orphan];
    if (exception) {
      validateException(orphan, exception, errors);
      continue;
    }
    const pattern = patterns.find((entry) => entry.expression.test(orphan));
    if (!pattern) {
      errors.push(`unexplained runtime orphan ${orphan}`);
      continue;
    }
    pattern.matches += 1;
    validateException(orphan, pattern, errors);
  }
  for (const allowed of Object.keys(allowlist)) {
    if (!orphanSet.has(allowed)) {
      errors.push(`stale runtime orphan exception ${allowed}`);
    }
  }
  for (const pattern of patterns) {
    if (pattern.matches === 0) {
      errors.push(`stale runtime orphan pattern ${pattern.pattern}`);
    }
  }

  return errors;
}

export function auditSurface(repositoryRoot, surfaceName, surface, ts) {
  const errors = [];
  const surfaceRoot = resolve(repositoryRoot, surface.directory);
  const compilerOptions = loadCompilerOptions(
    surfaceRoot,
    surface.tsconfig,
    ts,
  );
  const sourceFiles = new Set();
  for (const sourceDirectory of surface.sourceDirectories ?? []) {
    for (const file of collectSourceFiles(resolve(surfaceRoot, sourceDirectory))) {
      sourceFiles.add(file);
    }
  }
  const entries = loadEntryFiles(surfaceRoot, surface, errors);
  for (const entry of entries) sourceFiles.add(entry);

  const graph = new Map();
  for (const file of sourceFiles) {
    const source = readFileSync(file, "utf8");
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const dependencies = new Set();
    for (const specifier of collectModuleSpecifiers(sourceFile, ts)) {
      const dependency = resolveInternalImport({
        compilerOptions,
        importer: file,
        specifier,
        surfaceRoot,
        sourceFiles,
        ts,
      });
      if (dependency) dependencies.add(dependency);
    }
    graph.set(file, dependencies);
  }

  const reachable = new Set();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift();
    if (!file || reachable.has(file)) continue;
    reachable.add(file);
    for (const dependency of graph.get(file) ?? []) {
      if (!reachable.has(dependency)) queue.push(dependency);
    }
  }

  const orphans = [...sourceFiles]
    .filter((file) => !reachable.has(file))
    .map((file) => normalizePath(relative(surfaceRoot, file)))
    .sort();
  errors.push(
    ...evaluateOrphans(
      orphans,
      surface.allowlist ?? {},
      surface.allowlistPatterns ?? [],
    ),
  );

  return {
    surfaceName,
    errors,
    sourceFiles: sourceFiles.size,
    reachableFiles: reachable.size,
    orphans,
  };
}

function run() {
  const scriptPath = fileURLToPath(import.meta.url);
  const repositoryRoot = resolve(dirname(scriptPath), "..");
  const policy = JSON.parse(
    readFileSync(
      resolve(repositoryRoot, "scripts/runtime-reachability-policy.json"),
      "utf8",
    ),
  );
  if (policy.schemaVersion !== 1) {
    throw new Error("unsupported runtime reachability policy schema");
  }
  const requireFromBackend = createRequire(
    resolve(repositoryRoot, "backend/package.json"),
  );
  const ts = requireFromBackend("typescript");
  const reportOnly = process.argv.includes("--report");
  const requested = process.argv
    .slice(2)
    .filter((argument) => argument !== "--report");
  const surfaceNames =
    requested.length > 0 ? requested : Object.keys(policy.surfaces);

  const failures = [];
  for (const surfaceName of surfaceNames) {
    const surface = policy.surfaces[surfaceName];
    if (!surface) throw new Error(`unknown runtime surface ${surfaceName}`);
    const result = auditSurface(
      repositoryRoot,
      surfaceName,
      surface,
      ts,
    );
    console.log(
      `${surfaceName}: ${result.reachableFiles}/${result.sourceFiles} production source files reachable; ${result.orphans.length} allowlisted or unexplained orphans.`,
    );
    if (reportOnly && result.orphans.length > 0) {
      for (const orphan of result.orphans) console.log(`- ${orphan}`);
    }
    if (!reportOnly) failures.push(...result.errors);
  }

  if (failures.length > 0) {
    throw new Error(
      `Runtime reachability gate failed:\n- ${failures.join("\n- ")}`,
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
