import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  RelayBackupRecordEntity,
  RelayBillingEventEntity,
  RelayCommercialSubscriptionEntity,
  RelayDeploymentEntity,
  RelayOperatorDeploymentEntity,
  RelayOperatorProvisioningJobEntity,
  RelayOwnerBootstrapEntity,
  RelayServiceIncidentEntity,
  RelaySupportAccessGrantEntity,
  UserEntity,
} from "../../entities";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { AuthModule } from "../auth/auth.module";
import { HealthModule } from "../health/health.module";
import { WorkspaceMembershipModule } from "../workspace-membership/workspace-membership.module";
import { CloudCommercialService } from "./cloud-commercial.service";
import { CloudDeploymentController, RelayOperatorController, WorkspaceCloudController } from "./cloud-commercial.controller";
import { RelayOperatorGuard } from "./operator.guard";
import { EntitlementWriteGuard } from "./entitlement-write.guard";
import { StripeBillingService } from "./stripe-billing.service";
import { StripeBillingWebhookController, WorkspaceBillingController } from "./stripe-billing.controller";
import { AppleBillingService } from "./apple-billing.service";
import { DataRetentionService } from "./data-retention.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RelayDeploymentEntity,
      RelayCommercialSubscriptionEntity,
      RelayBillingEventEntity,
      UserEntity,
      RelaySupportAccessGrantEntity,
      RelayBackupRecordEntity,
      RelayOperatorDeploymentEntity,
      RelayOperatorProvisioningJobEntity,
      RelayServiceIncidentEntity,
      RelayOwnerBootstrapEntity,
    ]),
    AuthModule,
    AuditLogModule,
    HealthModule,
    WorkspaceMembershipModule,
  ],
  controllers: [CloudDeploymentController, WorkspaceCloudController, RelayOperatorController, WorkspaceBillingController, StripeBillingWebhookController],
  providers: [CloudCommercialService, StripeBillingService, AppleBillingService, DataRetentionService, RelayOperatorGuard, EntitlementWriteGuard],
  exports: [CloudCommercialService, EntitlementWriteGuard],
})
export class CloudCommercialModule {}
