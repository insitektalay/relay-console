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
import { MessageEntity } from "./message.entity";
import { RuntimeBindingEntity } from "./runtime-binding.entity";
import { RuntimeThreadSessionEntity } from "./runtime-thread-session.entity";
import { ThreadEntity } from "./thread.entity";
import { ThreadSessionEntity } from "./thread-session.entity";
import { WorkspaceEntity } from "./workspace.entity";

@Entity("runtime_dispatches")
@Index(["dispatchKey"], { unique: true })
@Index(["agentId", "createdAt"])
@Index(["status", "updatedAt"])
@Index(["threadSessionId", "agentId"])
export class RuntimeDispatchEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  workspaceId: string;

  @Column("uuid")
  threadId: string;

  @Column("uuid")
  threadSessionId: string;

  @Column("uuid")
  messageId: string;

  @Column("uuid")
  agentId: string;

  @Column("uuid")
  runtimeBindingId: string;

  @Column("uuid", { nullable: true })
  runtimeHostId: string | null;

  @Column({ type: "bigint", default: 1 })
  assignmentEpoch: string;

  @Column("uuid")
  runtimeThreadSessionId: string;

  @Column()
  dispatchKey: string;

  @Column({ default: "queued" })
  status: string;

  @Column({ type: "int", default: 1 })
  attemptNumber: number;

  @Column({ type: "timestamptz", nullable: true })
  startedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  completedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  timeoutAt: Date | null;

  @Column("uuid", { nullable: true })
  postedMessageId: string | null;

  @Column({ nullable: true })
  runtimeRunId: string | null;

  @Column({ nullable: true })
  errorCode: string | null;

  @Column({ type: "text", nullable: true })
  errorMessage: string | null;

  @Column({ type: "text", nullable: true })
  resultSummary: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  resultMetadata: Record<string, unknown>;

  @Column({ nullable: true })
  correlationId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workspaceId" })
  workspace: WorkspaceEntity;

  @ManyToOne(() => ThreadEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "threadId" })
  thread: ThreadEntity;

  @ManyToOne(() => ThreadSessionEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "threadSessionId" })
  threadSession: ThreadSessionEntity;

  @ManyToOne(() => MessageEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "messageId" })
  message: MessageEntity;

  @ManyToOne(() => AgentEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agentId" })
  agent: AgentEntity;

  @ManyToOne(() => RuntimeBindingEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "runtimeBindingId" })
  runtimeBinding: RuntimeBindingEntity;

  @ManyToOne(() => RuntimeThreadSessionEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "runtimeThreadSessionId" })
  runtimeThreadSession: RuntimeThreadSessionEntity;

  @ManyToOne(() => MessageEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "postedMessageId" })
  postedMessage: MessageEntity | null;
}
