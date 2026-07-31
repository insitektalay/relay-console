import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("agent_runtime_replicas")
@Index(["workspaceId", "bridgeDeviceId", "runtimeType", "externalAgentId"], {
  unique: true,
})
@Index(["workspaceId", "agentId"])
export class AgentRuntimeReplicaEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") workspaceId: string;
  @Column("uuid") agentId: string;
  @Column("uuid") bridgeDeviceId: string;
  @Column() runtimeType: string;
  @Column() externalAgentId: string;
  @Column({ default: "active" }) status: string;
  @Column({ nullable: true }) manifestHash: string | null;
  @Column({ type: "timestamptz", nullable: true }) lastSeenAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("agent_document_replicas")
@Index(["runtimeReplicaId", "objectId"], { unique: true })
@Index(["workspaceId", "agentId"])
export class AgentDocumentReplicaEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") workspaceId: string;
  @Column("uuid") agentId: string;
  @Column("uuid") runtimeReplicaId: string;
  @Column() objectId: string;
  @Column({ type: "bigint", default: 0 }) appliedServerVersion: string;
  @Column({ nullable: true }) contentHash: string | null;
  @Column({ default: "pending" }) status: string;
  @Column({ nullable: true }) lastError: string | null;
  @Column({ type: "timestamptz", nullable: true }) lastSeenAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
