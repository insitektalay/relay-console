import type { Repository } from "typeorm";
import {
  ApprovalEntity,
  type MarketplaceConnectionEntity,
} from "../../../../entities";
import {
  DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID,
  isDangerouslySkipPermissionsPolicy,
} from "../../marketplace-permission-policy";
import type { MarketplaceConnectorExecutorRequest } from "../types";
import type { MarketplaceConnectorExecutorResult } from "../types";
import {
  buildConnectorExecutionApprovalContext,
  canonicalJson,
  connectorExecutionPayload,
  connectorExecutionPayloadReview,
  connectorExecutionPayloadSha256,
  type ConnectorExecutionApprovalContext,
} from "./connector-execution-approval-context";
import { ConnectorExecutionAuditService } from "./connector-execution-audit.service";
import { ConnectorExecutionError } from "./connector-execution.error";

export class ConnectorExecutionApprovalService {
  private static readonly APPROVAL_TTL_MS = 15 * 60 * 1000;
  private static readonly MAX_APPROVAL_PAYLOAD_BYTES = 32 * 1024;

  constructor(
    private readonly approvalRepo: Repository<ApprovalEntity>,
    private readonly audit: ConnectorExecutionAuditService,
  ) {}

  shouldSkip(input: MarketplaceConnectorExecutorRequest, provider?: string) {
    return (
      isDangerouslySkipPermissionsPolicy(
        input.installMetadata?.approvalProfileId,
      ) ||
      isDangerouslySkipPermissionsPolicy(
        input.installMetadata?.permissionPolicyId,
      ) ||
      (provider !== undefined &&
        input.installMetadata?.approvalProfileId ===
          `${provider}_direct_writes`)
    );
  }

