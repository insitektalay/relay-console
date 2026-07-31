import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { RuntimeConfig } from "./config";
import {
  BridgeArtifactCatalogueInput,
  RailwayClient,
} from "./railway-client";
import {
  EXTERNAL_ARTIFACT_URL_BLOCKED_REASON,
  isExternalArtifactPointerFileName,
  normalizeExternalArtifactUrl,
} from "./artifact-security";

const MAX_ARTIFACTS = 5_000;
const MAX_DEPTH = 8;
const MACHINE_ID_DIRECTORY = path.join(os.homedir(), ".relayconsole");
const MACHINE_ID_PATH = path.join(MACHINE_ID_DIRECTORY, "machine-id");
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  ".venv",
  "DerivedData",
  "Library",
  "node_modules",
]);

type CatalogueArtifact = BridgeArtifactCatalogueInput["artifacts"][number];
type CatalogueRoot = {
  rootPath: string;
  harnessId?: string;
  harnessType?: string;
  harnessLabel?: string;
  agentName?: string;
};

export async function publishArtifactCatalogue(
  config: RuntimeConfig,
  railway: RailwayClient,
) {
  const machineId = await loadOrCreateMachineId();
  const roots = catalogueRoots(config);
  const artifacts: CatalogueArtifact[] = [];
  const seenPaths = new Set<string>();

  for (const root of roots) {
    if (artifacts.length >= MAX_ARTIFACTS) break;
    await scanRoot(root, artifacts, seenPaths);
  }

  return railway.synchronizeArtifactCatalogue({
    machineId,
    machineLabel: os.hostname(),
    platform: cataloguePlatform(),
    artifacts,
  });
}

function catalogueRoots(config: RuntimeConfig): CatalogueRoot[] {
  const roots: CatalogueRoot[] = [];
  const agentByRepo = new Map(
    config.agents.map((agent) => [agent.repoKey, agent.externalAgentId]),
  );

  for (const host of config.managedAgentHosts ?? []) {
    const rootPath = host.workspacePath?.trim();
    if (!rootPath) continue;
    roots.push({
      rootPath,
      harnessId: host.externalAgentId,
      harnessType: host.runtimeType,
      harnessLabel: harnessLabel(host.runtimeType),
      agentName: host.externalAgentId,
    });
  }

  for (const repo of config.repos) {
    const rootPath = repo.repoPath?.trim();
    if (!rootPath) continue;
    roots.push({
      rootPath,
      harnessId: agentByRepo.get(repo.repoKey),
      harnessType: "claude",
      harnessLabel: "Claude Runtime",
      agentName: agentByRepo.get(repo.repoKey),
    });
  }

  return roots;
}

