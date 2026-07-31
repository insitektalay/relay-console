import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("documentation_blueprints")
@Index(["workspaceId", "systemKey", "version"], { unique: true })
@Index(["workspaceId", "status"])
export class DocumentationBlueprintEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", nullable: true })
  workspaceId!: string | null;

  @Column({ type: "uuid", nullable: true })
  createdByUserId!: string | null;

  @Column({ type: "uuid", nullable: true })
  forkedFromBlueprintId!: string | null;

  @Column({ type: "varchar", length: 140 })
  systemKey!: string;

  @Column({ type: "varchar", length: 180 })
  name!: string;

  @Column({ type: "varchar", length: 48 })
  version!: string;

  @Column({ type: "varchar", length: 32, default: "published" })
  status!: string;

  @Column({ type: "boolean", default: false })
  isSystem!: boolean;

  @Column({ type: "boolean", default: false })
  protected!: boolean;

  @Column({ type: "varchar", length: 80 })
  compilerPromptVersion!: string;

  @Column({ type: "text" })
  content!: string;

  @Column({ type: "text", default: "" })
  changelog!: string;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
