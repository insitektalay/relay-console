import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { UserEntity } from "./user.entity";
import { WorkspaceEntity } from "./workspace.entity";

export const MARKETPLACE_CONNECTION_STATUSES = [
  "unverified",
  "ready",
  "needs_credentials",
  "error",
] as const;

export type MarketplaceConnectionStatus =
  (typeof MARKETPLACE_CONNECTION_STATUSES)[number];

export type MarketplaceExecutionAuthority = "railway" | "swift";

@Entity("marketplace_connections")
@Index(["workspaceId", "appSlug"])
@Index(["workspaceId", "status"])
export class MarketplaceConnectionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  workspaceId!: string;

  @Column({ length: 120 })
  appSlug!: string;

  @Column({ length: 200 })
  displayName!: string;

  @Column({ length: 80, default: "default" })
  environment!: string;

  @Column({ type: "varchar", length: 48, default: "api_key" })
  authType!: string;

  @Column({ type: "varchar", length: 16, default: "railway" })
  executionAuthority!: MarketplaceExecutionAuthority;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  credentialNames!: string[];

  @Column({ type: "text", select: false, nullable: true })
  secretCiphertext!: string | null;

  @Column({ length: 128, select: false, nullable: true })
  secretIv!: string | null;

  @Column({ length: 128, select: false, nullable: true })
  secretAuthTag!: string | null;

  @Column({ length: 32, select: false, nullable: true })
  secretKeyVersion!: string | null;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  selectedCapabilities!: string[];

  @Column({ type: "varchar", length: 32, default: "unverified" })
  status!: MarketplaceConnectionStatus;

  @Column({ type: "timestamptz", nullable: true })
  lastValidatedAt!: Date | null;

  @Column({ length: 64, nullable: true })
  lastErrorCode!: string | null;

  @Column({ type: "text", nullable: true })
  lastErrorMessage!: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column("uuid")
  createdByUserId!: string;

  @Column("uuid")
  updatedByUserId!: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => WorkspaceEntity)
  @JoinColumn({ name: "workspaceId" })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: "createdByUserId" })
  createdByUser!: UserEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: "updatedByUserId" })
  updatedByUser!: UserEntity;
}
