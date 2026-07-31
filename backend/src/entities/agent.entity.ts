import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  OneToOne,
} from "typeorm";
import { WorkspaceEntity } from "./workspace.entity";
import { TeamEntity } from "./team.entity";
import { ThreadAgentMembershipEntity } from "./thread-agent-membership.entity";
import { ClaudeAgentBindingEntity } from "./claude-agent-binding.entity";

@Entity("agents")
@Index(["workspaceId"])
@Index(["teamId"])
@Index(["status"])
@Index(["workspaceId", "externalId"], { unique: true })
export class AgentEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column()
  role: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ default: "off_duty" })
  status: string;

  @Column({ nullable: true })
  workspaceId: string;

  @Column({ nullable: true })
  externalId: string | null;

  @Column({ default: "manual" })
  source: string;

  @Column({ default: "active" })
  lifecycleStatus: "active" | "retired" | "quarantined" | "deleted";

  @Column({ type: "text", nullable: true })
  lifecycleReason: string | null;

  @Column({ type: "timestamptz", nullable: true })
  retiredAt: Date | null;

  @Column("uuid", { nullable: true })
  retiredByUserId: string | null;

  @Column({ type: "timestamptz", nullable: true })
  deletionEligibleAt: Date | null;

  @Column({ nullable: true })
  connectionId: string | null;

  @Column({ nullable: true })
  teamId: string;

  @Column({ nullable: true })
  departmentId: string;

  @Column({ nullable: true })
  companyId: string;

  @Column({ default: "personal" })
  groupType: string;

  @Column({ nullable: true })
  groupLabel: string;

  @Column({ nullable: true })
  managerId: string;

  @Column({ nullable: true, type: "text" })
  description: string;

  @Column({ type: "jsonb", default: "[]" })
  capabilities: string[];

  @Column({ default: "scheduled" })
  workingHoursMode: string;

  @Column({ default: "UTC" })
  timezone: string;

  @Column({ nullable: true })
  modelPrimary: string | null;

  @Column({ default: "standard" })
  responsePresentation: string;

  @Column({ nullable: true })
  provisioningStatus: string | null;

  @Column({ nullable: true })
  currentTaskId: string;

  @Column({ default: 0 })
  tasksCompletedToday: number;

  @Column({ type: "float", default: 0 })
  successRate: number;

  @Column({ default: 0 })
  avgCompletionMinutes: number;

  @Column({ default: 0 })
  totalMinutesWorked: number;

  @Column({ type: "float", default: 0 })
  budgetUsed: number;

  @Column({ type: "float", nullable: true })
  budgetLimit: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => WorkspaceEntity, (w) => w.agents)
  @JoinColumn({ name: "workspaceId" })
  workspace: WorkspaceEntity;

  @ManyToOne(() => TeamEntity, (t) => t.agents)
  @JoinColumn({ name: "teamId" })
  team: TeamEntity;

  @OneToMany(
    () => ThreadAgentMembershipEntity,
    (membership) => membership.agent,
  )
  threadMemberships: ThreadAgentMembershipEntity[];

  @OneToOne(() => ClaudeAgentBindingEntity, (binding) => binding.agent)
  claudeBinding?: ClaudeAgentBindingEntity | null;
}
