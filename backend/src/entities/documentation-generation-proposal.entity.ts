import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("documentation_generation_proposals")
@Index(["workspaceId", "status"])
@Index(["workspaceId", "linkedApplicationId"])
export class DocumentationGenerationProposalEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid" })
  linkedApplicationId!: string;

  @Column({ type: "uuid", nullable: true })
  packId!: string | null;

  @Column({ type: "varchar", length: 80 })
  mode!: string;

  @Column({ type: "varchar", length: 64, default: "pending_review" })
  status!: string;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  summaries!: Array<Record<string, unknown>>;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  conflicts!: Array<Record<string, unknown>>;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  reviewNotes!: Array<Record<string, unknown>>;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  suggestedApplyActions!: Array<Record<string, unknown>>;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  compilerInputMetadata!: Record<string, unknown>;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  compilerOutputMetadata!: Record<string, unknown>;

  @Column({ type: "uuid", nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
