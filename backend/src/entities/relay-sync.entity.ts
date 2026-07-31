import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("relay_deployments")
export class RelayDeploymentEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ unique: true }) deploymentKey: string;
  @Column() displayName: string;
  @Column() apiVersion: string;
  @Column() syncContractVersion: string;
  @Column() runtimeContractVersion: string;
  @Column() marketplaceContractVersion: string;
  @Column({ default: "relay_managed" }) ownershipType: string;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) capabilities: Record<
    string,
    unknown
  >;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("relay_client_installations")
@Index(["deploymentId", "userId", "installationPublicId"], { unique: true })
@Index(["userId", "revokedAt"])
export class RelayClientInstallationEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") deploymentId: string;
  @Column("uuid") userId: string;
  @Column() installationPublicId: string;
  @Column() clientKind: string;
  @Column() clientVersion: string;
  @Column({ nullable: true }) label: string | null;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) capabilities: Record<
    string,
    unknown
  >;
  @Column({ type: "timestamptz", nullable: true }) lastSeenAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) revokedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("relay_workspace_sync_links")
@Index(["deploymentId", "installationId", "localWorkspaceId"], { unique: true })
@Index(["workspaceId", "installationId"], { unique: true })
export class RelayWorkspaceSyncLinkEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") deploymentId: string;
  @Column("uuid") installationId: string;
  @Column("uuid") userId: string;
  @Column("uuid") workspaceId: string;
  @Column() localWorkspaceId: string;
  @Column({ default: "active" }) status: string;
  @Column({ default: "metadata_only" }) attachmentPolicy: string;
  @Column({ default: true }) offlineRetention: boolean;
  @Column({ type: "bigint", default: 0 }) pullCursor: string;
  @Column({ type: "timestamptz", nullable: true }) pausedAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) unlinkedAt: Date | null;
  @Column({ nullable: true }) forkLocalWorkspaceId: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("relay_workspace_imports")
@Index(["workspaceId", "installationId", "manifestKey"], { unique: true })
export class RelayWorkspaceImportEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") syncLinkId: string;
  @Column("uuid") workspaceId: string;
  @Column("uuid") installationId: string;
  @Column() manifestKey: string;
  @Column() schemaVersion: string;
  @Column({ default: "validated" }) status: string;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) counts: Record<
    string,
    number
  >;
  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  exclusions: unknown[];
  @Column({ type: "jsonb", default: () => "'[]'::jsonb" }) conflicts: unknown[];
  @Column({ default: false }) cloudStorageConsent: boolean;
  @Column({ nullable: true }) backupCheckpoint: string | null;
  @Column({ default: 0 }) acceptedCount: number;
  @Column({ default: 0 }) rejectedCount: number;
  @Column({ nullable: true }) lastBatchKey: string | null;
  @Column({ type: "timestamptz", nullable: true }) completedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("relay_import_batch_receipts")
@Index(["importId", "batchKey"], { unique: true })
export class RelayImportBatchReceiptEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") importId: string;
  @Column() batchKey: string;
  @Column({ type: "jsonb", default: () => "'[]'::jsonb" }) outcomes: unknown[];
  @Column({ default: false }) finalBatch: boolean;
  @CreateDateColumn() createdAt: Date;
}

@Entity("relay_sync_objects")
@Index(["workspaceId", "objectType", "objectId"], { unique: true })
@Index(
  ["workspaceId", "sourceInstallationId", "objectType", "sourceObjectId"],
  { unique: true },
)
export class RelaySyncObjectEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") workspaceId: string;
  @Column() objectType: string;
  @Column() objectId: string;
  @Column("uuid", { nullable: true }) sourceInstallationId: string | null;
  @Column() sourceObjectId: string;
  @Column({ nullable: true }) canonicalObjectId: string | null;
  @Column({ type: "bigint", default: 1 }) serverVersion: string;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) payload: Record<
    string,
    unknown
  >;
  @Column({ type: "timestamptz", nullable: true }) deletedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("relay_client_mutation_receipts")
