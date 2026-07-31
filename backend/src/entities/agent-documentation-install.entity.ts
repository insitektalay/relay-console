import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("agent_documentation_installs")
@Index(["workspaceId", "agentId", "packId", "role"], { unique: true })
@Index(["workspaceId", "driftStatus"])
export class AgentDocumentationInstallEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid" })
  agentId!: string;

  @Column({ type: "uuid" })
  packId!: string;

  @Column({ type: "varchar", length: 32 })
  role!: string;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  installedBlueprintVersions!: Array<Record<string, unknown>>;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  workspaceFileManifest!: Array<Record<string, unknown>>;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  localOverrides!: Record<string, unknown>;

  @Column({ type: "varchar", length: 64, default: "not_installed" })
  installStatus!: string;

  @Column({ type: "varchar", length: 64, default: "unknown" })
  driftStatus!: string;

  @Column({ type: "timestamptz", nullable: true })
  lastInstalledAt!: Date | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
