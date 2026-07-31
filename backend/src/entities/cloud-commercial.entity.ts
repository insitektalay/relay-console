import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("relay_commercial_subscriptions")
@Index(["workspaceId"], { unique: true })
export class RelayCommercialSubscriptionEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") workspaceId: string;
  @Column({ default: "managed_personal" }) plan: string;
  @Column({ default: "active" }) status: string;
  @Column({ default: "stripe" }) provider: string;
  @Column({ nullable: true }) providerCustomerId: string | null;
  @Column({ nullable: true }) providerSubscriptionId: string | null;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) limits: Record<string, number>;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) features: Record<string, boolean>;
  @Column({ type: "timestamptz", nullable: true }) trialEndsAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) graceEndsAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) readOnlyAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) deletionEligibleAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) cancelledAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) currentPeriodEndsAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) providerStateAt: Date | null;
  @Column({ default: false }) cancelAtPeriodEnd: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("relay_billing_events")
@Index(["provider", "providerEventId"], { unique: true })
export class RelayBillingEventEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() provider: string;
  @Column() providerEventId: string;
  @Column() eventType: string;
  @Column({ default: false }) liveMode: boolean;
  @Column() payloadHash: string;
  @Column({ default: "processing" }) status: string;
  @Column({ nullable: true }) safeErrorCode: string | null;
  @Column({ type: "timestamptz", nullable: true }) processedAt: Date | null;
  @Column({ type: "uuid", nullable: true }) claimToken: string | null;
  @Column({ type: "timestamptz", nullable: true }) claimExpiresAt: Date | null;
  @Column({ type: "integer", default: 0 }) attemptCount: number;
  @CreateDateColumn() createdAt: Date;
}

@Entity("relay_support_access_grants")
@Index(["workspaceId", "expiresAt"])
export class RelaySupportAccessGrantEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") workspaceId: string;
  @Column("uuid") grantedByUserId: string;
  @Column() supportPrincipalId: string;
  @Column({ type: "jsonb", default: () => "'[]'::jsonb" }) scopes: string[];
  @Column({ nullable: true }) reason: string | null;
  @Column({ type: "timestamptz" }) expiresAt: Date;
  @Column({ type: "timestamptz", nullable: true }) revokedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}

@Entity("relay_backup_records")
@Index(["deploymentKey", "completedAt"])
export class RelayBackupRecordEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() deploymentKey: string;
  @Column({ nullable: true }) workspaceId: string | null;
  @Column() provider: string;
  @Column() backupReference: string;
  @Column({ default: "pending" }) status: string;
  @Column({ default: true }) encrypted: boolean;
  @Column({ nullable: true }) databaseMigration: string | null;
  @Column({ type: "bigint", nullable: true }) sizeBytes: string | null;
  @Column({ type: "timestamptz", nullable: true }) completedAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) restoreTestedAt: Date | null;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) metadata: Record<string, unknown>;
  @CreateDateColumn() createdAt: Date;
}

@Entity("relay_operator_deployments")
@Index(["deploymentKey"], { unique: true })
export class RelayOperatorDeploymentEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() deploymentKey: string;
  @Column() ownershipType: string;
  @Column({ nullable: true }) customerReference: string | null;
  @Column({ nullable: true }) railwayProjectId: string | null;
  @Column({ nullable: true }) railwayEnvironmentId: string | null;
  @Column({ nullable: true }) backendOrigin: string | null;
  @Column({ nullable: true }) webOrigin: string | null;
  @Column({ default: "provisioning" }) status: string;
  @Column({ nullable: true }) releaseVersion: string | null;
  @Column({ nullable: true }) migrationVersion: string | null;
  @Column({ type: "timestamptz", nullable: true }) lastHealthyAt: Date | null;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) capacity: Record<string, number>;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) metadata: Record<string, unknown>;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("relay_operator_provisioning_jobs")
@Index(["idempotencyKey"], { unique: true })
export class RelayOperatorProvisioningJobEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() idempotencyKey: string;
  @Column() ownershipType: string;
  @Column({ default: "authorizing_railway" }) state: string;
  @Column({ nullable: true }) deploymentKey: string | null;
  @Column({ nullable: true }) railwayProjectId: string | null;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) serviceIds: Record<string, string>;
  @Column({ nullable: true }) safeErrorCode: string | null;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) metadata: Record<string, unknown>;
  @Column({ type: "timestamptz", nullable: true }) completedAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) cancelledAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("relay_service_incidents")
@Index(["deploymentKey", "startedAt"])
export class RelayServiceIncidentEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() deploymentKey: string;
  @Column() severity: string;
  @Column() status: string;
  @Column() publicSummary: string;
  @Column({ type: "timestamptz" }) startedAt: Date;
  @Column({ type: "timestamptz", nullable: true }) resolvedAt: Date | null;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) metadata: Record<string, unknown>;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("relay_owner_bootstraps")
@Index(["deploymentKey"], { unique: true })
export class RelayOwnerBootstrapEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() deploymentKey: string;
  @Column({ select: false }) tokenHash: string;
  @Column({ type: "timestamptz" }) expiresAt: Date;
  @Column({ type: "timestamptz", nullable: true }) redeemedAt: Date | null;
  @Column({ nullable: true }) redeemedByUserId: string | null;
  @CreateDateColumn() createdAt: Date;
}
