import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("application_documentation_versions")
@Index(["workspaceId", "appSlug", "version"], { unique: true })
@Index(["workspaceId", "appSlug", "createdAt"])
@Index(["workspaceId", "generatedPackId"])
export class ApplicationDocumentationVersionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "varchar", length: 120 })
  appSlug!: string;

  @Column({ type: "uuid", nullable: true })
  linkedApplicationId!: string | null;

  @Column({ type: "uuid", nullable: true })
  generatedPackId!: string | null;

  @Column({ type: "int" })
  version!: number;

  @Column({ type: "varchar", length: 128, nullable: true })
  sourceHash!: string | null;

  @Column({ type: "varchar", length: 128, nullable: true })
  packHash!: string | null;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  sourceFiles!: Array<Record<string, unknown>>;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  generatedFiles!: Array<Record<string, unknown>>;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  sourceDiff!: Record<string, unknown>;

  @Column({ type: "varchar", length: 64, default: "generated" })
  status!: string;

  @Column({ type: "varchar", length: 64, default: "manual" })
  trigger!: string;

  @Column({ type: "uuid", nullable: true })
  createdByUserId!: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
