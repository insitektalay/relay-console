import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("agent_documentation_versions")
@Index(["workspaceId", "appSlug", "agentId", "role", "version"], { unique: true })
@Index(["workspaceId", "appSlug", "createdAt"])
@Index(["workspaceId", "agentId", "createdAt"])
@Index(["workspaceId", "applicationDocumentationVersionId"])
export class AgentDocumentationVersionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "varchar", length: 120 })
  appSlug!: string;

  @Column({ type: "uuid" })
  agentId!: string;

  @Column({ type: "varchar", length: 32 })
  role!: string;

  @Column({ type: "uuid", nullable: true })
  marketplaceInstallId!: string | null;

  @Column({ type: "uuid", nullable: true })
  agentDocumentationInstallId!: string | null;

  @Column({ type: "uuid", nullable: true })
  applicationDocumentationVersionId!: string | null;

  @Column({ type: "uuid", nullable: true })
  packId!: string | null;

  @Column({ type: "int" })
  version!: number;

  @Column({ type: "varchar", length: 64, default: "installed" })
  status!: string;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  workspaceFileManifest!: Array<Record<string, unknown>>;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  fileChanges!: Record<string, unknown>;

  @Column({ type: "varchar", length: 64, default: "manual" })
  trigger!: string;

  @Column({ type: "uuid", nullable: true })
  installedByUserId!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  installedAt!: Date | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
