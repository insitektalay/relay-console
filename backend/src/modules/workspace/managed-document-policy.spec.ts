import { BadRequestException } from "@nestjs/common";
import {
  MANAGED_DOCUMENT_AGENT_MAX_BYTES,
  MANAGED_DOCUMENT_MAX_BYTES,
  MANAGED_DOCUMENT_MAX_COUNT,
  managedDocumentKind,
  validateManagedDocumentContent,
  validateManagedDocumentPath,
  validateNativeAgentDocumentPath,
} from "./managed-document-policy";

describe("managed document policy", () => {
  it("rejects hidden scanner metadata files such as .usage.json", () => {
    expect(() => validateManagedDocumentPath("skills", ".usage.json")).toThrow(
      new BadRequestException("INVALID_AGENT_DOCUMENT_FILENAME"),
    );
  });

  it.each([
    ".archive",
    ".curator_backups",
    "archive",
    "archives",
    "backup",
    "backups",
    "cache",
    "logs",
    "sessions",
    "tmp",
    "temp",
  ])("rejects documents below the excluded %s segment", (segment) => {
    expect(() =>
      validateManagedDocumentPath(`skills/${segment}/old-skill`, "SKILL.md"),
    ).toThrow(new BadRequestException("AGENT_DOCUMENT_PATH_EXCLUDED"));
  });

  it("accepts bounded textual skill and memory documents", () => {
    expect(
      validateManagedDocumentPath("skills/research/exa-search", "SKILL.md"),
    ).toEqual({
      folder: "skills/research/exa-search",
      filename: "SKILL.md",
      relativePath: "skills/research/exa-search/SKILL.md",
      documentKind: "skill",
    });
    expect(managedDocumentKind("memories", "MEMORY.md")).toBe("memory");
  });

  it.each([
    "auth.json",
    "api-key.txt",
    "credentials.yaml",
    "oauth-token.json",
    "private_key.txt",
    ".env",
  ])("rejects local credential-shaped document paths: %s", (filename) => {
    expect(() => validateManagedDocumentPath("", filename)).toThrow(
      BadRequestException,
    );
  });

  it("keeps the approved persisted document model explicitly bounded", () => {
    expect(MANAGED_DOCUMENT_MAX_BYTES).toBe(1_048_576);
    expect(MANAGED_DOCUMENT_AGENT_MAX_BYTES).toBe(25 * 1_048_576);
    expect(MANAGED_DOCUMENT_MAX_COUNT).toBe(2_000);
    expect(() =>
      validateManagedDocumentContent(
        "x".repeat(MANAGED_DOCUMENT_MAX_BYTES + 1),
      ),
    ).toThrow(new BadRequestException("AGENT_DOCUMENT_TOO_LARGE"));
  });

  it.each([
    ["", "SOUL.md"],
    ["", "AGENTS.md"],
    ["memory", "customer.markdown"],
    ["skills/research/references", "guide.md"],
  ])("accepts native-agent document path %s/%s", (folder, filename) => {
    expect(validateNativeAgentDocumentPath(folder, filename)).toMatchObject({
      folder,
      filename,
    });
  });

  it.each([
    ["", "notes.md"],
    ["", "config.yaml"],
    ["workflows", "WORKFLOW.md"],
    ["memory", "api-token.md"],
    ["skills/a/b/c/d/e/f", "too-deep.md"],
  ])(
    "rejects non-native or sensitive document path %s/%s",
    (folder, filename) => {
      expect(() => validateNativeAgentDocumentPath(folder, filename)).toThrow(
        BadRequestException,
      );
    },
  );
});
