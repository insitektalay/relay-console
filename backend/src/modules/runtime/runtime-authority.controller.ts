import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Optional,
  ServiceUnavailableException,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { UserEntity } from "../../entities";
import { WorkspaceMembershipService } from "../workspace-membership/workspace-membership.service";
import { RuntimeAuthorityService } from "./runtime-authority.service";
import { RuntimeReconciliationService } from "./runtime-reconciliation.service";
import { ManagedRuntimeService } from "./managed-runtime.service";
import { RuntimeMigrationService } from "./runtime-migration.service";
import {
  RelayRemediationManifest,
  RelayRemediationService,
} from "./relay-remediation.service";
import { RuntimeProvisioningTargetService } from "./runtime-provisioning-target.service";
import { EventsGateway } from "../../gateways/events.gateway";
import { AuditLogService } from "../audit-log/audit-log.service";
import { randomUUID } from "crypto";

@ApiTags("runtime-authority")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ResponseInterceptor)
@Controller("workspaces/:workspaceId/runtime-authority")
export class RuntimeAuthorityController {
  constructor(
    private readonly authority: RuntimeAuthorityService,
    private readonly memberships: WorkspaceMembershipService,
    private readonly reconciliation: RuntimeReconciliationService,
    private readonly managedRuntimes: ManagedRuntimeService,
    private readonly migrations: RuntimeMigrationService,
    private readonly remediation: RelayRemediationService,
    private readonly provisioningTargets: RuntimeProvisioningTargetService,
    private readonly eventsGateway: EventsGateway,
    @Optional()
    private readonly auditLogService?: AuditLogService,
  ) {}

  @Get("remediation/:operationKey")
  async getRemediationOperation(
    @Param("workspaceId") workspaceId: string,
    @Param("operationKey") operationKey: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.remediation.get(workspaceId, operationKey);
  }

  @Post("remediation/inventory")
  async inventoryForRemediation(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body()
    body: {
      operationKey: string;
      backupReference?: string | null;
      swiftInventory?: RelayRemediationManifest["swiftInventory"];
    },
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.remediation.inventory({
      workspaceId,
      ...body,
      requestedByUserId: user.id,
    });
  }

  @Post("remediation/dry-run")
  async dryRunRemediation(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body()
    body: {
      operationKey: string;
      manifest: RelayRemediationManifest;
      expectedInventoryChecksum: string;
      expectedCounts: Record<string, number>;
    },
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.remediation.dryRun({
      workspaceId,
      ...body,
      requestedByUserId: user.id,
    });
  }

  @Post("remediation/apply")
  async applyRemediation(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body()
    body: {
      operationKey: string;
      expectedInventoryChecksum: string;
      expectedDryRunChecksum: string;
      backupReference: string;
    },
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.remediation.apply({
      workspaceId,
      ...body,
      requestedByUserId: user.id,
    });
  }

  @Get()
  @ApiOperation({
    summary: "Inspect runtime hosts, observations and ownership",
  })
  async list(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.memberships.ensureWorkspaceAccess(workspaceId, user.id);
    return this.authority.listWorkspace(workspaceId);
  }

  @Get("provisioning-targets")
  @ApiOperation({
    summary: "List the host targets used by the existing Create Agent flows",
  })
  async listProvisioningTargets(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.memberships.ensureWorkspaceAccess(workspaceId, user.id);
    return this.provisioningTargets.list(workspaceId);
  }

  @Patch("provisioning-targets/:runtimeType")
  @ApiOperation({
    summary: "Select the runtime host used for future agent creation",
  })
  async selectProvisioningTarget(
    @Param("workspaceId") workspaceId: string,
    @Param("runtimeType") runtimeType: string,
    @CurrentUser() user: UserEntity,
    @Body() body: { runtimeHostId: string },
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.provisioningTargets.select({
      workspaceId,
      runtimeType,
      runtimeHostId: body.runtimeHostId,
      selectedByUserId: user.id,
    });
  }

