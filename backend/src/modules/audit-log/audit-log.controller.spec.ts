import { ForbiddenException } from "@nestjs/common";
import { AuditLogController } from "./audit-log.controller";

describe("AuditLogController access boundary", () => {
  function build() {
    const audit = {
      listWorkspaceAuditLogs: jest.fn().mockResolvedValue({ data: [] }),
      getWorkspaceSecurityMetrics: jest.fn().mockResolvedValue({}),
    };
    const membership = {
      ensureWorkspaceAdminAccess: jest.fn().mockResolvedValue(undefined),
    };
    return {
      audit,
      membership,
      controller: new AuditLogController(audit as any, membership as any),
    };
  }

  it("checks workspace-admin authority before returning audit rows", async () => {
    const { controller, audit, membership } = build();

    await controller.list(
      { id: "user-1" } as any,
      "workspace-1",
      1,
      50,
    );

    expect(membership.ensureWorkspaceAdminAccess).toHaveBeenCalledWith(
      "workspace-1",
      "user-1",
    );
    expect(
      membership.ensureWorkspaceAdminAccess.mock.invocationCallOrder[0],
    ).toBeLessThan(audit.listWorkspaceAuditLogs.mock.invocationCallOrder[0]);
  });

  it("does not read audit rows when workspace-admin authority fails", async () => {
    const { controller, audit, membership } = build();
    membership.ensureWorkspaceAdminAccess.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      controller.metrics(
        { id: "user-1" } as any,
        "workspace-1",
        24,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(audit.getWorkspaceSecurityMetrics).not.toHaveBeenCalled();
  });
});
