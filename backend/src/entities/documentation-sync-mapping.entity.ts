import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("documentation_sync_mappings")
@Index(["workspaceId", "packId"])
@Index(["workspaceId", "targetKind", "targetPath"])
export class DocumentationSyncMappingEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid" })
  packId!: string;

  @Column({ type: "varchar", length: 32 })
  targetKind!: string;

  @Column({ type: "text" })
  sourcePath!: string;

  @Column({ type: "text" })
  targetPath!: string;

  @Column({ type: "varchar", length: 128, nullable: true })
  sourceHash!: string | null;

  @Column({ type: "varchar", length: 128, nullable: true })
  targetHash!: string | null;

  @Column({ type: "varchar", length: 64, default: "current" })
  status!: string;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
