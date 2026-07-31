import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export const MANAGED_DOCUMENT_SYNC_STATES = [
  "saved",
  "pending",
  "applied",
  "offline",
  "conflict",
  "failed",
] as const;
export type ManagedDocumentSyncState =
  (typeof MANAGED_DOCUMENT_SYNC_STATES)[number];

@Entity("managed_agent_documents")
@Index(["workspaceId", "agentId", "runtimeType", "relativePath"], {
  unique: true,
})
@Index(["workspaceId", "agentId", "syncState"])
export class ManagedAgentDocumentEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") workspaceId: string;
  @Column("uuid") agentId: string;
  @Column("uuid", { nullable: true }) runtimeHostId: string | null;
  @Column("uuid", { nullable: true }) runtimeObservationId: string | null;
  @Column() runtimeType: string;
  @Column({ default: "managed" }) authorityClass:
    | "managed"
    | "runtime_observed";
  @Column() documentKind: string;
  @Column() relativePath: string;
  @Column() folder: string;
  @Column() filename: string;
  @Column({ type: "text", nullable: true, select: false }) desiredContent:
    | string
    | null;
  @Column({ nullable: true }) desiredHash: string | null;
  @Column({ type: "bigint", default: 1 }) desiredVersion: string;
  @Column({ type: "bigint", default: 0 }) appliedVersion: string;
  @Column({ nullable: true }) appliedHash: string | null;
  @Column({ type: "bigint", default: 0 }) byteSize: string;
  @Column({ default: "saved" }) syncState: ManagedDocumentSyncState;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) editPolicy: Record<
    string,
    unknown
  >;
  @Column({ type: "jsonb", nullable: true }) conflict: Record<
    string,
    unknown
  > | null;
  @Column({ type: "text", nullable: true }) lastError: string | null;
  @Column({ type: "timestamptz", nullable: true }) lastObservedAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) tombstonedAt: Date | null;
  @Column({ nullable: true }) legacyObjectId: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("runtime_document_manifests")
@Index(["runtimeObservationId", "manifestHash"], { unique: true })
export class RuntimeDocumentManifestEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") workspaceId: string;
  @Column("uuid") agentId: string;
  @Column("uuid") runtimeObservationId: string;
  @Column() manifestHash: string;
  @Column({ default: false }) complete: boolean;
  @Column({ default: 0 }) acceptedCount: number;
  @Column({ default: 0 }) excludedCount: number;
  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  exclusions: unknown[];
  @Column({ type: "timestamptz" }) observedAt: Date;
  @CreateDateColumn() createdAt: Date;
}
