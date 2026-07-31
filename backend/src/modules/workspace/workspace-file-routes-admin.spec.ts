import { ForbiddenException } from "@nestjs/common";
import { WorkspaceController } from "./workspace.controller";

describe("WorkspaceController file routes", () => {
  function buildController() {
    const workspaceService = {
      ensureAdminAccess: jest
        .fn()
        .mockRejectedValue(new ForbiddenException("admin required")),
    };
    const bridgeService = {
      listLibrary: jest.fn(),
      readLibraryFile: jest.fn(),
      writeLibraryFiles: jest.fn(),
      deleteLibraryFile: jest.fn(),
      deleteLibraryFolder: jest.fn(),
      listHermesWorkspace: jest.fn(),
      readHermesWorkspaceFile: jest.fn(),
      createHermesWorkspaceFolder: jest.fn(),
      writeHermesWorkspaceFiles: jest.fn(),
      deleteHermesWorkspaceFile: jest.fn(),
    };
    const agentDocuments = {
      list: jest.fn(),
      read: jest.fn(),
      createFolder: jest.fn(),
      write: jest.fn(),
      deleteFile: jest.fn(),
      deleteFolder: jest.fn(),
    };
    const controller = new WorkspaceController(
      workspaceService as any,
      {} as any,
      {} as any,
      bridgeService as any,
      agentDocuments as any,
      {} as any,
    );
    return {
      controller,
      workspaceService,
      bridgeService,
      agentDocuments,
    };
  }

  const user = { id: "member-1" };

  it.each([
    [
      "listLibrary",
      (controller: WorkspaceController) =>
        controller.listLibrary("ws-1", user as any, { folder: "" }),
      "bridgeService",
      "listLibrary",
    ],
    [
      "readLibraryFile",
      (controller: WorkspaceController) =>
        controller.readLibraryFile("ws-1", user as any, {
          folder: "",
          filename: "AGENTS.md",
        }),
      "bridgeService",
      "readLibraryFile",
    ],
    [
      "createLibraryFolder",
      (controller: WorkspaceController) =>
        controller.createLibraryFolder("ws-1", user as any, { folder: "docs" }),
      "bridgeService",
      "writeLibraryFiles",
    ],
    [
      "writeLibraryFiles",
      (controller: WorkspaceController) =>
        controller.writeLibraryFiles("ws-1", user as any, {
          folder: "docs",
          files: [],
        }),
      "bridgeService",
      "writeLibraryFiles",
    ],
    [
      "deleteLibraryFile",
      (controller: WorkspaceController) =>
        controller.deleteLibraryFile("ws-1", user as any, {
          folder: "docs",
          filename: "AGENTS.md",
        }),
      "bridgeService",
      "deleteLibraryFile",
    ],
    [
      "listAgentWorkspace",
      (controller: WorkspaceController) =>
        controller.listAgentWorkspace("ws-1", user as any, {
          agentId: "agent-1",
          folder: "",
        }),
      "agentDocuments",
      "list",
    ],
    [
      "readAgentWorkspaceFile",
      (controller: WorkspaceController) =>
        controller.readAgentWorkspaceFile("ws-1", user as any, {
          agentId: "agent-1",
          folder: "",
          filename: "AGENTS.md",
        }),
      "agentDocuments",
      "read",
    ],
    [
      "createAgentWorkspaceFolder",
      (controller: WorkspaceController) =>
        controller.createAgentWorkspaceFolder("ws-1", user as any, {
          agentId: "agent-1",
          folder: "docs",
        }),
      "agentDocuments",
      "createFolder",
    ],
    [
      "writeAgentWorkspaceFiles",
      (controller: WorkspaceController) =>
        controller.writeAgentWorkspaceFiles("ws-1", user as any, {
          agentId: "agent-1",
          folder: "docs",
          files: [],
        }),
      "agentDocuments",
      "write",
    ],
    [
      "deleteLibraryFolder",
      (controller: WorkspaceController) =>
        controller.deleteLibraryFolder("ws-1", user as any, { folder: "docs" }),
      "bridgeService",
      "deleteLibraryFolder",
    ],
    [
      "deleteAgentWorkspaceFile",
      (controller: WorkspaceController) =>
        controller.deleteAgentWorkspaceFile("ws-1", user as any, {
          agentId: "agent-1",
          folder: "docs",
          filename: "AGENTS.md",
        }),
      "agentDocuments",
      "deleteFile",
    ],
    [
      "deleteAgentWorkspaceFolder",
      (controller: WorkspaceController) =>
        controller.deleteAgentWorkspaceFolder("ws-1", user as any, {
          agentId: "agent-1",
          folder: "docs",
        }),
      "agentDocuments",
      "deleteFolder",
    ],
    [
      "listHermesWorkspace",
      (controller: WorkspaceController) =>
        controller.listHermesWorkspace("ws-1", user as any, {
          agentId: "agent-1",
          folder: "project",
          path: "/",
        }),
      "bridgeService",
      "listHermesWorkspace",
    ],
    [
      "readHermesWorkspaceFile",
      (controller: WorkspaceController) =>
        controller.readHermesWorkspaceFile("ws-1", user as any, {
          agentId: "agent-1",
          folder: "project",
          path: "/",
          filename: "AGENTS.md",
        }),
      "bridgeService",
      "readHermesWorkspaceFile",
    ],
    [
      "createHermesWorkspaceFolder",
      (controller: WorkspaceController) =>
        controller.createHermesWorkspaceFolder("ws-1", user as any, {
          agentId: "agent-1",
          folder: "project",
          path: "/",
          filename: "docs",
        }),
      "bridgeService",
      "createHermesWorkspaceFolder",
    ],
    [
      "writeHermesWorkspaceFiles",
      (controller: WorkspaceController) =>
        controller.writeHermesWorkspaceFiles("ws-1", user as any, {
          agentId: "agent-1",
          folder: "project",
          path: "/",
          files: [],
        }),
      "bridgeService",
      "writeHermesWorkspaceFiles",
    ],
    [
      "deleteHermesWorkspaceFile",
      (controller: WorkspaceController) =>
        controller.deleteHermesWorkspaceFile("ws-1", user as any, {
          agentId: "agent-1",
          folder: "project",
          path: "/",
          filename: "AGENTS.md",
        }),
      "bridgeService",
      "deleteHermesWorkspaceFile",
    ],
  ] as const)(
    "requires workspace admin access before %s reaches its storage dependency",
    async (_route, invoke, dependencyName, dependencyMethod) => {
      const { controller, workspaceService, bridgeService, agentDocuments } =
        buildController();

      await expect(invoke(controller)).rejects.toThrow(ForbiddenException);

      expect(workspaceService.ensureAdminAccess).toHaveBeenCalledWith(
        "ws-1",
        "member-1",
      );
      const dependency =
        dependencyName === "agentDocuments" ? agentDocuments : bridgeService;
      expect((dependency as any)[dependencyMethod]).not.toHaveBeenCalled();
    },
  );
});
