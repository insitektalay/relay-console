import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  AgentEntity,
  RuntimeBindingEntity,
  RuntimeDispatchEntity,
  RuntimeStructuredJobEntity,
  RuntimeThreadSessionEntity,
  RelayExecutionOwnerLeaseEntity,
  RuntimeHostEntity,
  RuntimeObservationEntity,
  AgentIdentitySuppressionEntity,
  BridgeDeviceEntity,
  ManagedAgentDocumentEntity,
  RelaySyncObjectEntity,
  ManagedRuntimeEntity,
  RuntimeMigrationEntity,
  RelayRemediationOperationEntity,
  RelayCommercialSubscriptionEntity,
  RelayClientInstallationEntity,
  RelayWorkspaceSyncLinkEntity,
  RuntimeProvisioningTargetEntity,
} from "../../entities";
import { EventsModule } from "../../gateways/events.module";
import { WorkspaceMembershipModule } from "../workspace-membership/workspace-membership.module";
import { RuntimeAdapterRegistry } from "./runtime-adapter-registry.service";
import { RuntimeBindingService } from "./runtime-binding.service";
import { RuntimeDispatchController } from "./runtime-dispatch.controller";
import { RuntimeDispatchCoordinator } from "./runtime-dispatch-coordinator.service";
import { RuntimeDispatchReconcilerService } from "./runtime-dispatch-reconciler.service";
import { RuntimeDispatchService } from "./runtime-dispatch.service";
import { RuntimeEventService } from "./runtime-event.service";
import { RuntimeStructuredJobService } from "./runtime-structured-job.service";
import { RuntimeThreadSessionService } from "./runtime-thread-session.service";
import { RuntimeAuthorityService } from "./runtime-authority.service";
import { RuntimeAuthorityController } from "./runtime-authority.controller";
import { RuntimeReconciliationService } from "./runtime-reconciliation.service";
import { ManagedRuntimeService } from "./managed-runtime.service";
import { RuntimeMigrationService } from "./runtime-migration.service";
import { RelayRemediationService } from "./relay-remediation.service";
import { RailwayManagedRuntimeProvider } from "./railway-managed-runtime.provider";
import { RuntimeProvisioningTargetService } from "./runtime-provisioning-target.service";
import { AuditLogModule } from "../audit-log/audit-log.module";

@Module({
  imports: [
    ConfigModule,
    EventsModule,
    AuditLogModule,
    WorkspaceMembershipModule,
    TypeOrmModule.forFeature([
      RuntimeBindingEntity,
      RuntimeThreadSessionEntity,
      RuntimeDispatchEntity,
      RuntimeStructuredJobEntity,
      AgentEntity,
      RelayExecutionOwnerLeaseEntity,
      RuntimeHostEntity,
      RuntimeObservationEntity,
      AgentIdentitySuppressionEntity,
      BridgeDeviceEntity,
      ManagedAgentDocumentEntity,
      RelaySyncObjectEntity,
      ManagedRuntimeEntity,
      RuntimeMigrationEntity,
      RelayRemediationOperationEntity,
      RelayCommercialSubscriptionEntity,
      RelayClientInstallationEntity,
      RelayWorkspaceSyncLinkEntity,
      RuntimeProvisioningTargetEntity,
    ]),
  ],
  controllers: [RuntimeDispatchController, RuntimeAuthorityController],
  providers: [
    RuntimeAdapterRegistry,
    RuntimeBindingService,
    RuntimeThreadSessionService,
    RuntimeDispatchService,
    RuntimeEventService,
    RuntimeDispatchCoordinator,
    RuntimeDispatchReconcilerService,
    RuntimeStructuredJobService,
    RuntimeAuthorityService,
    RuntimeReconciliationService,
    ManagedRuntimeService,
    RuntimeMigrationService,
    RelayRemediationService,
    RailwayManagedRuntimeProvider,
    RuntimeProvisioningTargetService,
  ],
  exports: [
    RuntimeAdapterRegistry,
    RuntimeBindingService,
    RuntimeThreadSessionService,
    RuntimeDispatchService,
    RuntimeEventService,
    RuntimeDispatchCoordinator,
    RuntimeStructuredJobService,
    RuntimeAuthorityService,
    RuntimeReconciliationService,
    ManagedRuntimeService,
    RuntimeMigrationService,
    RelayRemediationService,
    RailwayManagedRuntimeProvider,
    RuntimeProvisioningTargetService,
  ],
})
export class RuntimeModule {}
