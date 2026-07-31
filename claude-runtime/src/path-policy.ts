import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { RuntimeConfig, RuntimeRepoConfig } from "./config";

const SAFE_RUNTIME_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function assertSafeRuntimeId(value: unknown, label: string): string {
  if (typeof value !== "string" || !SAFE_RUNTIME_ID.test(value)) {
    throw new Error(`${label} must be a safe runtime identifier`);
  }
  return value;
}

export async function resolveRegisteredRepoPath(
  config: Pick<RuntimeConfig, "managedRoot" | "repos">,
  repoKeyValue: unknown,
): Promise<{ repo: RuntimeRepoConfig; canonicalPath: string }> {
  const repoKey = assertSafeRuntimeId(repoKeyValue, "repoKey");
  const repo = config.repos.find((entry) => entry.repoKey === repoKey);
  if (!repo) {
    throw new Error(`No local repo binding exists for repoKey ${repoKey}`);
  }
  return {
    repo,
    canonicalPath: await assertManagedExistingDirectory(
      config.managedRoot,
      repo.repoPath,
      `repo ${repoKey}`,
    ),
  };
}

export async function assertManagedExistingDirectory(
  managedRoot: string,
  candidate: string,
  label: string,
): Promise<string> {
  const resolved = await assertManagedPath(managedRoot, candidate, label, true);
  const stat = await fs.lstat(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`${label} must be a directory`);
  }
  return resolved;
}

export async function assertManagedPath(
  managedRootValue: string,
  candidateValue: string,
  label: string,
  requireExisting: boolean,
): Promise<string> {
  if (!path.isAbsolute(managedRootValue)) {
    throw new Error("managedRoot must be absolute");
  }
  assertDedicatedManagedRoot(managedRootValue);
  if (!path.isAbsolute(candidateValue)) {
    throw new Error(`${label} must be absolute`);
  }

  const rootResolved = path.resolve(managedRootValue);
  const candidateResolved = path.resolve(candidateValue);
  const relative = path.relative(rootResolved, candidateResolved);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label} must be a strict child of managedRoot`);
  }

  const rootCanonical = await canonicalDirectoryWithoutSymlinks(
    rootResolved,
    "managedRoot",
  );
  let current = rootResolved;
  const segments = relative.split(path.sep).filter(Boolean);
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) {
        throw new Error(`${label} contains a symbolic-link path component`);
      }
      if (index < segments.length - 1 && !stat.isDirectory()) {
        throw new Error(`${label} has a non-directory parent component`);
      }
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT" &&
        !requireExisting
      ) {
        break;
      }
      throw error;
    }
  }

  if (requireExisting) {
    const canonical = await fs.realpath(candidateResolved);
    const canonicalRelative = path.relative(rootCanonical, canonical);
    if (
      !canonicalRelative ||
      canonicalRelative === ".." ||
      canonicalRelative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(canonicalRelative)
    ) {
      throw new Error(`${label} escapes managedRoot after canonicalization`);
    }
    return canonical;
  }

  return candidateResolved;
}

export function assertDedicatedManagedRoot(value: string): void {
  const resolved = path.resolve(value);
  const protectedRoots = new Set([
    path.parse(resolved).root,
    path.resolve(os.homedir()),
    path.resolve(os.homedir(), "Desktop"),
    path.resolve(os.homedir(), "Documents"),
    path.resolve(os.homedir(), "Downloads"),
  ]);
  if (protectedRoots.has(resolved)) {
    throw new Error("managedRoot must not be a protected broad directory");
  }
  if (!/^(?:\.clawchat-runtime|clawchat-runtime)$/i.test(path.basename(resolved))) {
    throw new Error(
      "managedRoot must be a dedicated directory named clawchat-runtime",
    );
  }
}

async function canonicalDirectoryWithoutSymlinks(
  value: string,
  label: string,
): Promise<string> {
  const parsed = path.parse(value);
  let current = parsed.root;
  for (const segment of value.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) {
      throw new Error(`${label} contains a symbolic-link path component`);
    }
    if (!stat.isDirectory()) {
      throw new Error(`${label} must be a directory`);
    }
  }
  return fs.realpath(value);
}
