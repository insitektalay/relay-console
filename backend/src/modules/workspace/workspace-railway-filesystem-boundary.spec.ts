import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "../../../..");

function source(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

const retiredWorkspaceMethods = [
  "listAgentWorkspace",
  "readAgentWorkspaceFile",
  "createAgentWorkspaceFolder",
  "writeAgentWorkspaceFiles",
  "deleteAgentWorkspaceFile",
] as const;

describe("M-16 Railway workspace filesystem boundary", () => {
  it("keeps WorkspaceService limited to database-backed workspace state", () => {
    const workspaceService = source(
      "backend/src/modules/workspace/workspace.service.ts",
    );

    expect(workspaceService).not.toMatch(
      /from ["'](?:node:)?(?:fs(?:\/promises)?|path|os)["']/,
    );
    expect(workspaceService).not.toMatch(
      /\b(?:OPENCLAW_HOME|openclaw\.json|homedir|realpath|readdir|readFile|writeFile|mkdir|unlink|lstat|stat)\b/,
    );
    for (const method of retiredWorkspaceMethods) {
      expect(workspaceService).not.toContain(`${method}(`);
    }
  });

  it("routes native agent documents to cloud persistence, never WorkspaceService filesystem methods", () => {
    const controller = source(
      "backend/src/modules/workspace/workspace.controller.ts",
    );
    const cloudDocuments = source(
      "backend/src/modules/workspace/agent-cloud-document.service.ts",
    );

    for (const method of retiredWorkspaceMethods) {
      expect(controller).not.toContain(`workspaceService.${method}`);
    }
    expect(controller).toContain("this.agentDocuments.list(");
    expect(controller).toContain("this.agentDocuments.read(");
    expect(controller).toContain("this.agentDocuments.createFolder(");
    expect(controller).toContain("this.agentDocuments.write(");
    expect(controller).toContain("this.agentDocuments.deleteFile(");

    expect(cloudDocuments).toContain("@InjectRepository");
    expect(cloudDocuments).toContain("validateNativeAgentDocumentPath");
    expect(cloudDocuments).not.toMatch(
      /from ["'](?:node:)?(?:fs(?:\/promises)?|path|os)["']/,
    );
  });

  it("keeps paired-host filesystem requests message-only on Railway", () => {
    const bridgeService = source(
      "backend/src/modules/bridge/bridge.service.ts",
    );

    expect(bridgeService).not.toMatch(
      /from ["'](?:node:)?(?:fs(?:\/promises)?|os)["']/,
    );
    expect(bridgeService).toContain(
      "this.normalizeWorkspaceTextFilename(filename)",
    );
    expect(bridgeService).toContain("this.normalizeLibraryFolder(folder)");
    expect(bridgeService).toContain('"agent.workspace.read"');
    expect(bridgeService).toContain('"agent.workspace.write"');
    expect(bridgeService).toContain('"agent.workspace.delete"');
  });
});