  async require(
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
    provider: string,
  ): Promise<ApprovalEntity | null> {
    if (this.shouldSkip(input, provider)) {
      await this.recordSkipped(input, connection, provider, action);
      return null;
    }
    const expected = buildConnectorExecutionApprovalContext(
      input,
      action,
      provider,
    );
    const approvalId =
      typeof input.input.approvalId === "string" &&
      input.input.approvalId.trim()
        ? input.input.approvalId.trim()
        : null;
    if (!approvalId) {
      await this.requestApproval(input, connection, action, provider, expected);
    }
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, workspaceId: input.workspaceId },
    });
    if (
      !approval ||
      approval.status !== "approved" ||
      !approval.resolvedAt ||
      !approval.resolvedByUserId ||
      !approval.expiresAt ||
      approval.expiresAt.getTime() <= Date.now()
    ) {
      throw new ConnectorExecutionError(
        "approval_required",
        "Approval is missing, unresolved, expired, or not approved.",
      );
    }
    if (approval.requestedByAgentId !== input.agentId) {
      throw new ConnectorExecutionError(
        "approval_mismatch",
        "Approval requester does not match.",
      );
    }
    const actual = this.readContext(approval.metadata);
    if (!actual || !this.contextMatches(actual, expected)) {
      throw new ConnectorExecutionError(
        "approval_mismatch",
        "Approval context does not match this exact connector action.",
      );
    }
    const claim = await this.approvalRepo
      .createQueryBuilder()
      .update(ApprovalEntity)
      .set({ status: "executing" })
      .where("id = :id", { id: approval.id })
      .andWhere('"workspaceId" = :workspaceId', {
        workspaceId: input.workspaceId,
      })
      .andWhere("status = :status", { status: "approved" })
      .andWhere('"resolvedAt" IS NOT NULL')
      .andWhere('"resolvedByUserId" IS NOT NULL')
      .andWhere('"expiresAt" IS NOT NULL AND "expiresAt" > :now', {
        now: new Date(),
      })
      .andWhere(
        `metadata #>> '{connectorExecution,contextSha256}' = :contextSha256`,
        {
          contextSha256: expected.contextSha256,
        },
      )
      .andWhere(`metadata #>> '{connectorExecution,purpose}' = :purpose`, {
        purpose: expected.purpose,
      })
      .andWhere(`metadata #>> '{connectorExecution,version}' = :version`, {
        version: String(expected.version),
      })
      .andWhere(
        `metadata #>> '{connectorExecution,payloadSha256}' = :payloadSha256`,
        {
          payloadSha256: expected.payloadSha256,
        },
      )
      .execute();
    if (claim.affected !== 1) {
      throw new ConnectorExecutionError(
        "approval_mismatch",
        "Approval was changed, expired, or already consumed.",
      );
    }
    approval.status = "executing";
    await this.audit.record({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${provider}.approval.claimed`,
      resourceId: approval.id,
      metadata: {
        action,
        connectionId: connection.id,
        requestedDispatchId: actual.dispatchId,
        executingDispatchId: input.dispatchId,
        toolName: input.toolName,
        payloadSha256: expected.payloadSha256,
      },
    });
    return approval;
  }

  async finalize(
    input: MarketplaceConnectorExecutorRequest,
    result: MarketplaceConnectorExecutorResult,
  ): Promise<void> {
    const approvalId =
      typeof input.input.approvalId === "string" &&
      input.input.approvalId.trim()
        ? input.input.approvalId.trim()
        : null;
    if (!approvalId) return;
    const approval = await this.approvalRepo.findOne({
      where: {
        id: approvalId,
        workspaceId: input.workspaceId,
        status: "executing",
      },
    });
    if (!approval) return;
    const metadata = approval.metadata ?? {};
    const context = this.readContext(metadata);
    if (
      !context ||
      context.connectionId !== input.connectionId ||
      context.toolName !== input.toolName ||
      context.requestingAgentId !== input.agentId ||
      context.payloadSha256 !== connectorExecutionPayloadSha256(input.input)
    ) {
      return;
    }
    const completedAt = new Date().toISOString();
    const status = result.ok ? "executed" : "execution_uncertain";
    const executionMetadata = result.ok
      ? { executedAt: completedAt }
      : {
          executionUncertainAt: completedAt,
          executionErrorCode: result.error?.code ?? "unknown",
        };
    const update = await this.approvalRepo.update(
      {
        id: approval.id,
        workspaceId: input.workspaceId,
        status: "executing",
      },
      {
        status,
        metadata: {
          ...metadata,
          ...executionMetadata,
        },
      },
    );
    if (update.affected !== 1) return;
    await this.audit.record({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${context.provider}.approval.${status}`,
      resourceId: approval.id,
      metadata: {
        action: context.action,
        connectionId: context.connectionId,
        requestedDispatchId: context.dispatchId,
        executingDispatchId: input.dispatchId,
        toolName: context.toolName,
        payloadSha256: context.payloadSha256,
        errorCode: result.ok ? null : result.error?.code ?? "unknown",
      },
    });
  }

  async recordSkipped(
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    provider: string,
    action: string,
  ) {
    await this.audit.record({
      workspaceId: input.workspaceId,
      actorId: input.agentId,
      eventType: `marketplace.${provider}.approval.skipped`,
      resourceId: connection.id,
      metadata: {
        action,
        policyId: DANGEROUSLY_SKIP_PERMISSIONS_POLICY_ID,
        toolName: input.toolName,
      },
    });
  }

  private async requestApproval(
    input: MarketplaceConnectorExecutorRequest,
    connection: MarketplaceConnectionEntity,
    action: string,
    provider: string,
    context: ConnectorExecutionApprovalContext,
  ): Promise<never> {
    const payload = connectorExecutionPayload(input.input);
    const payloadBytes = Buffer.byteLength(canonicalJson(payload), "utf8");
    if (
      payloadBytes === 0 ||
      payloadBytes > ConnectorExecutionApprovalService.MAX_APPROVAL_PAYLOAD_BYTES
    ) {
      throw new ConnectorExecutionError(
        "provider_validation_error",
        "Connector approval payload is empty or exceeds the review limit.",
      );
    }
    const now = new Date();
    const existing = await this.findActiveApproval(input.workspaceId, context);
    const expiresAt = new Date(
      now.getTime() + ConnectorExecutionApprovalService.APPROVAL_TTL_MS,
    );
    let approval = existing;
    let reusedApproval = Boolean(existing);
    let createdApproval = false;
    if (!approval) {
      try {
        approval = await this.approvalRepo.save(
          this.approvalRepo.create({
          title: `Approve ${provider} ${action}`,
          description: `Review ${input.toolName} for dispatch ${input.dispatchId}.`,
          status: "pending",
          requestedByAgentId: input.agentId,
          taskId: null,
          workspaceId: input.workspaceId,
          risk: "high",
          steps: [
            {
              provider,
              action,
              toolName: input.toolName,
              connectionId: connection.id,
              dispatchId: input.dispatchId,
              payload: connectorExecutionPayloadReview(input.input),
            },
          ],
          metadata: {
            connectorExecution: context,
          },
          notes: null,
          resolvedAt: null,
          resolvedByUserId: null,
          expiresAt,
          }),
        );
        createdApproval = true;
      } catch (error) {
        approval = await this.findActiveApproval(input.workspaceId, context);
        if (!approval) throw error;
        reusedApproval = true;
      }
    }
    if (createdApproval) {
      await this.audit.record({
        workspaceId: input.workspaceId,
        actorId: input.agentId,
        eventType: `marketplace.${provider}.approval.requested`,
        resourceId: approval.id,
        metadata: {
          action,
          connectionId: connection.id,
          dispatchId: input.dispatchId,
          toolName: input.toolName,
          payloadSha256: context.payloadSha256,
          expiresAt: approval.expiresAt.toISOString(),
        },
      });
    }
    throw new ConnectorExecutionError(
      "approval_required",
      `${provider} ${action} requires approval of this exact request.`,
      {
        approvalId: approval.id,
        expiresAt: approval.expiresAt?.toISOString() ?? null,
        reusedPendingApproval: reusedApproval,
        approvalStatus: approval.status,
      },
    );
  }

  private findActiveApproval(
    workspaceId: string,
    context: ConnectorExecutionApprovalContext,
  ): Promise<ApprovalEntity | null> {
    return this.approvalRepo
      .createQueryBuilder("approval")
      .where('approval."workspaceId" = :workspaceId', { workspaceId })
      .andWhere("approval.status IN (:...statuses)", {
        statuses: ["pending", "approved", "executing"],
      })
      .andWhere(
        `approval.metadata #>> '{connectorExecution,contextSha256}' = :contextSha256`,
        { contextSha256: context.contextSha256 },
      )
      .orderBy('approval."createdAt"', "DESC")
      .getOne();
  }

  private readContext(
    metadata: Record<string, unknown> | null | undefined,
  ): ConnectorExecutionApprovalContext | null {
    const context = metadata?.connectorExecution;
    if (!context || typeof context !== "object" || Array.isArray(context)) {
      return null;
    }
    const record = context as Record<string, unknown>;
    if (
      record.version !== 2 ||
      record.purpose !== "marketplace_connector_execution" ||
      typeof record.provider !== "string" ||
      typeof record.connectionId !== "string" ||
      typeof record.action !== "string" ||
      typeof record.toolName !== "string" ||
      typeof record.requestingAgentId !== "string" ||
      typeof record.dispatchId !== "string" ||
      typeof record.payloadSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(record.payloadSha256) ||
      typeof record.contextSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(record.contextSha256)
    ) {
      return null;
    }
    return record as ConnectorExecutionApprovalContext;
  }

  private contextMatches(
    actual: ConnectorExecutionApprovalContext,
    expected: ConnectorExecutionApprovalContext,
  ): boolean {
    return (
      actual.version === expected.version &&
      actual.purpose === expected.purpose &&
      actual.provider === expected.provider &&
      actual.connectionId === expected.connectionId &&
      actual.action === expected.action &&
      actual.toolName === expected.toolName &&
      actual.requestingAgentId === expected.requestingAgentId &&
      actual.payloadSha256 === expected.payloadSha256 &&
      actual.contextSha256 === expected.contextSha256
    );
  }
}
