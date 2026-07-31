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

@Entity("marketplace_pack_sources")
@Index(["workspaceId", "appSlug"])
@Index(["generatedPackId"])
export class MarketplacePackSourceEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  workspaceId!: string;

  @Column({ length: 120 })
  appSlug!: string;

  @Column("uuid")
  generatedPackId!: string;

  @Column({ length: 48 })
  kind!: string;

  @Column({ type: "text", nullable: true })
  url!: string | null;

  @Column({ type: "text", nullable: true })
  filePath!: string | null;

  @Column({ type: "text", nullable: true })
  title!: string | null;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ type: "boolean", default: false })
  official!: boolean;

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
