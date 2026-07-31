import {
  Column,
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

@Entity("claude_agent_bindings")
@Index(["workspaceId", "repoKey"], { unique: true })
@Index(["workspaceId", "isEnabled"])
export class ClaudeAgentBindingEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  workspaceId: string;

  @Column("uuid", { unique: true })
  agentId: string;

  @Column()
  repoKey: string;

  @Column({ default: "explicit_only" })
  routingMode: string;

  @Column({ nullable: true })
  model: string | null;

  @Column({ default: true })
  isEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => WorkspaceEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workspaceId" })
  workspace: WorkspaceEntity;

  @OneToOne(() => AgentEntity, (agent) => agent.claudeBinding, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "agentId" })
  agent: AgentEntity;
}