@Index(["deploymentId", "installationId", "clientMutationId"], { unique: true })
export class RelayClientMutationReceiptEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") deploymentId: string;
  @Column("uuid") workspaceId: string;
  @Column("uuid") installationId: string;
  @Column() clientMutationId: string;
  @Column() operation: string;
  @Column() objectType: string;
  @Column() objectId: string;
  @Column({ nullable: true }) canonicalObjectId: string | null;
  @Column({ type: "bigint" }) serverVersion: string;
  @Column({ type: "bigint" }) changeSequence: string;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) result: Record<
    string,
    unknown
  >;
  @CreateDateColumn() createdAt: Date;
}

@Entity("relay_workspace_changes")
@Index(["workspaceId", "sequence"], { unique: true })
export class RelayWorkspaceChangeEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") workspaceId: string;
  @Column({ type: "bigint", generated: "increment", unique: true })
  sequence: string;
  @Column() changeType: string;
  @Column() objectType: string;
  @Column() objectId: string;
  @Column({ type: "bigint" }) serverVersion: string;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) payload: Record<
    string,
    unknown
  >;
  @Column("uuid", { nullable: true }) actorUserId: string | null;
  @Column("uuid", { nullable: true }) installationId: string | null;
  @CreateDateColumn() createdAt: Date;
}

@Entity("relay_sync_conflicts")
@Index(["workspaceId", "resolvedAt"])
export class RelaySyncConflictEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") workspaceId: string;
  @Column("uuid") installationId: string;
  @Column() clientMutationId: string;
  @Column() objectType: string;
  @Column() objectId: string;
  @Column() conflictType: string;
  @Column({ type: "bigint", nullable: true }) baseServerVersion: string | null;
  @Column({ type: "bigint" }) canonicalServerVersion: string;
  @Column({ type: "jsonb" }) clientPayload: Record<string, unknown>;
  @Column({ type: "jsonb" }) canonicalPayload: Record<string, unknown>;
  @Column({ type: "timestamptz", nullable: true }) resolvedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}

@Entity("relay_sync_attachments")
@Index(["workspaceId", "attachmentId"], { unique: true })
export class RelaySyncAttachmentEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") workspaceId: string;
  @Column() attachmentId: string;
  @Column() sourceInstallationId: string;
  @Column() sourceAttachmentId: string;
  @Column() fileName: string;
  @Column() contentType: string;
  @Column({ type: "bigint" }) byteSize: string;
  @Column() sha256: string;
  @Column({ default: "negotiated" }) status: string;
  @Column({ default: "cloud" }) availability: string;
  @Column({ nullable: true }) storageKey: string | null;
  @Column({ type: "bytea", nullable: true, select: false })
  content: Buffer | null;
  @Column({ nullable: true, select: false }) uploadTokenHash: string | null;
  @Column({ type: "timestamptz", nullable: true }) uploadExpiresAt: Date | null;
  @Column("uuid", { nullable: true, select: false })
  uploadClaimToken: string | null;
  @Column({ type: "timestamptz", nullable: true })
  uploadClaimExpiresAt: Date | null;
  @Column({ type: "integer", default: 0 }) uploadAttemptCount: number;
  @Column("uuid", { nullable: true }) storageVersion: string | null;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) provenance: Record<
    string,
    unknown
  >;
  @Column({ type: "timestamptz", nullable: true }) deletedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("relay_sync_attachment_chunks")
export class RelaySyncAttachmentChunkEntity {
  @PrimaryColumn("uuid") attachmentRowId: string;
  @PrimaryColumn("uuid") uploadVersion: string;
  @PrimaryColumn({ type: "integer" }) chunkIndex: number;
  @Column({ type: "integer" }) byteLength: number;
  @Column({ type: "bytea", select: false }) content: Buffer;
  @CreateDateColumn() createdAt: Date;
}

@Entity("relay_execution_owner_leases")
@Index(["workspaceId", "agentId"], { unique: true })
export class RelayExecutionOwnerLeaseEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") workspaceId: string;
  @Column("uuid") agentId: string;
  @Column("uuid", { nullable: true }) bridgeDeviceId: string | null;
  @Column("uuid", { nullable: true }) runtimeHostId: string | null;
  @Column({ type: "bigint", default: 1 }) assignmentEpoch: string;
  @Column() ownerKind: string;
  @Column({ default: "active" }) state: string;
  @Column({ type: "timestamptz" }) leaseExpiresAt: Date;
  @Column({ type: "timestamptz", nullable: true }) drainedAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) revokedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
