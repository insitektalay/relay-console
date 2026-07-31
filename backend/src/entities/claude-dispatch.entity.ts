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
import { BridgeDeviceEntity } from "./bridge-device.entity";
import { MessageEntity } from "./message.entity";
import { ThreadEntity } from "./thread.entity";
import { ThreadSessionEntity } from "./thread-session.entity";
import { WorkspaceEntity } from "./workspace.entity";

@Entity("claude_dispatches")
@Index(["dispatchKey"], { unique: true })
@Index(["agentId", "createdAt"])
@Index(["status", "updatedAt"])
@Index(["threadSessionId", "agentId"])
export class ClaudeDispatchEntity {
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

  @Column()
  dispatchKey: string;

  @Column({ default: "queued" })
  status: string;

  @Column("uuid", { nullable: true })
  bridgeDeviceId: string | null;

  @Column({ type: "timestamptz", nullable: true })
  startedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  completedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  timeoutAt: Date | null;

  @Column("uuid", { nullable: true })
  postedMessageId: string | null;

  @Column({ nullable: true })
  errorCode: string | null;

  @Column({ type: "text", nullable: true })
  errorMessage: string | null;

  @Column({ type: "text", nullable: true })
  resultSummary: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  resultMetadata: Record<string, unknown>;

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

  @ManyToOne(() => BridgeDeviceEntity, { onDelete: "SET NULL" })
  @JoinColumn({ name: "bridgeDeviceId" })
  bridgeDevice: BridgeDeviceEntity | null;
}
