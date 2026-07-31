import {
  Column,
  Check,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { AgentEntity } from "./agent.entity";
import { WorkspaceEntity } from "./workspace.entity";

@Entity("runtime_bindings")
@Index(["agentId"], { unique: true })
@Index(["workspaceId", "isEnabled"])
@Index(["runtimeType", "isEnabled"])
@Check(
  "CHK_runtime_bindings_no_hermes_host_path",
  `"runtimeType" <> 'hermes' OR ("workspaceRoot" IS NULL AND NOT (COALESCE("configMetadata", '{}'::jsonb) ?| ARRAY['workspaceRoot', 'repoPath', 'cwd']))`,
)
export class RuntimeBindingEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  workspaceId: string;

  @Column("uuid")
  agentId: string;

  @Column()
  runtimeType: string;

  @Column("uuid", { nullable: true })
  runtimeHostId: string | null;

  @Column({ nullable: true })
  runtimeExternalAgentId: string | null;

  @Column({ type: "bigint", default: 1 })
  assignmentEpoch: string;

  @Column({ default: "unassigned" })
  ownershipState: "unassigned" | "active" | "draining" | "quarantined";

  @Column({ type: "timestamptz", nullable: true })
  assignedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  lastConfirmedAt: Date | null;

  @Column("uuid", { nullable: true })
  previousRuntimeHostId: string | null;

  @Column()
  adapterKind: string;

  @Column({ default: "explicit_only" })
  routingMode: string;

  @Column({ nullable: true })
  workspaceRoot: string | null;

  @Column({ nullable: true })
  repoKey: string | null;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ default: "unconfigured" })
  healthStatus: string;

  @Column({ type: "timestamptz", nullable: true })
  lastHealthCheckAt: Date | null;

  @Column({ nullable: true })
  lastErrorCode: string | null;

  @Column({ type: "text", nullable: true })
  lastErrorMessage: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  capabilities: Record<string, unknown>;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  configMetadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workspaceId" })
  workspace: WorkspaceEntity;

  @OneToOne(() => AgentEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agentId" })
  agent: AgentEntity;
}