  @Post("hosts/:runtimeHostId/scan")
  @ApiOperation({
    summary: "Request a metadata-only native-agent inventory from one host",
  })
  async requestHostScan(
    @Param("workspaceId") workspaceId: string,
    @Param("runtimeHostId") runtimeHostId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    const host = await this.authority.getHost(workspaceId, runtimeHostId);
    if (!host.bridgeDeviceId) {
      await this.auditLogService?.record({
        actorType: "user",
        actorId: user.id,
        workspaceId,
        eventType: "native_agent.host_scan.delegated_to_local_client",
        resourceType: "runtime_host",
        resourceId: runtimeHostId,
        metadata: {
          correlationId: randomUUID(),
          metadataOnly: true,
        },
      });
      return {
        requested: false,
        runtimeHostId,
        code: "LOCAL_HOST_SCAN_REQUIRES_RELAY_CONSOLE",
      };
    }
    const bridgeRuntimeType = this.eventsGateway.getBridgeDeviceRuntimeType(
      workspaceId,
      host.bridgeDeviceId,
    );
    if (
      !bridgeRuntimeType ||
      !this.eventsGateway.hasBridgeControlSubscribers(
        workspaceId,
        null,
        host.bridgeDeviceId,
        bridgeRuntimeType,
      )
    ) {
      throw new ServiceUnavailableException("RUNTIME_HOST_OFFLINE");
    }
    const requestedAt = new Date().toISOString();
    this.eventsGateway.emitToBridgeControls(
      workspaceId,
      "agent.inventory.request",
      { workspaceId, runtimeHostId, metadataOnly: true, requestedAt },
      null,
      host.bridgeDeviceId,
      bridgeRuntimeType,
    );
    await this.auditLogService?.record({
      actorType: "user",
      actorId: user.id,
      workspaceId,
      eventType: "native_agent.host_scan.requested",
      resourceType: "runtime_host",
      resourceId: runtimeHostId,
      metadata: {
        correlationId: randomUUID(),
        metadataOnly: true,
        requestedAt,
      },
    });
    return { requested: true, runtimeHostId, requestedAt };
  }

  @Get("managed-runtimes")
  async listManagedRuntimes(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.memberships.ensureWorkspaceAccess(workspaceId, user.id);
    return this.managedRuntimes.list(workspaceId);
  }

  @Post("managed-runtimes")
  async createManagedRuntime(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body()
    body: {
      operationKey: string;
      displayName: string;
      region?: string | null;
      runtimeType?: string;
    },
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.managedRuntimes.request({ workspaceId, ...body });
  }

  @Post("managed-runtimes/:id/model-authorization")
  async authorizeManagedRuntimeModel(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
    @Body()
    body: {
      authorized: boolean;
      provider?: string | null;
      credential?: string | null;
    },
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.managedRuntimes.recordModelAuthorization(workspaceId, id, body);
  }

  @Post("managed-runtimes/:id/provision")
  async provisionManagedRuntime(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.managedRuntimes.provision(workspaceId, id);
  }

  @Post("managed-runtimes/:id/refresh-health")
  async refreshManagedRuntimeHealth(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.memberships.ensureWorkspaceAccess(workspaceId, user.id);
    return this.managedRuntimes.refreshHealth(workspaceId, id);
  }

  @Post("managed-runtimes/:id/attach-agent")
  async attachManagedRuntimeAgent(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
    @Body() body: { agentId: string },
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.managedRuntimes.attachAgent(workspaceId, id, body);
  }

  @Post("managed-runtimes/:id/suspend")
  async suspendManagedRuntime(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.managedRuntimes.suspend(workspaceId, id);
  }

  @Post("managed-runtimes/:id/resume")
  async resumeManagedRuntime(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.managedRuntimes.resume(workspaceId, id);
  }

  @Post("managed-runtimes/:id/cancel")
  async cancelManagedRuntime(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.managedRuntimes.cancel(workspaceId, id);
  }

  @Get("managed-runtimes/:id/export")
  async exportManagedRuntime(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.managedRuntimes.exportManifest(workspaceId, id);
  }

  @Get("migrations")
  async listMigrations(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.memberships.ensureWorkspaceAccess(workspaceId, user.id);
    return this.migrations.list(workspaceId);
  }

  @Post("migrations")
  async createMigration(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body()
    body: {
      agentId: string;
      operationKey: string;
      sourceRuntimeHostId: string;
      destinationRuntimeHostId: string;
      runtimeType: "hermes" | "openclaw";
    },
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.migrations.create({ workspaceId, ...body });
  }

