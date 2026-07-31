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
import { ThreadEntity } from "./thread.entity";
import { ThreadSessionEntity } from "./thread-session.entity";
import { WorkspaceEntity } from "./workspace.entity";

@Entity("claude_thread_sessions")
@Index(["threadSessionId", "agentId"], { unique: true })
@Index(["claudeSessionId"], { unique: true })
@Index(["threadId", "agentId"])
@Index(["status", "lastActivityAt"])
export class ClaudeThreadSessionEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  workspaceId: string;

  @Column("uuid")
  threadId: string;

  @Column("uuid")
  threadSessionId: string;

  @Column("uuid")
  agentId: string;

  @Column("uuid")
  claudeSessionId: string;

  @Column({ default: "active" })
  status: string;

  @Column("uuid", { nullable: true })
  lastDispatchedMessageId: string | null;

  @Column({ type: "timestamptz", nullable: true })
  lastRunStartedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  lastRunFinishedAt: Date | null;

  @Column({ nullable: true })
  lastErrorCode: string | null;

  @Column({ type: "text", nullable: true })
  lastErrorMessage: string | null;

  @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  lastActivityAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  closedAt: Date | null;

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

  @ManyToOne(() => AgentEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agentId" })
  agent: AgentEntity;
}
