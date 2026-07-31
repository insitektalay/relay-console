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
import { AgentEntity } from "./agent.entity";
import { AgentDocumentationInstallEntity } from "./agent-documentation-install.entity";
import { ApplicationDocumentationPackEntity } from "./application-documentation-pack.entity";
import { MarketplaceConnectionEntity } from "./marketplace-connection.entity";
import { WorkspaceEntity } from "./workspace.entity";
import { type MarketplaceInstallRole } from "../modules/marketplace/marketplace-install-role";

@Entity("marketplace_installs")
@Index(["workspaceId", "appSlug"])
@Index(["workspaceId", "agentId"])
@Index(["workspaceId", "connectionId"])
export class MarketplaceInstallEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  workspaceId!: string;

  @Column({ length: 120 })
  appSlug!: string;

  @Column("uuid", { nullable: true })
  connectionId!: string | null;

  @Column("uuid")
  agentId!: string;

  @Column("uuid")
  packId!: string;

  @Column("uuid", { nullable: true })
  agentDocumentationInstallId!: string | null;

  @Column({ type: "varchar", length: 32, default: "worker" })
  role!: MarketplaceInstallRole;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  selectedCapabilities!: string[];

  @Column({ type: "varchar", length: 64, default: "installed" })
  installStatus!: string;

  @Column({ type: "varchar", length: 64, default: "current" })
  driftStatus!: string;

  @Column({ type: "timestamptz", nullable: true })
  lastInstalledAt!: Date | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => WorkspaceEntity)
  @JoinColumn({ name: "workspaceId" })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => MarketplaceConnectionEntity, { nullable: true })
  @JoinColumn({ name: "connectionId" })
  connection!: MarketplaceConnectionEntity | null;

  @ManyToOne(() => AgentEntity)
  @JoinColumn({ name: "agentId" })
  agent!: AgentEntity;

  @ManyToOne(() => ApplicationDocumentationPackEntity)
  @JoinColumn({ name: "packId" })
  pack!: ApplicationDocumentationPackEntity;

  @ManyToOne(() => AgentDocumentationInstallEntity, { nullable: true })
  @JoinColumn({ name: "agentDocumentationInstallId" })
  agentDocumentationInstall!: AgentDocumentationInstallEntity | null;
}
