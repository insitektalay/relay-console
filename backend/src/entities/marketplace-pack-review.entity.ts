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
import { UserEntity } from "./user.entity";
import { WorkspaceEntity } from "./workspace.entity";

@Entity("marketplace_pack_reviews")
@Index(["workspaceId", "appSlug"])
@Index(["generatedPackId"])
export class MarketplacePackReviewEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  workspaceId!: string;

  @Column({ length: 120 })
  appSlug!: string;

  @Column("uuid")
  generatedPackId!: string;

  @Column({ type: "varchar", length: 48 })
  action!: string;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column("uuid")
  reviewerUserId!: string;

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

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: "reviewerUserId" })
  reviewer!: UserEntity;
}
