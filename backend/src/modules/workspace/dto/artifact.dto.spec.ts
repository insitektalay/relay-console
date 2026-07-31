import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { WorkspaceArtifactSyncItemDto } from "./artifact.dto";

function item(externalUrl?: string) {
  return plainToInstance(WorkspaceArtifactSyncItemDto, {
    id: "artifact-1",
    title: "External document",
    kind: "document",
    sourceKind: "external",
    relativePath: "reports/brief.artifact.json",
    isReadableText: false,
    ...(externalUrl === undefined ? {} : { externalUrl }),
  });
}

describe("WorkspaceArtifactSyncItemDto external URL policy", () => {
  it("accepts canonicalizable HTTPS without embedded credentials", async () => {
    await expect(
      validate(item("HTTPS://Docs.Example.test:443/brief?q=1#section")),
    ).resolves.toHaveLength(0);
  });

  it.each([
    "http://docs.example.test/brief",
    "//docs.example.test/brief",
    "https:docs.example.test/brief",
    " https://docs.example.test/brief",
    "https://user:secret@docs.example.test/brief",
    "https://docs.example.test\\@attacker.test/brief",
    "https://docs.example.test/\nattacker",
    "javascript:alert(1)",
  ])("rejects an unsafe external URL without reflecting it: %s", async (url) => {
    const errors = await validate(item(url));
    expect(errors).toHaveLength(1);
    expect(JSON.stringify(errors[0]?.constraints)).not.toContain("user:secret");
  });
});
