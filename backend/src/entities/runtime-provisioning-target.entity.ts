import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export const RUNTIME_PROVISIONING_TARGET_STATUSES = [
  "active",
  "needs_review",
  "unavailable",
  "revoked",
] as const;

export type RuntimeProvisioningTargetStatus =
  (typeof RUNTIME_PROVISIONING_TARGET_STATUSES)[number];

export const RUNTIME_PROVISIONING_SELECTION_SOURCES = [
  "initial_connection",
  "sole_eligible_host",
  "administrator",
  "legacy_backfill",
] as const;

export type RuntimeProvisioningSelectionSource =
  (typeof RUNTIME_PROVISIONING_SELECTION_SOURCES)[number];

@Entity("runtime_provisioning_targets")
@Index(["workspaceId", "runtimeType"], { unique: true })
@Index(["runtimeHostId", "status"])
export class RuntimeProvisioningTargetEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  workspaceId: string;

  @Column()
  runtimeType: string;

  @Column("uuid", { nullable: true })
  runtimeHostId: string | null;

  @Column({ default: "needs_review" })
  status: RuntimeProvisioningTargetStatus;

  @Column({ default: "initial_connection" })
  selectionSource: RuntimeProvisioningSelectionSource;

  @Column("uuid", { nullable: true })
  selectedByUserId: string | null;

  @Column({ type: "timestamptz", nullable: true })
  lastValidatedAt: Date | null;

  @Column({ type: "text", nullable: true })
  statusReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
