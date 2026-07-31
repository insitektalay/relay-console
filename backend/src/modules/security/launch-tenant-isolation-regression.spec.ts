import { ForbiddenException } from "@nestjs/common";
import { AuditLogController } from "../audit-log/audit-log.controller";
import { MarketplaceController } from "../marketplace/marketplace.controller";

describe("launch tenant-isolation controller boundaries", () => {
  it("does not query audit events or metrics before workspace-admin authorization", async () => {
    const auditLogService = {
      listWorkspaceAuditLogs: jest.fn(),
      getWorkspaceSecurityMetrics: jest.fn(),
    } as any;
    const membership = {
      ensureWorkspaceAdminAccess: jest.fn().mockRejectedValue(
        new ForbiddenException("WORKSPACE_ADMIN_ACCESS_DENIED"),
      ),
    } as any;
    const controller = new AuditLogController(auditLogService, membership);
    const user = { id: "user-a" } as any;

    await expect(
      controller.list(user, "workspace-b"),
    ).rejects.toThrow("WORKSPACE_ADMIN_ACCESS_DENIED");
    await expect(
      controller.metrics(user, "workspace-b"),
    ).rejects.toThrow("WORKSPACE_ADMIN_ACCESS_DENIED");

    expect(auditLogService.listWorkspaceAuditLogs).not.toHaveBeenCalled();
    expect(auditLogService.getWorkspaceSecurityMetrics).not.toHaveBeenCalled();
  });

  it("does not expose Marketplace catalog or connection state across workspaces", async () => {
    const marketplaceService = {
      listCatalog: jest.fn(),
      listConnections: jest.fn(),
    } as any;
    const membership = {
      ensureWorkspaceAccess: jest.fn().mockRejectedValue(
        new ForbiddenException("WORKSPACE_ACCESS_DENIED"),
      ),
      ensureWorkspaceAdminAccess: jest.fn(),
    } as any;
    const controller = new MarketplaceController(
      marketplaceService,
      membership,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const user = { id: "user-a" } as any;

    await expect(
      controller.catalog("workspace-b", user),
    ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
    await expect(
      controller.connections("workspace-b", user),
    ).rejects.toThrow("WORKSPACE_ACCESS_DENIED");

    expect(marketplaceService.listCatalog).not.toHaveBeenCalled();
    expect(marketplaceService.listConnections).not.toHaveBeenCalled();
  });
});
