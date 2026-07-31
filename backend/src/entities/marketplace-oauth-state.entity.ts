import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("marketplace_oauth_states")
@Index(["stateHash"], { unique: true })
@Index(["workspaceId", "appSlug"])
export class MarketplaceOAuthStateEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  workspaceId!: string;

  @Column("uuid")
  userId!: string;

  @Column({ length: 120 })
  appSlug!: string;

  @Column("uuid", { nullable: true })
  reauthorizeConnectionId!: string | null;

  @Column({ length: 128 })
  stateHash!: string;

  @Column({ name: "codeVerifier", type: "text", select: false, nullable: true })
  legacyCodeVerifier!: string | null;

  @Column({ type: "text", select: false, nullable: true })
  codeVerifierCiphertext!: string | null;

  @Column({ length: 128, select: false, nullable: true })
  codeVerifierIv!: string | null;

  @Column({ length: 128, select: false, nullable: true })
  codeVerifierAuthTag!: string | null;

  @Column({ length: 32, select: false, nullable: true })
  codeVerifierKeyVersion!: string | null;

  // Provider-specific ephemeral material (for example a DPoP private JWK and
  // the discovery/binding snapshot) is encrypted as one versioned bundle.
  // It must never be placed in metadata or returned from an API view.
  @Column({ type: "text", select: false, nullable: true })
  providerSessionCiphertext!: string | null;

  @Column({ length: 128, select: false, nullable: true })
  providerSessionIv!: string | null;

  @Column({ length: 128, select: false, nullable: true })
  providerSessionAuthTag!: string | null;

  @Column({ length: 32, select: false, nullable: true })
  providerSessionKeyVersion!: string | null;

  @Column({ type: "text" })
  clientId!: string;

  @Column({ length: 48, nullable: true })
  authorityMode!: string | null;

  @Column({ type: "text", nullable: true })
  authorityTenantId!: string | null;

  @Column({ type: "text", nullable: true })
  authorityAuthorizeUrl!: string | null;

  @Column({ type: "text", nullable: true })
  authorityTokenUrl!: string | null;

  @Column({ type: "text", select: false, nullable: true })
  clientSecretCiphertext!: string | null;

  @Column({ length: 128, select: false, nullable: true })
  clientSecretIv!: string | null;

  @Column({ length: 128, select: false, nullable: true })
  clientSecretAuthTag!: string | null;

  @Column({ length: 32, select: false, nullable: true })
  clientSecretKeyVersion!: string | null;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  scopes!: string[];

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  selectedCapabilities!: string[];

  @Column({ length: 200 })
  displayName!: string;

  @Column({ length: 80, default: "default" })
  environment!: string;

  @Column({ type: "text" })
  redirectUri!: string;

  @Column({ type: "text", nullable: true })
  returnTo!: string | null;

  @Column({ type: "timestamptz" })
  expiresAt!: Date;

  @Column({ type: "timestamptz", nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