async function scanRoot(
  root: CatalogueRoot,
  artifacts: CatalogueArtifact[],
  seenPaths: Set<string>,
) {
  const absoluteRoot = path.resolve(root.rootPath);
  let rootStat;
  try {
    rootStat = await fs.stat(absoluteRoot);
  } catch {
    return;
  }
  if (!rootStat.isDirectory()) return;

  const pending: Array<{ directory: string; depth: number }> = [
    { directory: absoluteRoot, depth: 0 },
  ];

  while (pending.length > 0 && artifacts.length < MAX_ARTIFACTS) {
    const current = pending.shift();
    if (!current) break;
    let entries;
    try {
      entries = await fs.readdir(current.directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (artifacts.length >= MAX_ARTIFACTS) break;
      if (entry.name.startsWith(".")) continue;
      const absolutePath = path.join(current.directory, entry.name);
      if (entry.isDirectory()) {
        if (
          current.depth < MAX_DEPTH &&
          !SKIPPED_DIRECTORIES.has(entry.name)
        ) {
          pending.push({ directory: absolutePath, depth: current.depth + 1 });
        }
        continue;
      }
      if (!entry.isFile()) continue;

      const normalizedPath = normalizePath(absolutePath);
      if (seenPaths.has(normalizedPath)) continue;
      seenPaths.add(normalizedPath);

      let stat;
      try {
        stat = await fs.stat(absolutePath);
      } catch {
        continue;
      }

      const relativePath = normalizePath(path.relative(absoluteRoot, absolutePath));
      const extension = path.extname(entry.name).slice(1).toLowerCase();
      const pointer = await readExternalPointer(absolutePath, entry.name);
      const isPointer = pointer !== undefined;
      artifacts.push({
        id: stableArtifactId(normalizedPath),
        title: pointer?.title ?? entry.name,
        kind: pointer?.kind ?? artifactKind(extension),
        sourceKind: isPointer ? "external" : "runtime_workspace",
        relativePath,
        fileExtension: extension || undefined,
        byteCount: stat.size,
        updatedAt: stat.mtime.toISOString(),
        agentName: root.agentName,
        isReadableText: isPointer ? false : isReadableText(extension),
        harnessId: root.harnessId,
        harnessType: root.harnessType,
        harnessLabel: root.harnessLabel,
        externalUrl: pointer?.url,
        externalProvider: pointer?.provider,
        presentationState: pointer?.blocked ? "unavailable" : undefined,
        presentationReason: pointer?.blocked
          ? EXTERNAL_ARTIFACT_URL_BLOCKED_REASON
          : undefined,
      });
    }
  }
}

async function readExternalPointer(
  filePath: string,
  fileName: string,
): Promise<
  | {
      title?: string;
      kind?: CatalogueArtifact["kind"];
      url: string;
      provider?: string;
      blocked?: false;
    }
  | {
      title?: string;
      kind?: CatalogueArtifact["kind"];
      blocked: true;
      url?: undefined;
      provider?: undefined;
    }
  | undefined
> {
  if (!isExternalArtifactPointerFileName(fileName)) return undefined;
  try {
    const stat = await fs.stat(filePath);
    if (stat.size > 256_000) return undefined;
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as Record<
      string,
      unknown
    >;
    const rawUrl = stringValue(parsed.external_url) ?? stringValue(parsed.url);
    const url = normalizeExternalArtifactUrl(rawUrl);
    if (!url) {
      return {
        title: stringValue(parsed.title),
        kind: parseArtifactKind(parsed.kind),
        blocked: true,
      };
    }
    return {
      title: stringValue(parsed.title),
      kind: parseArtifactKind(parsed.kind),
      url,
      provider: stringValue(parsed.provider),
      blocked: false,
    };
  } catch {
    return { blocked: true };
  }
}

async function loadOrCreateMachineId() {
  try {
    const existing = (await fs.readFile(MACHINE_ID_PATH, "utf8")).trim();
    if (existing) return existing;
  } catch {
    // Create the shared Relay Console machine identity below.
  }

  await fs.mkdir(MACHINE_ID_DIRECTORY, { recursive: true, mode: 0o700 });
  const machineId = randomUUID();
  await fs.writeFile(MACHINE_ID_PATH, `${machineId}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return machineId;
}

function stableArtifactId(value: string) {
  return `artifact-${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
}

function normalizePath(value: string) {
  return value.split(path.sep).join("/");
}

function cataloguePlatform(): BridgeArtifactCatalogueInput["platform"] {
  switch (process.platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    case "linux":
      return "linux";
    default:
      return "unknown";
  }
}

function harnessLabel(runtimeType?: string) {
  switch (runtimeType) {
    case "openclaw":
      return "OpenClaw";
    case "hermes":
      return "Hermes";
    default:
      return "Agent Runtime";
  }
}

function artifactKind(extension: string): CatalogueArtifact["kind"] {
  if (["png", "jpg", "jpeg", "gif", "webp", "heic", "svg"].includes(extension)) {
    return "image";
  }
  if (["mp4", "mov", "m4v", "avi", "mkv", "webm"].includes(extension)) {
    return "video";
  }
  if (["mp3", "wav", "m4a", "aac", "flac", "ogg"].includes(extension)) {
    return "audio";
  }
  if (["csv", "tsv", "json", "jsonl", "parquet", "sqlite", "db"].includes(extension)) {
    return "data";
  }
  if (extension) return "document";
  return "unknown";
}

function isReadableText(extension: string) {
  return [
    "c",
    "cc",
    "conf",
    "cpp",
    "css",
    "csv",
    "go",
    "h",
    "hpp",
    "html",
    "java",
    "js",
    "json",
    "jsonl",
    "jsx",
    "kt",
    "log",
    "md",
    "mjs",
    "py",
    "rb",
    "rs",
    "sh",
    "sql",
    "swift",
    "toml",
    "ts",
    "tsx",
    "txt",
    "xml",
    "yaml",
    "yml",
  ].includes(extension);
}

function parseArtifactKind(value: unknown): CatalogueArtifact["kind"] | undefined {
  const kind = stringValue(value);
  if (
    kind &&
    ["document", "image", "video", "audio", "data", "folder", "unknown"].includes(kind)
  ) {
    return kind as CatalogueArtifact["kind"];
  }
  return undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
