import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("documentation_proposal_files")
@Index(["proposalId", "relativePath"], { unique: true })
@Index(["workspaceId", "classification"])
export class DocumentationProposalFileEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid" })
  proposalId!: string;

  @Column({ type: "text" })
  relativePath!: string;

  @Column({ type: "text", nullable: true })
  previousContent!: string | null;

  @Column({ type: "text" })
  updatedContent!: string;

  @Column({ type: "varchar", length: 128, nullable: true })
  previousHash!: string | null;

  @Column({ type: "varchar", length: 128 })
  updatedHash!: string;

  @Column({ type: "varchar", length: 80 })
  classification!: string;

  @Column({ type: "varchar", length: 80 })
  refreshPolicy!: string;

  @Column({ type: "varchar", length: 64, default: "none" })
  conflictStatus!: string;

  @Column({ type: "boolean", default: false })
  requiresManualReview!: boolean;

  @Column({ type: "varchar", length: 64, default: "pending" })
  applyStatus!: string;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
