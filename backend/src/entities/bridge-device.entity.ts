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

export enum BridgeDeviceStatus {
  PENDING = "pending",
  ACTIVE = "active",
  REVOKED = "revoked",
}

@Entity("bridge_devices")
@Index(["workspaceId"])
@Index(["devicePublicId"], { unique: true })
@Index(["workspaceId", "hostInstallationId", "adapterRole"])
export class BridgeDeviceEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  workspaceId: string;

  @Column({ nullable: true })
  createdByUserId: string | null;

  @Column()
  label: string;

  @Column()
  devicePublicId: string;

  @Column({ select: false })
  credentialHash: string;

  @Column({ nullable: true, select: false })
  previousCredentialHash: string | null;

  @Column({ type: "integer", nullable: true })
  previousCredentialVersion: number | null;

  @Column({ type: "timestamptz", nullable: true })
  previousCredentialConsumedAt: Date | null;

  @Column({
    type: "enum",
    enum: BridgeDeviceStatus,
    default: BridgeDeviceStatus.ACTIVE,
  })
  status: BridgeDeviceStatus;

  @Column({ type: "jsonb", default: () => "'[]'" })
  capabilities: string[];

  @Column({ nullable: true })
  openCoreVersion: string | null;

  @Column({ nullable: true })
  pluginVersion: string | null;

  @Column({ nullable: true })
  runtimeType: string | null;

  @Column({ nullable: true })
  hostType: string | null;

  @Column({ nullable: true })
  hostInstallationId: string | null;

  @Column({ default: "runtime" })
  adapterRole: "host" | "runtime";

  @Column({ type: "jsonb", nullable: true })
  runtimeModelCatalog: {
    runtimeType: string;
    defaultModel: string;
    models: string[];
    source: string;
    observedAt: string;
  } | null;

  @Column({ type: "timestamptz", nullable: true })
  runtimeModelCatalogObservedAt: Date | null;

  @Column({ default: 1 })
  credentialVersion: number;

  @Column({ type: "timestamptz", nullable: true })
  credentialRotatedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  lastSeenAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => WorkspaceEntity, (workspace) => workspace.bridgeDevices, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "workspaceId" })
  workspace: WorkspaceEntity;

  @ManyToOne(() => UserEntity, (user) => user.createdBridgeDevices, {
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "createdByUserId" })
  createdByUser: UserEntity | null;
}
