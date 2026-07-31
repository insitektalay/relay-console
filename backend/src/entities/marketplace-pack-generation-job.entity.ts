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
import { UserEntity } from "./user.entity";
import { WorkspaceEntity } from "./workspace.entity";

export type MarketplacePackGenerationJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

@Entity("marketplace_pack_generation_jobs")
@Index(["workspaceId", "appSlug"])
@Index(["workspaceId", "status"])
export class MarketplacePackGenerationJobEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  workspaceId!: string;

  @Column({ length: 120 })
  appSlug!: string;

  @Column({ type: "varchar", length: 32, default: "queued" })
  status!: MarketplacePackGenerationJobStatus;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  inputConfig!: Record<string, unknown>;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  resultSummary!: Record<string, unknown>;

  @Column({ type: "text", nullable: true })
  errorMessage!: string | null;

  @Column("uuid", { nullable: true })
  startedByUserId!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  startedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => WorkspaceEntity)
  @JoinColumn({ name: "workspaceId" })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: "startedByUserId" })
  startedByUser!: UserEntity | null;
}
