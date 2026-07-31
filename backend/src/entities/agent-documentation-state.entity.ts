import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("agent_documentation_state_snapshots")
@Index(["workspaceId", "packId"])
@Index(["workspaceId", "agentId"])
export class AgentDocumentationStateSnapshotEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid", nullable: true })
  packId!: string | null;

  @Column({ type: "uuid", nullable: true })
  agentId!: string | null;

  @Column({ type: "varchar", length: 80 })
  snapshotKind!: string;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  state!: Record<string, unknown>;

  @Column({ type: "text", nullable: true })
  exportedLibraryPath!: string | null;

  @Column({ type: "varchar", length: 64, default: "not_exported" })
  exportStatus!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
