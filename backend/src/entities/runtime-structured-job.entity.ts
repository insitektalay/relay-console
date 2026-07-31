import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { AgentEntity } from "./agent.entity";
import { RuntimeBindingEntity } from "./runtime-binding.entity";
import { WorkspaceEntity } from "./workspace.entity";

@Entity("runtime_structured_jobs")
@Index(["workspaceId", "createdAt"])
@Index(["status", "updatedAt"])
@Index(["jobType", "createdAt"])
export class RuntimeStructuredJobEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  workspaceId: string;

  @Column()
  jobType: string;

  @Column()
  runtimeType: string;

  @Column("uuid")
  agentId: string;

  @Column()
  externalAgentId: string;

  @Column("uuid")
  runtimeBindingId: string;

  @Column({ default: "queued" })
  status: string;

  @Column({ nullable: true })
  schemaName: string | null;

  @Column({ nullable: true })
  model: string | null;

  @Column({ nullable: true })
  correlationId: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  inputMetadata: Record<string, unknown>;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  output: Record<string, unknown>;

  @Column({ nullable: true })
  errorCode: string | null;

  @Column({ type: "text", nullable: true })
  errorMessage: string | null;

  @Column({ default: false })
  retryable: boolean;

  @Column({ type: "timestamptz", nullable: true })
  startedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workspaceId" })
  workspace: WorkspaceEntity;

  @ManyToOne(() => AgentEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agentId" })
  agent: AgentEntity;

  @ManyToOne(() => RuntimeBindingEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "runtimeBindingId" })
  runtimeBinding: RuntimeBindingEntity;
}
