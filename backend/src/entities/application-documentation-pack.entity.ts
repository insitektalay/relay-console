import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("application_documentation_packs")
@Index(["workspaceId", "linkedApplicationId"])
@Index(["workspaceId", "syncStatus"])
@Index(["workspaceId", "reviewStatus"])
export class ApplicationDocumentationPackEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid" })
  linkedApplicationId!: string;

  @Column({ type: "text", default: ".clawchat/agent-docs" })
  packPath!: string;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  blueprintVersionSet!: Array<Record<string, unknown>>;

  @Column({ type: "varchar", length: 80 })
  compilerVersion!: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  repoCommit!: string | null;

  @Column({ type: "boolean", default: false })
  repoDirtyState!: boolean;

  @Column({ type: "varchar", length: 128, nullable: true })
  packHash!: string | null;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  generatedFileManifest!: Array<Record<string, unknown>>;

  @Column({ type: "varchar", length: 64, default: "pending_review" })
  reviewStatus!: string;

  @Column({ type: "varchar", length: 64, default: "not_synced" })
  syncStatus!: string;

  @Column({ type: "text", nullable: true })
  libraryTargetFolder!: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
