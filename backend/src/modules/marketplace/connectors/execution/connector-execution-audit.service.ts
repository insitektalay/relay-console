import type { AuditLogService } from "../../../audit-log/audit-log.service";

export type ConnectorExecutionAuditEvent = {
  workspaceId: string;
  actorId: string | null;
  eventType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
};

export class ConnectorExecutionAuditService {
  constructor(private readonly auditLogService: AuditLogService) {}

  async record(input: ConnectorExecutionAuditEvent) {
    await this.auditLogService.record({
      actorType: input.actorId ? "agent" : "system",
      actorId: input.actorId,
      workspaceId: input.workspaceId,
      eventType: input.eventType,
      resourceType: "marketplace_connection",
      resourceId: input.resourceId,
      metadata: input.metadata,
    });
  }
}
