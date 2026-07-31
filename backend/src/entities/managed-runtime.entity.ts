import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("managed_runtimes")
@Index(["workspaceId", "status"])
@Index(["runtimeHostId"], { unique: true })
export class ManagedRuntimeEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") workspaceId: string;
  @Column("uuid", { nullable: true }) agentId: string | null;
  @Column("uuid", { nullable: true }) runtimeHostId: string | null;
  @Column({ default: "hermes" }) runtimeType: "hermes";
  @Column({ default: "provisioning" }) status: string;
  @Column({ default: "relay_managed" }) ownershipType: string;
  @Column({ nullable: true }) region: string | null;
  @Column({ nullable: true }) providerRuntimeReference: string | null;
  @Column({ nullable: true }) providerVolumeReference: string | null;
  @Column({ type: "bigint", default: 21_474_836_480 })
  storageQuotaBytes: string;
  @Column({ type: "bigint", default: 0 }) storageUsedBytes: string;
  @Column({ type: "numeric", precision: 20, scale: 6, default: 0 })
  runtimeMinutesUsed: string;
  @Column({ type: "timestamptz", nullable: true }) lastMeteredAt: Date | null;
  @Column({ nullable: true }) modelAuthorizationStatus: string | null;
  @Column({ type: "timestamptz", nullable: true }) lastHealthyAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) suspendedAt: Date | null;
  @Column({ type: "timestamptz", nullable: true })
  cancellationRequestedAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) retentionEndsAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) deletedAt: Date | null;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) metadata: Record<
    string,
    unknown
  >;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("runtime_migrations")
@Index(["workspaceId", "operationKey"], { unique: true })
@Index(["agentId", "status"])
export class RuntimeMigrationEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") workspaceId: string;
  @Column("uuid") agentId: string;
  @Column() operationKey: string;
  @Column() runtimeType: "hermes" | "openclaw";
  @Column("uuid") sourceRuntimeHostId: string;
  @Column("uuid") destinationRuntimeHostId: string;
  @Column("uuid", { nullable: true }) sourceObservationId: string | null;
  @Column("uuid", { nullable: true }) destinationObservationId: string | null;
  @Column({ default: "planned" }) status: string;
  @Column({ type: "bigint", nullable: true }) sourceAssignmentEpoch:
    | string
    | null;
  @Column({ type: "bigint", nullable: true }) destinationAssignmentEpoch:
    | string
    | null;
  @Column({ nullable: true }) manifestHash: string | null;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) manifest: Record<
    string,
    unknown
  >;
  @Column({ default: true }) credentialsReauthorizationRequired: boolean;
  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  validationChecks: unknown[];
  @Column({ type: "text", nullable: true }) lastError: string | null;
  @Column({ type: "timestamptz", nullable: true }) sourcePausedAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) switchedAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) completedAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) rolledBackAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
