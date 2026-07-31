import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export const TOOL_REQUEST_STATUSES = [
  "requested",
  "connected",
  "granted",
  "ignored",
  "dismissed",
  "unavailable",
  "resolved",
] as const;

export type ToolRequestStatus = (typeof TOOL_REQUEST_STATUSES)[number];

@Entity("tool_requests")
@Index(["workspaceId", "appSlug", "requestedCapability"])
@Index(["workspaceId", "status"])
@Index(["workspaceId", "teamId"])
@Index(["workspaceId", "threadId"])
export class ToolRequestEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  workspaceId!: string;

  @Column({ type: "uuid", nullable: true })
  linkedAppId!: string | null;

  @Column({ type: "varchar", length: 180, nullable: true })
  appSlug!: string | null;

  @Column({ type: "uuid", nullable: true })
  teamId!: string | null;

  @Column({ type: "uuid", nullable: true })
  threadId!: string | null;

  @Column({ type: "varchar", length: 180, nullable: true })
  campaignId!: string | null;

  @Column({ type: "varchar", length: 240, nullable: true })
  campaignName!: string | null;

  @Column({ type: "uuid", nullable: true })
  requestingAgentId!: string | null;

  @Column({ type: "varchar", length: 240, nullable: true })
  requestingAgentName!: string | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  role!: string | null;

  @Column({ type: "varchar", length: 120 })
  requestedCapability!: string;

  @Column({ type: "varchar", length: 240 })
  requiredForAction!: string;

  @Column({ type: "text" })
  reason!: string;

  @Column({ type: "uuid", nullable: true })
  relatedTaskId!: string | null;

  @Column({ type: "varchar", length: 120, nullable: true })
  relatedRecordType!: string | null;

  @Column({ type: "varchar", length: 180, nullable: true })
  relatedRecordId!: string | null;

  @Column({ type: "varchar", length: 80, nullable: true })
  autonomyModeAtRequest!: string | null;

  @Column({ type: "boolean", default: false })
  policyAllowed!: boolean;

  @Column({ type: "boolean", default: false })
  toolAvailable!: boolean;

  @Column({ type: "boolean", default: false })
  toolConnected!: boolean;

  @Column({ type: "boolean", default: false })
  toolGranted!: boolean;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  suggestedMarketplaceAppSlugs!: string[];

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  suggestedToolCategories!: string[];

  @Column({ type: "varchar", length: 160, nullable: true })
  requiredEvidenceType!: string | null;

  @Column({ type: "varchar", length: 32, default: "requested" })
  status!: ToolRequestStatus;

  @Column({ type: "text", nullable: true })
  resolutionNotes!: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ type: "timestamptz", nullable: true })
  lastSeenAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  resolvedAt!: Date | null;
}
