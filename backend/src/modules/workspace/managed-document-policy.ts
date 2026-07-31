import { BadRequestException } from "@nestjs/common";

export const MANAGED_DOCUMENT_MAX_BYTES = 1_048_576;
export const MANAGED_DOCUMENT_AGENT_MAX_BYTES = 25 * 1_048_576;
export const MANAGED_DOCUMENT_MAX_COUNT = 2_000;

const ALLOWED_EXTENSIONS = new Set([
  "md",
  "markdown",
  "txt",
  "json",
  "yaml",
  "yml",
]);
const EXCLUDED_SEGMENTS = new Set([
  ".archive",
  ".curator_backups",
  ".git",
  ".hg",
  ".svn",
  "archive",
  "archives",
  "backup",
  "backups",
  "cache",
  "caches",
  "logs",
  "sessions",
  "tmp",
  "temp",
  "node_modules",
]);
const SECRET_NAME_PATTERN =
  /(^|[._-])(credential|credentials|secret|secrets|password|passwd|token|tokens|api[._-]?key|private[._-]?key|oauth|keychain|auth)([._-]|$)/i;
const NATIVE_ROOT_DOCUMENTS = new Set([
  "AGENTS.md",
  "HEARTBEAT.md",
  "IDENTITY.md",
  "MEMORY.md",
  "SOUL.md",
  "TOOLS.md",
  "USER.md",
]);
const NATIVE_DOCUMENT_TREES = new Set(["memory", "skills"]);

export type ManagedDocumentPath = {
  folder: string;
  filename: string;
  relativePath: string;
  documentKind: string;
};

export function validateManagedDocumentPath(
  folderValue: string,
  filenameValue: string,
): ManagedDocumentPath {
  const folder = folderValue.trim().replace(/^\/+|\/+$/g, "");
  const parts = folder ? folder.split("/") : [];
  const filename = filenameValue.trim();
  if (
    parts.length > 12 ||
    parts.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        part.startsWith(".") ||
        part.includes("\\") ||
        part.includes("\0") ||
        EXCLUDED_SEGMENTS.has(part.toLowerCase()),
    )
  ) {
    throw new BadRequestException("AGENT_DOCUMENT_PATH_EXCLUDED");
  }
  if (
    !filename ||
    filename.length > 255 ||
    filename === "." ||
    filename === ".." ||
    filename.startsWith(".") ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("\0")
  ) {
    throw new BadRequestException("INVALID_AGENT_DOCUMENT_FILENAME");
  }
  if (SECRET_NAME_PATTERN.test(filename)) {
    throw new BadRequestException("AGENT_DOCUMENT_SECRET_PATH_EXCLUDED");
  }
  const extension = filename.includes(".")
    ? filename.split(".").at(-1)!.toLowerCase()
    : "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new BadRequestException("AGENT_DOCUMENT_TYPE_NOT_ALLOWED");
  }
  const relativePath = folder ? `${folder}/${filename}` : filename;
  return {
    folder,
    filename,
    relativePath,
    documentKind: managedDocumentKind(folder, filename),
  };
}

export function validateManagedDocumentContent(content: unknown) {
  if (typeof content !== "string") {
    throw new BadRequestException("AGENT_DOCUMENT_CONTENT_REQUIRED");
  }
  const byteSize = Buffer.byteLength(content, "utf8");
  if (byteSize > MANAGED_DOCUMENT_MAX_BYTES) {
    throw new BadRequestException("AGENT_DOCUMENT_TOO_LARGE");
  }
  return { content, byteSize };
}

export function validateNativeAgentDocumentPath(
  folderValue: string,
  filenameValue: string,
): ManagedDocumentPath {
  const path = validateManagedDocumentPath(folderValue, filenameValue);
  const extension = path.filename.split(".").at(-1)?.toLowerCase() ?? "";
  const parts = path.folder ? path.folder.split("/") : [];
  const allowed =
    extension === "md" || extension === "markdown"
      ? parts.length === 0
        ? NATIVE_ROOT_DOCUMENTS.has(path.filename)
        : NATIVE_DOCUMENT_TREES.has(parts[0].toLowerCase()) && parts.length <= 6
      : false;
  if (!allowed) {
    throw new BadRequestException("NATIVE_AGENT_DOCUMENT_PATH_NOT_ALLOWED");
  }
  return path;
}

export function managedDocumentKind(folder: string, filename: string) {
  const path = folder
    ? `${folder}/${filename}`.toLowerCase()
    : filename.toLowerCase();
  if (path === "identity.md" || path === "soul.md") return "identity";
  if (path === "user.md") return "user_context";
  if (path === "heartbeat.md") return "heartbeat";
  if (path === "tools.md") return "tool_instructions";
  if (path === "cron/jobs.json") return "schedule";
  const parts = folder.toLowerCase().split("/");
  if (parts.includes("skills")) return "skill";
  if (parts.includes("memory") || parts.includes("memories")) return "memory";
  return "instruction";
}
