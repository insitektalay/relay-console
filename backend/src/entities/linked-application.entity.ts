import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("linked_applications")
@Index(["workspaceId", "slug"], { unique: true })
@Index(["workspaceId", "documentationPackStatus"])
export class LinkedApplicationEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid", nullable: true })
  createdByUserId!: string | null;

  @Column({ type: "varchar", length: 160 })
  name!: string;

  @Column({ type: "varchar", length: 180 })
  slug!: string;

  @Column({ type: "text" })
  repoPath!: string;

  @Column({ type: "varchar", length: 180, nullable: true })
  repoKey!: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  frameworkMetadata!: Record<string, unknown>;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  apiStyleMetadata!: Record<string, unknown>;

  @Column({ type: "varchar", length: 64, default: "unknown" })
  agentOperableStatus!: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  currentGitCommit!: string | null;

  @Column({ type: "boolean", default: false })
  dirtyState!: boolean;

  @Column({ type: "timestamptz", nullable: true })
  lastScannedAt!: Date | null;

  @Column({ type: "text", default: ".clawchat/agent-docs" })
  generatedDocsPath!: string;

  @Column({ type: "varchar", length: 64, default: "not_generated" })
  documentationPackStatus!: string;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
