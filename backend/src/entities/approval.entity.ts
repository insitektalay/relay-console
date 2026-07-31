import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("approvals")
@Index(["workspaceId", "status"])
export class ApprovalEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({ default: "pending" })
  status: string;

  @Column()
  requestedByAgentId: string;

  @Column({ nullable: true })
  taskId: string;

  @Column()
  workspaceId: string;

  @Column({ default: "medium" })
  risk: string;

  @Column({ type: "jsonb", default: "[]" })
  steps: object[];

  @Column({ type: "jsonb", default: "{}" })
  metadata: Record<string, unknown>;

  @Column({ nullable: true, type: "text" })
  notes: string;

  @Column({ type: "timestamptz", nullable: true })
  resolvedAt: Date;

  @Column({ nullable: true })
  resolvedByUserId: string;

  @Column({ type: "timestamptz", nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
