import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export const RUNTIME_HOST_STATUSES = [
  "pending",
  "online",
  "offline",
  "quarantined",
  "retired",
] as const;
export type RuntimeHostStatus = (typeof RUNTIME_HOST_STATUSES)[number];

export const RUNTIME_OBSERVATION_STATUSES = [
  "active",
  "stale",
  "quarantined",
  "migration_source",
  "migration_target",
] as const;
export type RuntimeObservationStatus =
  (typeof RUNTIME_OBSERVATION_STATUSES)[number];

export const RUNTIME_OBSERVATION_CONNECTION_STATES = [
  "discovered",
  "connection_pending",
  "connected",
  "disconnect_pending",
  "disconnected",
  "unavailable",
  "quarantined",
] as const;
export type RuntimeObservationConnectionState =
  (typeof RUNTIME_OBSERVATION_CONNECTION_STATES)[number];

export const RUNTIME_OBSERVATION_ORIGINS = [
  "customer_existing",
  "relay_created",
  "legacy_unknown",
] as const;
export type RuntimeObservationOrigin =
  (typeof RUNTIME_OBSERVATION_ORIGINS)[number];

export const AGENT_LIFECYCLE_STATUSES = [
  "active",
  "retired",
  "quarantined",
  "deleted",
] as const;
export type AgentLifecycleStatus = (typeof AGENT_LIFECYCLE_STATUSES)[number];

@Entity("runtime_hosts")
@Index(["workspaceId", "status"])
@Index(["workspaceId", "hostKind"])
@Index(["workspaceId", "hostInstallationId"], { unique: true })
export class RuntimeHostEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  workspaceId: string;

  @Column()
  displayName: string;

  @Column()
  hostKind: string;

  @Column({ nullable: true })
  platform: string | null;

  @Column({ nullable: true })
  hostInstallationId: string | null;

  @Column({ default: "offline" })
  status: RuntimeHostStatus;

  @Column("uuid", { nullable: true })
  bridgeDeviceId: string | null;

  @Column("uuid", { nullable: true })
  clientInstallationId: string | null;

  @Column("uuid", { nullable: true })
  managedRuntimeId: string | null;

  @Column({ nullable: true })
  softwareVersion: string | null;

  @Column({ nullable: true })
  protocolVersion: string | null;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  supportedRuntimes: string[];

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  capabilities: Record<string, unknown>;

  @Column({ type: "timestamptz", nullable: true })
  lastSeenAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  retiredAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity("runtime_observations")
@Index(["workspaceId", "runtimeHostId", "runtimeType", "externalAgentId"], {
  unique: true,
})
@Index(["workspaceId", "agentId"])
@Index(["workspaceId", "status"])
export class RuntimeObservationEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  workspaceId: string;

  @Column("uuid", { nullable: true })
  agentId: string | null;

  @Column("uuid")
  runtimeHostId: string;

  @Column()
  runtimeType: string;

  @Column()
  externalAgentId: string;

  @Column({ default: "active" })
  status: RuntimeObservationStatus;

  @Column({ default: "discovered" })
  connectionState: RuntimeObservationConnectionState;

  @Column({ default: "legacy_unknown" })
  origin: RuntimeObservationOrigin;

  @Column({ nullable: true })
  manifestHash: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  displayMetadata: Record<string, unknown>;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  capabilitySnapshot: Record<string, unknown>;

  @Column({ default: "unknown" })
  compatibilityStatus: string;

  @Column({ type: "text", nullable: true })
  compatibilityReason: string | null;

  @Column({ nullable: true })
  inventoryGeneration: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  observedState: Record<string, unknown>;

  @Column({ nullable: true })
  quarantineReason: string | null;

  @Column({ type: "timestamptz", nullable: true })
  lastSeenAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  firstSeenAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  lastScannedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  connectedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  disconnectedAt: Date | null;

  @Column({ type: "int", nullable: true })
  documentConsentVersion: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity("agent_identity_suppressions")
@Index(["workspaceId", "runtimeType", "externalAgentId"])
@Index(["workspaceId", "liftedAt"])
export class AgentIdentitySuppressionEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  workspaceId: string;

  @Column()
  runtimeType: string;

  @Column()
  externalAgentId: string;

  @Column("uuid", { nullable: true })
  runtimeHostId: string | null;

  @Column({ default: "all_hosts" })
  scope: "all_hosts" | "specific_host";

  @Column({ type: "text" })
  reason: string;

  @Column("uuid", { nullable: true })
  createdByUserId: string | null;

  @Column({ type: "timestamptz", nullable: true })
  retiredAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  liftedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity("relay_remediation_operations")
@Index(["workspaceId", "operationKey"], { unique: true })
export class RelayRemediationOperationEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  workspaceId: string;

  @Column()
  operationKey: string;

  @Column()
  operationType: string;

  @Column({ default: "planned" })
  status: string;

  @Column({ nullable: true })
  backupReference: string | null;

  @Column({ nullable: true })
  inventoryChecksum: string | null;

  @Column({ nullable: true })
  dryRunChecksum: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  expectedCounts: Record<string, number>;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  actualCounts: Record<string, number>;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  report: Record<string, unknown>;

  @Column("uuid", { nullable: true })
  requestedByUserId: string | null;

  @Column({ type: "timestamptz", nullable: true })
  appliedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  rolledBackAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