  @Post("migrations/:id/advance")
  async advanceMigration(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
    @Body() body: Parameters<RuntimeMigrationService["advance"]>[2],
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.migrations.advance(workspaceId, id, body);
  }

  @Get("migrations/:id/manifest")
  async readMigrationManifest(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.migrations.readManifest(workspaceId, id);
  }

  @Post("migrations/:id/destination-observation")
  async registerMigrationDestination(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
    @Body() body: { externalAgentId: string; manifestHash?: string | null },
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.migrations.registerDestinationObservation(
      workspaceId,
      id,
      body,
    );
  }

  @Post("migrations/:id/rollback")
  async rollbackMigration(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.migrations.rollback(workspaceId, id);
  }

  @Post("reconcile")
  @ApiOperation({
    summary: "Report or safely reconcile runtime authority state",
  })
  async reconcile(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body() body: { apply?: boolean; expectedChecksum?: string },
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    if (!body.apply) return this.reconciliation.report(workspaceId);
    return this.reconciliation.applySafeRepairs(
      workspaceId,
      body.expectedChecksum ?? "",
    );
  }

  @Post("suppressions")
  @ApiOperation({ summary: "Suppress a runtime identity from rediscovery" })
  async suppress(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: UserEntity,
    @Body()
    body: {
      runtimeType: string;
      externalAgentId: string;
      runtimeHostId?: string | null;
      reason: string;
    },
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.authority.createSuppression({
      workspaceId,
      runtimeType: body.runtimeType.trim(),
      externalAgentId: body.externalAgentId.trim(),
      runtimeHostId: body.runtimeHostId?.trim() || null,
      reason: body.reason.trim(),
      createdByUserId: user.id,
    });
  }

  @Delete("suppressions/:id")
  @ApiOperation({ summary: "Lift a runtime identity suppression" })
  async liftSuppression(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.authority.liftSuppression(id, workspaceId);
  }

  @Post("bindings/:agentId/assign")
  @ApiOperation({ summary: "Explicitly assign the sole execution owner" })
  async assign(
    @Param("workspaceId") workspaceId: string,
    @Param("agentId") agentId: string,
    @CurrentUser() user: UserEntity,
    @Body()
    body: {
      runtimeHostId: string;
      runtimeType: string;
      externalAgentId: string;
      adapterKind: string;
    },
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.authority.assignExecutionOwner({
      workspaceId,
      agentId,
      runtimeHostId: body.runtimeHostId,
      runtimeType: body.runtimeType,
      externalAgentId: body.externalAgentId,
      adapterKind: body.adapterKind,
    });
  }

  @Post("observations/:observationId/activate")
  @ApiOperation({
    summary: "Activate one explicitly reviewed quarantined observation",
  })
  async activateReviewedObservation(
    @Param("workspaceId") workspaceId: string,
    @Param("observationId") observationId: string,
    @CurrentUser() user: UserEntity,
    @Body()
    body: {
      canonicalAgentId: string;
      expectedRuntimeHostId: string;
      expectedRuntimeType: string;
      expectedExternalAgentId: string;
    },
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.authority.activateReviewedObservation({
      workspaceId,
      observationId,
      ...body,
      reviewedByUserId: user.id,
    });
  }

  @Post("connect/:agentId/link")
  @ApiOperation({
    summary: "Explicitly link a local Swift agent to Relay",
  })
  async linkConnect(
    @Param("workspaceId") workspaceId: string,
    @Param("agentId") agentId: string,
    @CurrentUser() user: UserEntity,
    @Body()
    body: {
      installationId: string;
      runtimeType: string;
      externalAgentId: string;
      adapterKind: string;
      displayName?: string | null;
    },
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.authority.linkConnectAgent({ workspaceId, agentId, ...body });
  }

  @Post("connect/:agentId/unlink")
  @ApiOperation({ summary: "Unlink a local agent from Relay" })
  async unlinkConnect(
    @Param("workspaceId") workspaceId: string,
    @Param("agentId") agentId: string,
    @CurrentUser() user: UserEntity,
  ) {
    await this.memberships.ensureWorkspaceAdminAccess(workspaceId, user.id);
    return this.authority.unlinkConnectAgent(workspaceId, agentId);
  }
}
