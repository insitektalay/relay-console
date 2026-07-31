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
import { WorkspaceEntity } from "./workspace.entity";

export type MarketplaceGeneratedPackReviewStatus =
  | "not_reviewed"
  | "ai_reviewed"
  | "human_reviewed"
  | "approved"
  | "rejected"
  | "needs_sources"
  | "needs_manual_review";

@Entity("marketplace_generated_packs")
@Index(["workspaceId", "qualityLevel"])
@Index(["workspaceId", "publicationStatus"])
@Index(["workspaceId", "reviewStatus"])
export class MarketplaceGeneratedPackEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid", { nullable: true })
  workspaceId!: string | null;

  @Column({ length: 120 })
  appSlug!: string;

  @Column({ length: 200 })
  name!: string;

  @Column({ length: 80 })
  category!: string;

  @Column({ length: 32 })
  riskLevel!: string;

  @Column({ type: "varchar", length: 32, default: "generated_draft" })
  qualityLevel!: "generated_draft" | "generated_reviewed";

  @Column({ type: "varchar", length: 32, default: "review_needed" })
  publicationStatus!: "review_needed" | "published" | "draft" | "blocked";

  @Column({ type: "varchar", length: 32, default: "not_reviewed" })
  reviewStatus!: MarketplaceGeneratedPackReviewStatus;

  @Column({ type: "varchar", length: 16, default: "low" })
  confidence!: "high" | "medium" | "low";

  @Column({ type: "int", default: 0 })
  qualityScore!: number;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  missingSections!: string[];

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  warnings!: string[];

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  officialDocsCoverage!: Record<string, boolean>;

  @Column({ type: "boolean", default: false })
  highRiskActionsDetected!: boolean;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  sourceUrls!: string[];

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  generatedPack!: Record<string, unknown>;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ type: "timestamptz" })
  generatedAt!: Date;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => WorkspaceEntity, { nullable: true })
  @JoinColumn({ name: "workspaceId" })
  workspace!: WorkspaceEntity | null;
}
