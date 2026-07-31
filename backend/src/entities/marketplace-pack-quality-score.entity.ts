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
import { MarketplaceGeneratedPackEntity } from "./marketplace-generated-pack.entity";
import { WorkspaceEntity } from "./workspace.entity";

@Entity("marketplace_pack_quality_scores")
@Index(["workspaceId", "appSlug"])
@Index(["generatedPackId"])
export class MarketplacePackQualityScoreEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  workspaceId!: string;

  @Column({ length: 120 })
  appSlug!: string;

  @Column("uuid")
  generatedPackId!: string;

  @Column({ type: "int" })
  score!: number;

  @Column({ type: "varchar", length: 16 })
  confidence!: "high" | "medium" | "low";

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  missingSections!: string[];

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  warnings!: string[];

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  officialDocsCoverage!: Record<string, boolean>;

  @Column({ type: "boolean", default: false })
  highRiskActionsDetected!: boolean;

  @Column({ type: "varchar", length: 32, default: "not_reviewed" })
  reviewStatus!: string;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => WorkspaceEntity)
  @JoinColumn({ name: "workspaceId" })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => MarketplaceGeneratedPackEntity)
  @JoinColumn({ name: "generatedPackId" })
  generatedPack!: MarketplaceGeneratedPackEntity;
}
