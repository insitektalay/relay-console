import { createHash } from "node:crypto";
import * as path from "node:path";
import { type MarketplaceInstallRole } from "../marketplace/marketplace-install-role";
import {
  AGENT_DOCS_PACK_PATH,
  LIBRARY_INSTALL_PREFIX,
  MUTABLE_PATH_PATTERNS,
  WORKSPACE_FILES_PREFIX,
} from "./agent-documentation.constants";

export function slugify(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "application";
}

export function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function normalizeRelativePath(input: string): string {
  return input.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function assertSafeRelativePath(input: string): string {
  const relativePath = normalizeRelativePath(input);
  if (
    !relativePath ||
    relativePath.includes("\0") ||
    relativePath.split("/").some((part) => part === "..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Unsafe documentation path: ${input}`);
  }
  return relativePath;
}

export function isAllowedRepoPackPath(relativePath: string): boolean {
  const safe = normalizeRelativePath(relativePath);
  return (
    safe === `${AGENT_DOCS_PACK_PATH}/pack_manifest.json` ||
    safe.startsWith(`${AGENT_DOCS_PACK_PATH}/${LIBRARY_INSTALL_PREFIX}`) ||
    safe.startsWith(`${AGENT_DOCS_PACK_PATH}/${WORKSPACE_FILES_PREFIX}`)
  );
}

export function isLibraryInstallPath(relativePath: string): boolean {
  const safe = normalizeRelativePath(relativePath);
  return safe.startsWith(`${AGENT_DOCS_PACK_PATH}/${LIBRARY_INSTALL_PREFIX}`);
}

export function isWorkspaceRouterPath(relativePath: string): boolean {
  const safe = normalizeRelativePath(relativePath);
  return safe.startsWith(`${AGENT_DOCS_PACK_PATH}/${WORKSPACE_FILES_PREFIX}`);
}

export function isMutablePath(relativePath: string): boolean {
  const safe = normalizeRelativePath(relativePath);
  return MUTABLE_PATH_PATTERNS.some((pattern) => safe.includes(pattern));
}

export function repoPackPathToLibraryPath(relativePath: string): string | null {
  const safe = normalizeRelativePath(relativePath);
  const prefix = `${AGENT_DOCS_PACK_PATH}/${LIBRARY_INSTALL_PREFIX}`;
  if (!safe.startsWith(prefix)) return null;
  const libraryPath = safe.slice(prefix.length);
  if (!libraryPath || /[A-Z]/.test(path.basename(libraryPath))) return null;
  return libraryPath;
}

export function repoPackPathToWorkspaceFilename(
  relativePath: string,
  role: MarketplaceInstallRole,
): string | null {
  const safe = normalizeRelativePath(relativePath);
  const prefix = `${AGENT_DOCS_PACK_PATH}/${WORKSPACE_FILES_PREFIX}${role}/`;
  if (!safe.startsWith(prefix)) return null;
  const filename = safe.slice(prefix.length);
  if (!/^[A-Z0-9._-]+\.md$/.test(filename) || filename.includes("/")) {
    return null;
  }
  return filename;
}
