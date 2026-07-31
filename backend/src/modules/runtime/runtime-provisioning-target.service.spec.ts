import { ConflictException } from "@nestjs/common";
import { RuntimeProvisioningTargetService } from "./runtime-provisioning-target.service";

describe("RuntimeProvisioningTargetService", () => {
  function build(input?: {
    target?: Record<string, unknown> | null;
    host?: Record<string, unknown> | null;
  }) {
    const targets = {
      findOne: jest.fn(async () => input?.target ?? null),
      find: jest.fn(async () => []),
      update: jest.fn(async () => undefined),
    };
    const hosts = {
      findOne: jest.fn(async () => input?.host ?? null),
    };
    const dataSource = { manager: {} };
    return {
      service: new RuntimeProvisioningTargetService(
        dataSource as any,
        targets as any,
        hosts as any,
      ),
      targets,
      hosts,
    };
  }

  it("resolves the exact active target without considering another host", async () => {
    const target = {
      id: "target-1",
      workspaceId: "workspace-1",
      runtimeType: "openclaw",
      runtimeHostId: "host-1",
      status: "active",
      selectionSource: "administrator",
    };
    const host = {
      id: "host-1",
      workspaceId: "workspace-1",
      status: "online",
      supportedRuntimes: ["openclaw"],
    };
    const { service, hosts } = build({ target, host });

    await expect(service.resolve("workspace-1", "openclaw")).resolves.toEqual({
      target,
      host,
      online: true,
    });
    expect(hosts.findOne).toHaveBeenCalledWith({
      where: { id: "host-1", workspaceId: "workspace-1" },
    });
  });

  it("keeps an offline configured target instead of failing over", async () => {
    const target = {
      id: "target-1",
      workspaceId: "workspace-1",
      runtimeType: "hermes",
      runtimeHostId: "host-offline",
      status: "active",
      selectionSource: "initial_connection",
    };
    const host = {
      id: "host-offline",
      workspaceId: "workspace-1",
      status: "offline",
      supportedRuntimes: ["hermes"],
    };
    const { service, targets } = build({ target, host });

    await expect(service.resolve("workspace-1", "hermes")).resolves.toEqual({
      target,
      host,
      online: false,
    });
    expect(targets.update).toHaveBeenCalledWith("target-1", {
      lastValidatedAt: expect.any(Date),
      statusReason: "host_offline",
    });
  });

  it("revokes a target that points to a retired host", async () => {
    const target = {
      id: "target-1",
      workspaceId: "workspace-1",
      runtimeType: "openclaw",
      runtimeHostId: "host-retired",
      status: "active",
    };
    const host = {
      id: "host-retired",
      workspaceId: "workspace-1",
      status: "retired",
      supportedRuntimes: ["openclaw"],
    };
    const { service, targets } = build({ target, host });

    await expect(service.resolve("workspace-1", "openclaw")).rejects.toThrow(
      "RUNTIME_PROVISIONING_TARGET_REVOKED",
    );
    expect(targets.update).toHaveBeenCalledWith(
      "target-1",
      expect.objectContaining({
        status: "revoked",
        statusReason: "host_retired",
      }),
    );
  });

  it("rejects a runtime outside the native harness contract", () => {
    const { service } = build();
    expect(() => service.normalizeRuntimeType("claude_code")).toThrow(
      ConflictException,
    );
  });
});
