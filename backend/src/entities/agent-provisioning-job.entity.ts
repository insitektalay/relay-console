import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("agent_provisioning_jobs")
@Index(["workspaceId", "createdAt"])
@Index(["status"])
@Index(["externalAgentId"])
@Index(["workspaceId", "idempotencyKey"], { unique: true })
@Index(["runtimeHostId", "status"])
export class AgentProvisioningJobEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  workspaceId: string;

  @Column({ nullable: true })
  requestedByUserId: string | null;

  @Column()
  name: string;

  @Column()
  slug: string;

  @Column()
  role: string;

  @Column({ nullable: true })
  connectionId: string | null;

  @Column({ nullable: true })
  runtimeType: string | null;

  @Column("uuid", { nullable: true })
  runtimeHostId: string | null;

  @Column({ nullable: true })
  targetResolutionSource: string | null;

  @Column()
  idempotencyKey: string;

  @Column({ nullable: true })
  createdAgentId: string | null;

  @Column({ nullable: true })
  externalAgentId: string | null;

  @Column({ default: "queued" })
  status: string;

  @Column({ default: "queued" })
  stage: string;

  @Column({ type: "text", nullable: true })
  message: string | null;

  @Column({ type: "text", nullable: true })
  error: string | null;

  @Column({ type: "jsonb", default: "{}" })
  payload: Record<string, unknown>;

  @Column({ type: "jsonb", default: "[]" })
  files: Array<Record<string, unknown>>;

  @Column({ type: "timestamptz", nullable: true })
  completedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  dispatchedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  acknowledgedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  nativeCreatedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  failedAt: Date | null;

  @Column({ nullable: true })
  errorCode: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
