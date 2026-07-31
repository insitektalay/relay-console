import { NotFoundException } from "@nestjs/common";
import { RuntimeDispatchController } from "./runtime-dispatch.controller";

describe("RuntimeDispatchController", () => {
  it("lists replayable thread dispatches after workspace access", async () => {
    const dispatches = [{ id: "dispatch-1", workspaceId: "workspace-1" }];
    const runtimeDispatchService = {
      findReplayableByThread: jest.fn().mockResolvedValue(dispatches),
    };
    const workspaceMembershipService = {
      ensureWorkspaceAccess: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new RuntimeDispatchController(
      {} as any,
      runtimeDispatchService as any,
      workspaceMembershipService as any,
    );

    await expect(controller.findByThread("thread-1", { id: "user-1" } as any)).resolves.toEqual(dispatches);
    expect(runtimeDispatchService.findReplayableByThread).toHaveBeenCalledWith({ threadId: "thread-1" });
    expect(workspaceMembershipService.ensureWorkspaceAccess).toHaveBeenCalledWith("workspace-1", "user-1");
  });

  it("requires workspace admin access before cancelling a dispatch", async () => {
    const coordinator = {
      cancelDispatch: jest
        .fn()
        .mockResolvedValue({ cancelled: true, dispatchId: "dispatch-1" }),
    };
    const runtimeDispatchService = {
      findById: jest.fn().mockResolvedValue({
        id: "dispatch-1",
        workspaceId: "workspace-1",
      }),
    };
    const workspaceMembershipService = {
      ensureWorkspaceAdminAccess: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new RuntimeDispatchController(
      coordinator as any,
      runtimeDispatchService as any,
      workspaceMembershipService as any,
    );

    await expect(
      controller.cancel("dispatch-1", { id: "user-1" } as any),
    ).resolves.toEqual({ cancelled: true, dispatchId: "dispatch-1" });

    expect(runtimeDispatchService.findById).toHaveBeenCalledWith("dispatch-1");
    expect(workspaceMembershipService.ensureWorkspaceAdminAccess).toHaveBeenCalledWith(
      "workspace-1",
      "user-1",
    );
    expect(coordinator.cancelDispatch).toHaveBeenCalledWith("dispatch-1");
  });

  it("does not delegate missing dispatch cancellations", async () => {
    const coordinator = {
      cancelDispatch: jest.fn(),
    };
    const runtimeDispatchService = {
      findById: jest.fn().mockResolvedValue(null),
    };
    const workspaceMembershipService = {
      ensureWorkspaceAdminAccess: jest.fn(),
    };
    const controller = new RuntimeDispatchController(
      coordinator as any,
      runtimeDispatchService as any,
      workspaceMembershipService as any,
    );

    await expect(
      controller.cancel("dispatch-missing", { id: "user-1" } as any),
    ).rejects.toThrow(NotFoundException);
    expect(coordinator.cancelDispatch).not.toHaveBeenCalled();
    expect(
      workspaceMembershipService.ensureWorkspaceAdminAccess,
    ).not.toHaveBeenCalled();
  });
});
