import type { paths } from "./generated";
import type { MessageCondensedUpdatedPayload } from "./message-condensed";
export * from "./message-condensed";

export type BackendPaths = paths;

export interface ApiEnvelope<T> {
  data: T;
}

export type RelayDeploymentOwnership = "self_hosted" | "relay_managed";
export type RelayEntitlementMode = "read_write" | "read_only";
export type RelayProductMode = "local" | "connect" | "cloud";
export type AgentLifecycleStatus =
  | "active"
  | "retired"
  | "quarantined"
  | "deleted";
export type RuntimeOwnershipState =
  | "unassigned"
  | "active"
  | "draining"
  | "quarantined";
export type RuntimeHostStatus =
  | "pending"
  | "online"
  | "offline"
  | "quarantined"
  | "retired";
export type RuntimeObservationStatus =
  | "active"
  | "stale"
  | "quarantined"
  | "migration_source"
  | "migration_target";
export type ManagedDocumentSyncState =
  | "saved"
  | "pending"
  | "applied"
  | "offline"
  | "conflict"
  | "failed";

export interface RelayDeploymentManifest {
  schemaVersion: "relay.deployment-manifest.v1";
  deploymentId: string;
  productVersion: string;
  apiContractVersion: string;
  syncContractVersion: string;
  runtimeHostContractVersion: string;
  supportedRuntimeHostContractVersions: string[];
  runtimeContractVersion: string;
  marketplaceContractVersion: string;
  origins: { backend: string; api: string; websocket: string; web: string };
  ownershipType: RelayDeploymentOwnership;
  releaseChannel: "stable" | "preview";
  minimumClients: { relayConsoleSwift: string; ios: string; web: string };
  maximumClientContract: string;
  enabledFeatures: Record<string, unknown>;
  limits: Record<string, number>;
  authenticationMethods: string[];
  marketplaceConnectorModes: string[];
  supportedBridgeReleases: Array<Record<string, unknown>>;
  connectionDescriptorSigning: {
    algorithm: "ed25519";
    keyId: string;
    publicKey: string;
  };
}

export interface RelayConnectionDescriptor {
  schemaVersion: "relay.connection-descriptor.v1";
  deploymentId: string;
  displayName: string;
  ownershipType: RelayDeploymentOwnership;
  apiOrigin: string;
  websocketOrigin: string;
  webOrigin: string;
  manifestUrl: string;
  issuedAt: string;
}

export interface RelaySignedDocument<T> {
  payload: T;
  signature: string;
  algorithm: "ed25519";
  keyId: string;
}

export interface RelayEntitlements {
  schemaVersion: "relay.entitlements.v1";
  workspaceId: string;
  plan: string;
  status: string;
  mode: RelayEntitlementMode;
  provider?: "stripe" | "apple" | null;
  currentPeriodEndsAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  lifecycle?: Record<string, string | null>;
  issuedAt: string;
  expiresAt: string | null;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  emailVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  type: "personal" | "business";
  avatarUrl?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  agentCount: number;
}

export interface UpdateSessionUserInput {
  name?: string;
}

export interface RequestEmailChangeInput {
  newEmail: string;
  currentPassword: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  avatarUrl?: string;
}

export interface LinkedApplication {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  repoPath: string;
  repoKey?: string | null;
  frameworkMetadata: Record<string, unknown>;
  apiStyleMetadata: Record<string, unknown>;
  agentOperableStatus: string;
  currentGitCommit?: string | null;
  dirtyState: boolean;
  lastScannedAt?: string | null;
  generatedDocsPath: string;
  documentationPackStatus: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLinkedApplicationInput {
  name: string;
  repoPath: string;
  repoKey?: string;
  slug?: string;
}

export interface UpdateLinkedApplicationInput {
  name?: string;
  repoPath?: string;
  repoKey?: string;
  slug?: string;
}

export interface DocumentationBlueprint {
  id: string;
  workspaceId?: string | null;
  forkedFromBlueprintId?: string | null;
  systemKey: string;
  name: string;
  version: string;
  status: string;
  isSystem: boolean;
  protected: boolean;
  compilerPromptVersion: string;
  content: string;
  changelog: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationDocumentationPack {
  id: string;
  workspaceId: string;
  linkedApplicationId: string;
  packPath: string;
  blueprintVersionSet: Array<Record<string, unknown>>;
  compilerVersion: string;
  repoCommit?: string | null;
  repoDirtyState: boolean;
  packHash?: string | null;
  generatedFileManifest: Array<Record<string, unknown>>;
  reviewStatus: string;
  syncStatus: string;
  libraryTargetFolder?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentationProposalFile {
  id: string;
  proposalId: string;
  relativePath: string;
  previousContent?: string | null;
  updatedContent: string;
  previousHash?: string | null;
  updatedHash: string;
  classification: string;
  refreshPolicy: string;
  conflictStatus: string;
  requiresManualReview: boolean;
  applyStatus: string;
  metadata: Record<string, unknown>;
}

export interface DocumentationGenerationProposal {
  id: string;
  workspaceId: string;
  linkedApplicationId: string;
  packId?: string | null;
  mode: string;
  status: string;
  summaries: Array<Record<string, unknown>>;
  conflicts: Array<Record<string, unknown>>;
  reviewNotes: Array<Record<string, unknown>>;
  suggestedApplyActions: Array<Record<string, unknown>>;
  compilerInputMetadata: Record<string, unknown>;
  compilerOutputMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  files?: DocumentationProposalFile[];
}

export interface GenerateDocumentationProposalInput {
  linkedApplicationId: string;
  mode:
    | "generate_initial_pack"
    | "refresh_from_blueprint"
    | "refresh_from_repo"
    | "review_existing_pack"
    | "generate_agent_workspace_files"
    | "refresh_agent_install";
  blueprintIds?: string[];
  packId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentDocumentationInstall {
  id: string;
  workspaceId: string;
  agentId: string;
  packId: string;
  role: MarketplaceInstallRole;
  installedBlueprintVersions: Array<Record<string, unknown>>;
  workspaceFileManifest: Array<Record<string, unknown>>;
  localOverrides: Record<string, unknown>;
  installStatus: string;
  driftStatus: string;
  lastInstalledAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationDocumentationVersion {
  id: string;
  workspaceId: string;
  appSlug: string;
  linkedApplicationId?: string | null;
  generatedPackId?: string | null;
  version: number;
  sourceHash?: string | null;
  packHash?: string | null;
  sourceFiles: Array<Record<string, unknown>>;
  generatedFiles: Array<Record<string, unknown>>;
  sourceDiff: Record<string, unknown>;
  status: string;
  trigger: string;
  createdByUserId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDocumentationVersion {
  id: string;
  workspaceId: string;
  appSlug: string;
  agentId: string;
  role: MarketplaceInstallRole;
  marketplaceInstallId?: string | null;
  agentDocumentationInstallId?: string | null;
  applicationDocumentationVersionId?: string | null;
  packId?: string | null;
  version: number;
  status: string;
  workspaceFileManifest: Array<Record<string, unknown>>;
  fileChanges: Record<string, unknown>;
  trigger: string;
  installedByUserId?: string | null;
  installedAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type MarketplaceCategory =
  | "communication"
  | "calendar"
  | "work_management"
  | "knowledge_documents"
  | "developer"
  | "commerce_payments"
  | "crm_support"
  | "calendar"
  | "content_creative";

export type MarketplaceRiskLevel = "low" | "medium" | "high" | "critical";
export type MarketplaceRuntimeFormat = "openclaw" | "hermes";
export type MarketplaceAppSourceType =
  | "external_provider"
  | "local_repo"
  | "uploaded_pack"
  | "third_party_pack";
export type MarketplaceLocalRepoSourceHostType =
  | "openclaw_bridge"
  | "hermes_bridge"
  | "runtime_host";
export type MarketplacePackQualityLevel =
  | "curated"
  | "generated_reviewed"
  | "generated_draft";
export type MarketplacePackPublicationStatus =
  | "published"
  | "review_needed"
  | "draft"
  | "blocked";
export const MARKETPLACE_HERMES_SKILL_INSTALL_CAPABILITY =
  "marketplaceHermesSkillInstall" as const;
export const MARKETPLACE_LOCAL_REPO_DOCS_READ_CAPABILITY =
  "marketplaceLocalRepoDocsRead" as const;
export const MARKETPLACE_LOCAL_REPO_DOCS_WRITE_CAPABILITY =
  "marketplaceLocalRepoDocsWrite" as const;
export const MARKETPLACE_LOCAL_APP_AGENT_API_SETUP_CAPABILITY =
  "marketplaceLocalAppAgentApiSetup" as const;

export interface MarketplaceActionPolicy {
  id: string;
  label: string;
  description: string;
}

export interface MarketplaceCredentialRequirement {
  name: string;
  label: string;
  required: boolean;
  secret: boolean;
  helpText: string;
  requiredForAuthTypes?: string[];
  inputType?: "text" | "select";
  options?: MarketplaceCredentialOption[];
  defaultValue?: string;
}

export interface MarketplaceCredentialOption {
  value: string;
  label: string;
}

export interface MarketplaceCapability {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

export interface MarketplaceApprovalProfile {
  id: string;
  label: string;
  description: string;
  defaultSelected: boolean;
  allowedActions?: MarketplaceActionPolicy[];
  approvalRequiredActions?: MarketplaceActionPolicy[];
  blockedActions?: MarketplaceActionPolicy[];
}

export type LocalAppAutonomyMode =
  | "safe_default"
  | "internal_write"
  | "supervised_external"
  | "dangerously_skip_permissions"
  | "custom_policy";

export type LocalAppExternalPermission =
  | "disabled"
  | "approval_required"
  | "allowed";

export type LocalAppLifecyclePermission =
  | "disabled"
  | "approval_required"
  | "allowed_with_evidence";

export interface LocalAppAutonomyPolicy {
  mode: LocalAppAutonomyMode;
  internal: {
    readRecords: boolean;
    draftRecords: boolean;
    writeInternalRecords: boolean;
    createTasks: boolean;
    updateTasks: boolean;
    updateInternalStatuses: boolean;
  };
  external: {
    browserNavigation: LocalAppExternalPermission;
    externalSearch: LocalAppExternalPermission;
    publicFormFill: LocalAppExternalPermission;
    publicFormSubmit: LocalAppExternalPermission;
    emailDraft: LocalAppExternalPermission;
    emailSend: LocalAppExternalPermission;
    accountCreation: LocalAppExternalPermission;
    credentialUse: LocalAppExternalPermission;
    externalPublishing: LocalAppExternalPermission;
    backlinkVerification: LocalAppExternalPermission;
    indexChecking: LocalAppExternalPermission;
  };
  lifecycleStatus: {
    markContacted: LocalAppLifecyclePermission;
    markSubmitted: LocalAppLifecyclePermission;
    markLive: LocalAppLifecyclePermission;
    markIndexed: LocalAppLifecyclePermission;
  };
  hardStops: {
    payments: boolean;
    destructiveDataLoss: boolean;
    exposeSecrets: boolean;
    captchaBypass: boolean;
    legalCommitments: boolean;
  };
  evidenceRequired: boolean;
  staleContextPolicy:
    | "current_policy_supersedes_old_chat"
    | "chat_history_may_restrict";
}

export interface MarketplaceRuntimeSupport {
  format: MarketplaceRuntimeFormat;
  installSupport: "installable" | "preview_only" | "unsupported";
  label: string;
  description: string;
}

export type MarketplaceRoleManifestSource = "default" | "explicit" | "inferred";

export interface MarketplaceRoleManifestEntry {
  role: string;
  label: string;
  purpose: string;
  docsSourcePath: string | null;
  runtimeOutputPath: string | null;
  canWrite: boolean | string;
  readOnly: boolean;
  approvalRequiredFor: string[];
  blockedActions: string[];
  required: boolean;
  installAfterSetup: boolean;
  recommendedAgentName: string | null;
  recommendedAgentType: string | null;
  installable: boolean;
  notInstallableReason: string | null;
  source: MarketplaceRoleManifestSource;
}

export interface MarketplaceRoleManifest {
  roles: MarketplaceRoleManifestEntry[];
  roleCount: number;
}

export interface MarketplacePackQualitySummary {
  level: MarketplacePackQualityLevel;
  publicationStatus: MarketplacePackPublicationStatus;
  label: string;
  description: string;
  confidence: "high" | "medium" | "low";
  reviewed: boolean;
  source: "curated_source" | "pack_factory" | "local_repo";
}

export type MarketplaceReleaseState =
  | "available"
  | "preview"
  | "provider_setup_required"
  | "provider_review_pending"
  | "customer_credential_required"
  | "unsupported"
  | "coming_later";

export interface MarketplaceAppRelease {
  manifestVersion: string;
  releaseChannel: string;
  freezeStatus: "open" | "frozen";
  state: MarketplaceReleaseState;
  label: string;
  connectEligible: boolean;
  liveVerified: boolean;
  verificationLevel: "documentation_reviewed" | "relay_verified";
  reason: string;
}

export interface MarketplaceReleaseManifestSummary {
  schemaVersion: "relay.marketplace-release.v1";
  manifestVersion: string;
  releaseChannel: string;
  freezeStatus: "open" | "frozen";
  frozenAt: string | null;
  sourceRevision: string | null;
}

export interface MarketplaceApp {
  slug: string;
  name: string;
  sourceType: MarketplaceAppSourceType;
  category: MarketplaceCategory;
  description: string;
  agentUseSummary: string;
  connectionTypes: string[];
  credentialRequirements: MarketplaceCredentialRequirement[];
  webhookRequirements: string[];
  approvalProfile: string;
  approvalProfiles: MarketplaceApprovalProfile[];
  riskLevel: MarketplaceRiskLevel;
  capabilities: MarketplaceCapability[];
  allowedActions: MarketplaceActionPolicy[];
  approvalRequiredActions: MarketplaceActionPolicy[];
  blockedActions: MarketplaceActionPolicy[];
  providerDocsUrl: string;
  providerWebsiteUrl: string;
  accountCreationUrl?: string;
  runtimeSupport: MarketplaceRuntimeSupport[];
  roleManifest?: MarketplaceRoleManifest;
  availability: "available" | "preview" | "unsupported";
  release?: MarketplaceAppRelease;
  packQuality: MarketplacePackQualitySummary;
  sourceMetadata?: Record<string, unknown>;
}

export interface MarketplaceCatalog {
  releaseManifest?: MarketplaceReleaseManifestSummary;
  categories: Array<{ id: MarketplaceCategory; label: string }>;
  apps: MarketplaceApp[];
}

export interface MarketplaceCatalogPageInfo {
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface MarketplaceCatalogPage extends MarketplaceCatalog {
  pageInfo: MarketplaceCatalogPageInfo;
}

export interface MarketplaceCatalogPageQuery {
  query?: string;
  category?: MarketplaceCategory;
  sourceType?: MarketplaceAppSourceType;
  cursor?: string;
  limit?: number;
}

export interface MarketplaceLocalRepoSourceHost {
  id: string;
  type: MarketplaceLocalRepoSourceHostType;
  label: string;
  status: "available" | "offline" | "unconfigured";
  runtimeType?: MarketplaceRuntimeFormat | null;
  bridgeDeviceId?: string | null;
  runtimeBindingId?: string | null;
  capabilities: string[];
  supportsLocalRepoDocsRead: boolean;
}

export interface CreateLocalMarketplaceAppInput {
  name: string;
  sourceHostType: MarketplaceLocalRepoSourceHostType;
  sourceHostId?: string | null;
  bridgeDeviceId?: string | null;
  runtimeBindingId?: string | null;
  sourceHostLabel?: string | null;
  runtimeType?: MarketplaceRuntimeFormat | null;
  repoPath: string;
  localAppUrl?: string;
  localApiUrl?: string;
  openApiSpecPath?: string;
  docsSourcePath?: string;
  lifecycle?: Record<string, unknown>;
  linkcrestCampaignId?: string;
  linkcrestCampaignName?: string;
  documentationAutomationMode?:
    | "manual_review"
    | "auto_apply_safe"
    | "auto_apply_full";
  autonomyPolicy?: LocalAppAutonomyPolicy;
  acknowledgeDangerouslySkipPermissions?: boolean;
}

export interface UpdateLocalMarketplaceAppInput {
  sourceHostType?: MarketplaceLocalRepoSourceHostType;
  sourceHostId?: string | null;
  bridgeDeviceId?: string | null;
  runtimeBindingId?: string | null;
  sourceHostLabel?: string | null;
  runtimeType?: MarketplaceRuntimeFormat | null;
  repoPath?: string;
  localAppUrl?: string | null;
  localApiUrl?: string | null;
  openApiSpecPath?: string | null;
  docsSourcePath?: string;
  lifecycle?: Record<string, unknown> | null;
  linkcrestCampaignId?: string | null;
  linkcrestCampaignName?: string | null;
  documentationAutomationMode?:
    | "manual_review"
    | "auto_apply_safe"
    | "auto_apply_full";
  autonomyPolicy?: LocalAppAutonomyPolicy | null;
  acknowledgeDangerouslySkipPermissions?: boolean;
}

export interface MarketplaceConnection {
  id: string;
  workspaceId: string;
  appSlug: string;
  displayName: string;
  environment: string;
  authType: string;
  executionAuthority: "railway" | "swift";
  credentialNames: string[];
  selectedCapabilities: string[];
  status: string;
  lastValidatedAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  metadata: Record<string, unknown>;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export type ToolRequestStatus =
  | "requested"
  | "connected"
  | "granted"
  | "ignored"
  | "dismissed"
  | "unavailable"
  | "resolved";

export interface ToolRequest {
  id: string;
  workspaceId: string;
  linkedAppId: string | null;
  appSlug: string | null;
  teamId: string | null;
  threadId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  requestingAgentId: string | null;
  requestingAgentName: string | null;
  role: string | null;
  requestedCapability: string;
  requiredForAction: string;
  reason: string;
  relatedTaskId: string | null;
  relatedRecordType: string | null;
  relatedRecordId: string | null;
  autonomyModeAtRequest: string | null;
  policyAllowed: boolean;
  toolAvailable: boolean;
  toolConnected: boolean;
  toolGranted: boolean;
  suggestedMarketplaceAppSlugs: string[];
  suggestedToolCategories: string[];
  requiredEvidenceType: string | null;
  status: ToolRequestStatus;
  resolutionNotes: string | null;
  metadata: Record<string, unknown>;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface NeededToolsSummary {
  totalOpen: number;
  groups: Array<{
    appSlug: string | null;
    capability: string;
    count: number;
    requests: ToolRequest[];
  }>;
}

export interface LinkCrestPolicySyncStatus {
  status: "synced" | "unsynced" | "failed" | "skipped";
  message: string;
  campaignId: string | null;
  campaignName: string | null;
  clawchatMode: string;
  linkcrestMode: string | null;
  lastSyncAt: string;
  mismatch: boolean;
  errorCode?: string | null;
}

export interface ConfigureLinkCrestOpenClawInput {
  openclawBaseUrl: string;
  bearerKey?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
}

export interface AutoConnectLocalAppInput {
  workerAgentIds?: string[];
  managerAgentId?: string | null;
  auditorAgentId?: string | null;
  autonomyMode?: LocalAppAutonomyMode;
  autonomyPolicy?: LocalAppAutonomyPolicy | null;
  campaignId?: string | null;
  campaignName?: string | null;
  sourceHostId?: string | null;
  approvalProfileId?: string | null;
  acknowledgeDangerouslySkipPermissions?: boolean;
}

export interface AutoConnectLocalAppResult {
  status: "connected" | "action_required" | "partial" | "failed";
  message: string;
  app: MarketplaceApp;
  connectionId: string | null;
  checklist: Record<string, boolean>;
  campaigns: Array<{
    id: string;
    name: string;
    slug?: string | null;
    status?: string | null;
    metadata?: Record<string, unknown>;
  }>;
  selectedCampaign: {
    id: string;
    name: string;
    slug?: string | null;
    status?: string | null;
    metadata?: Record<string, unknown>;
  } | null;
  policySync: LinkCrestPolicySyncStatus | Record<string, unknown> | null;
  installResults: Array<Record<string, unknown>>;
  neededToolsSummary: Record<string, unknown> | null;
  userActionRequired: string | null;
  diagnostics: Record<string, unknown>;
}

export interface MarketplaceConnectionMetadataInput {
  sourceHostType?: MarketplaceLocalRepoSourceHostType | string | null;
  sourceHostId?: string | null;
  bridgeDeviceId?: string | null;
  runtimeBindingId?: string | null;
  sourceHostLabel?: string | null;
  runtimeType?: MarketplaceRuntimeFormat | string | null;
  localRepoPath?: string | null;
  appSlug?: string | null;
  localAppUrl?: string | null;
  localApiUrl?: string | null;
  convexSiteUrl?: string | null;
  lifecycle?: Record<string, unknown> | null;
  allowRuntimeHostStart?: boolean;
  lifecycleApprovalPolicy?: string | null;
  autonomyPolicy?: LocalAppAutonomyPolicy | null;
}

export interface XMarketplaceOAuthConfig {
  callbackUrl: string;
  requiredScopes: string[];
  optionalScopes: string[];
  authorizeUrl: string;
  docsUrl: string;
}

export interface MarketplaceConnectorCredentialSchemaField {
  name: string;
  label: string;
  required: boolean;
  secret: boolean;
  helpText?: string;
}

export interface MarketplaceConnectorOAuthConfig {
  appSlug: string;
  callbackUrl: string;
  requiredScopes: string[];
  optionalScopes: string[];
  authorizeUrl: string;
  authority?: {
    mode?: string | null;
    tenantId?: string | null;
    authorizationUrl: string;
    tokenUrl: string;
  };
  docsUrl: string;
  credentialSchema: MarketplaceConnectorCredentialSchemaField[];
}

export interface StartXMarketplaceOAuthInput {
  clientId?: string;
  clientSecret?: string;
  optionalScopes?: string[];
  selectedCapabilities?: string[];
  displayName?: string;
  environment?: string;
  returnTo?: string;
  connectionId?: string;
}

export interface StartMarketplaceConnectorOAuthInput {
  clientId?: string;
  clientSecret?: string;
  microsoftAuthorityMode?:
    | "single_tenant"
    | "multi_tenant_org"
    | "multi_tenant_common";
  microsoftTenantId?: string;
  optionalScopes?: string[];
  selectedCapabilities?: string[];
  displayName?: string;
  environment?: string;
  returnTo?: string;
  connectionId?: string;
  username?: string;
  password?: string;
  instaparserApiKey?: string;
  providerDomain?: string;
}

export interface StartXMarketplaceOAuthResult {
  authorizationUrl: string;
  callbackUrl: string;
  requiredScopes: string[];
  optionalScopes: string[];
  expiresAt: string;
}

export interface StartMarketplaceConnectorOAuthResult {
  authorizationUrl: string;
  callbackUrl: string;
  requiredScopes: string[];
  optionalScopes: string[];
  expiresAt: string;
}

export interface MarketplaceConnectorHealth {
  status: "ready" | "needs_auth" | "missing_scope" | "error";
  connectionId: string;
  appSlug: string;
  tokenValid: boolean;
  refreshAvailable: boolean;
  grantedScopes: string[];
  missingScopes: string[];
  accountLabel?: string | null;
  lastCheckedAt: string;
  errorCode?: string | null;
  message?: string | null;
}

export type MarketplaceInstallRole = string;

export interface MarketplaceInstall {
  id: string;
  workspaceId: string;
  appSlug: string;
  connectionId?: string | null;
  agentId: string;
  packId: string;
  agentDocumentationInstallId?: string | null;
  role: MarketplaceInstallRole;
  selectedCapabilities: string[];
  installStatus: string;
  driftStatus: string;
  lastInstalledAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ValidateConnectorSenderIdentityInput {
  email: string;
  agentId?: string;
  installId?: string;
}

export interface UpdateMarketplaceInstallInput {
  approvalProfileId?: string;
  acknowledgeDangerouslySkipPermissions?: boolean;
  outlookSenderEmail?: string;
  metadata?: Record<string, unknown>;
}

export interface MarketplacePackPreviewFile {
  relativePath: string;
  content: string;
  classification: string;
  refreshPolicy: string;
}

export interface MarketplacePackPreview {
  appSlug: string;
  runtimeFormat: MarketplaceRuntimeFormat;
  approvalProfileId: string;
  selectedCapabilities: string[];
  metadata: Record<string, unknown>;
  files: MarketplacePackPreviewFile[];
}

export interface MarketplaceGeneratedPackSummary {
  id: string;
  workspaceId: string;
  appSlug: string;
  name: string;
  category: string;
  riskLevel: string;
  qualityLevel: "generated_draft" | "generated_reviewed";
  publicationStatus: "review_needed" | "published" | "draft" | "blocked";
  reviewStatus: string;
  confidence: "high" | "medium" | "low";
  qualityScore: number;
  missingSections: string[];
  warnings: string[];
  officialDocsCoverage: Record<string, boolean>;
  highRiskActionsDetected: boolean;
  sourceUrls: string[];
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceGeneratedPackDetail extends MarketplaceGeneratedPackSummary {
  generatedPack: Record<string, unknown>;
  reviewGate?: Record<string, unknown>;
  sourceIngestion?: Record<string, unknown>;
  sourceDiff?: Record<string, unknown>;
  extractedSourceModel?: Record<string, unknown>;
  sources: Array<Record<string, unknown>>;
  qualityScores: Array<Record<string, unknown>>;
  reviews: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
  openclawPreview: MarketplacePackPreview;
  hermesPreview: MarketplacePackPreview;
}

export interface MarketplacePackCoverageReport {
  generatedAt: string;
  totalApps: number;
  curatedCount: number;
  generatedCount: number;
  missingSourceCount: number;
  failedGenerationCount: number;
  appsNeedingReview: string[];
  apps: Array<Record<string, unknown>>;
}

export interface MarketplaceHermesSkillInstallFile {
  relativePath: string;
  content: string;
  sha256: string;
}

export interface MarketplaceHermesSkillInstallRequest {
  type: "marketplace.installHermesSkill";
  requestId: string;
  workspaceId: string;
  agentId: string;
  appSlug: string;
  marketplaceInstallId?: string | null;
  runtimeFormat: "hermes";
  skillName: string;
  targetRoot: string;
  approvalProfileId: string;
  selectedCapabilities: string[];
  connection: {
    id: string | null;
    displayName: string | null;
    environment: string | null;
    authType: string | null;
  };
  files: MarketplaceHermesSkillInstallFile[];
  policy: {
    overwrite: "managed_files_only";
    removeStaleManagedFiles: boolean;
  };
  metadata: {
    generatedBy: "clawchat-marketplace";
    packVersion: string;
    canonicalPackSlug: string;
    generatedAt: string;
  };
}

export interface MarketplaceHermesSkillInstallResponse {
  requestId: string;
  status: "installed" | "rejected" | "failed";
  agentId: string;
  appSlug: string;
  installedFiles: string[];
  skippedFiles?: string[];
  bridgeCapabilities?: string[];
  error?: {
    code: string;
    message: string;
  };
}

export interface MarketplaceReadLocalRepoDocsFile {
  relativePath: string;
  content: string;
  sha256: string;
  sizeBytes: number;
}

export interface MarketplaceReadLocalRepoDocsRequest {
  type: "marketplace.readLocalRepoDocs";
  requestId: string;
  workspaceId: string;
  sourceHostId?: string | null;
  bridgeDeviceId?: string | null;
  sourceHostType?: MarketplaceLocalRepoSourceHostType | string | null;
  runtimeType?: MarketplaceRuntimeFormat | string | null;
  repoPath: string;
  docsSourcePath: string;
  includeGlobs: string[];
}

export interface MarketplaceReadLocalRepoDocsResponse {
  requestId: string;
  status: "ok" | "not_found" | "failed";
  repoPath: string;
  docsSourcePath: string;
  files: MarketplaceReadLocalRepoDocsFile[];
  missingFiles: string[];
  errors: string[];
  gitCommit?: string | null;
  gitBranch?: string | null;
  dirtyState?: boolean | null;
  dirtyFiles?: string[] | null;
}

export interface MarketplaceLocalRepoDocsStatus {
  app: MarketplaceApp;
  automation: {
    mode?: "manual_review" | "auto_apply_safe" | "auto_apply_full";
    lastRun?: Record<string, unknown> | null;
  };
  sourceDiagnostics: Record<string, unknown>;
  roleCoverage: Record<string, unknown>;
  canonicalDocs: Record<string, unknown>;
  generatedPack: Record<string, unknown> | null;
  agentInstalls: Array<Record<string, unknown>>;
  appAnalysis: {
    latestProposal: DocumentationGenerationProposal | null;
    proposals: DocumentationGenerationProposal[];
  };
  bridgeContract: Record<string, unknown>;
}

export interface MarketplaceLocalRepoDocsProposalApplyInput {
  approvedFileIds?: string[];
  rejectedFileIds?: string[];
}

export interface MarketplaceLocalRepoDocsProposalApplyResult {
  proposal: DocumentationGenerationProposal;
  appliedFiles: string[];
  rejectedFileIds: string[];
  refresh: MarketplaceAgentDocsRefreshResult | null;
  status: string;
}

export interface MarketplaceInstallResult {
  app: MarketplaceApp;
  pack: ApplicationDocumentationPack | null;
  syncedFiles: string[];
  installs: MarketplaceInstall[];
  runtimeFormat: MarketplaceRuntimeFormat;
  createdAgent?: Agent | null;
  status?: "installed" | "unavailable" | "failed";
  message?: string | null;
  requiredCapability?: string | null;
  bridgeRequest?: MarketplaceHermesSkillInstallRequest | null;
  bridgeResponse?: MarketplaceHermesSkillInstallResponse | null;
}

export interface MarketplaceAgentDocsRefreshResult {
  app: MarketplaceApp;
  generatedPack: MarketplaceGeneratedPackDetail;
  installs: MarketplaceInstall[];
  status: "current";
  message: string;
}

export interface MarketplaceDocumentationHistory {
  app: MarketplaceApp;
  applicationVersions: ApplicationDocumentationVersion[];
  agentVersions: AgentDocumentationVersion[];
  current: {
    applicationVersion: ApplicationDocumentationVersion | null;
    agentVersions: AgentDocumentationVersion[];
  };
}

export interface ThreadLastMessage {
  id: string;
  content: string;
  senderId?: string | null;
  senderName: string;
  senderAvatarUrl?: string | null;
  createdAt: string;
}

export interface Thread {
  id: string;
  title: string;
  type: string;
  workspaceId: string;
  avatarUrl?: string | null;
  participantIds: string[];
  agentIds: string[];
  isPinned: boolean;
  isMuted: boolean;
  status: string;
  teamId?: string | null;
  departmentId?: string | null;
  lastMessage?: ThreadLastMessage | null;
  maxAgentTurns?: number | null;
  activeSessionId?: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  threadId: string;
  threadSessionId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  content: string;
  type: string;
  contentFormat?: MessageContentFormat;
  embeddedCard?: Record<string, unknown> | null;
  attachments: MessageAttachment[];
  isFromUser: boolean;
  isEdited: boolean;
  replyToId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export type MessageContentFormat = "markdown" | "html";
export type AgentResponsePresentation = "standard" | "html_native";

export type DocumentReferenceKind =
  | "workspace_file"
  | "memory_file"
  | "skill"
  | "workflow"
  | "library_doc"
  | "system_doc"
  | "web"
  | "artifact"
  | "unknown";

export type DocumentReferenceRole =
  | "knowledge"
  | "routing"
  | "rule"
  | "memory"
  | "evidence"
  | "artifact";

export type DocumentReferenceAction =
  | "consulted"
  | "read"
  | "routed_to"
  | "used"
  | "generated"
  | "modified";

export type DocumentReferenceSource =
  | "tool_call"
  | "tool_result"
  | "prompt_context"
  | "skill_router"
  | "workflow_router"
  | "agent_declared"
  | "parsed_markdown";

export type DocumentReferenceConfidence =
  | "observed"
  | "injected"
  | "inferred"
  | "agent_declared";

export interface DocumentReference {
  id?: string;
  kind: DocumentReferenceKind;
  title?: string;
  displayPath?: string;
  uri?: string;
  mimeType?: string;
  role?: DocumentReferenceRole;
  action?: DocumentReferenceAction;
  source?: DocumentReferenceSource;
  confidence?: DocumentReferenceConfidence;
  sensitive?: boolean;
  redacted?: boolean;
}

export interface MessageDocumentReferenceSummary {
  count?: number;
  hasSensitive?: boolean;
  redactedCount?: number;
}

export interface MessageDocumentReferenceMetadata {
  documentReferences?: DocumentReference[];
  referenceSummary?: MessageDocumentReferenceSummary;
}

const documentReferenceKinds = new Set<DocumentReferenceKind>([
  "workspace_file",
  "memory_file",
  "skill",
  "workflow",
  "library_doc",
  "system_doc",
  "web",
  "artifact",
  "unknown",
]);

const documentReferenceRoles = new Set<DocumentReferenceRole>([
  "knowledge",
  "routing",
  "rule",
  "memory",
  "evidence",
  "artifact",
]);

const documentReferenceActions = new Set<DocumentReferenceAction>([
  "consulted",
  "read",
  "routed_to",
  "used",
  "generated",
  "modified",
]);

const documentReferenceSources = new Set<DocumentReferenceSource>([
  "tool_call",
  "tool_result",
  "prompt_context",
  "skill_router",
  "workflow_router",
  "agent_declared",
  "parsed_markdown",
]);

const documentReferenceConfidences = new Set<DocumentReferenceConfidence>([
  "observed",
  "injected",
  "inferred",
  "agent_declared",
]);

function readOptionalString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

export function getMessageDocumentReferences(
  metadata?: Record<string, unknown> | null,
) {
  const rawReferences = metadata?.documentReferences;
  if (!Array.isArray(rawReferences)) return [];

  return rawReferences.flatMap((rawReference): DocumentReference[] => {
    if (
      !rawReference ||
      typeof rawReference !== "object" ||
      Array.isArray(rawReference)
    ) {
      return [];
    }

    const record = rawReference as Record<string, unknown>;
    const kind =
      typeof record.kind === "string" &&
      documentReferenceKinds.has(record.kind as DocumentReferenceKind)
        ? (record.kind as DocumentReferenceKind)
        : "unknown";
    const role =
      typeof record.role === "string" &&
      documentReferenceRoles.has(record.role as DocumentReferenceRole)
        ? (record.role as DocumentReferenceRole)
        : undefined;
    const action =
      typeof record.action === "string" &&
      documentReferenceActions.has(record.action as DocumentReferenceAction)
        ? (record.action as DocumentReferenceAction)
        : undefined;
    const source =
      typeof record.source === "string" &&
      documentReferenceSources.has(record.source as DocumentReferenceSource)
        ? (record.source as DocumentReferenceSource)
        : undefined;
    const confidence =
      typeof record.confidence === "string" &&
      documentReferenceConfidences.has(
        record.confidence as DocumentReferenceConfidence,
      )
        ? (record.confidence as DocumentReferenceConfidence)
        : undefined;

    return [
      {
        id: readOptionalString(record.id, 80),
        kind,
        title: readOptionalString(record.title, 120),
        displayPath: readOptionalString(record.displayPath, 240),
        uri: readOptionalString(record.uri, 500),
        mimeType: readOptionalString(record.mimeType, 120),
        role,
        action,
        source,
        confidence,
        sensitive: record.sensitive === true,
        redacted: record.redacted === true,
      },
    ];
  });
}

export type ThreadAnalyticsSenderKind = "user" | "agent" | "system";

export interface ThreadAnalyticsSenderStat {
  senderKey: string;
  senderId: string | null;
  senderName: string;
  senderKind: ThreadAnalyticsSenderKind;
  messageCount: number;
  shareOfMessages: number;
  firstMessageAt: string;
  lastMessageAt: string;
  sessionCount: number;
}

export interface ThreadAnalyticsActivePeriod {
  startedAt: string;
  endedAt: string;
  messageCount: number;
  uniqueSenderCount: number;
  durationMinutes: number;
}

export interface ThreadAnalyticsSessionStat {
  threadSessionId: string;
  sequenceNumber: number | null;
  status: string | null;
  startedAt: string | null;
  endedAt: string | null;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  agentMessageCount: number;
  requestingUserMessageCount: number;
  requestingUserFirstMessageAt: string | null;
  requestingUserLastMessageAt: string | null;
  medianMinutesSincePreviousMessage: number | null;
  medianMinutesSincePreviousAgentMessage: number | null;
  messagesAfterLongSilenceCount: number;
  messagesAfterAgentSilenceCount: number;
  requestingUserAnalysis: ThreadAnalyticsSessionUserAnalysis | null;
  agentRepeatAnalysisStatus: "ready" | "failed" | "not_run";
  agentRepeatAnalysisErrorMessage: string | null;
  repeatedAgentMessageCount: number;
  repeatedCrossAgentMessageCount: number;
  agentRepeatGroupCount: number;
  repeatedAgentMessageGroups: ThreadAnalyticsRepeatedAgentMessageGroup[];
}

export interface ThreadAnalyticsIntentCluster {
  label: string;
  description: string;
  messageCount: number;
  exampleMessages: string[];
}

export interface ThreadAnalyticsRepeatedAgentMessageGroup {
  representativeMessage: string;
  occurrenceCount: number;
  repeatedCount: number;
  senderCount: number;
  senderNames: string[];
  firstMessageAt: string;
  lastMessageAt: string;
}

export interface ThreadAnalyticsSessionUserAnalysis {
  status: "ready" | "failed";
  summary: string | null;
  timingInterpretation: string | null;
  repeatedPatterns: string[];
  oneOffIssues: string[];
  dominantIntentLabels: string[];
  repeatedInstructionShare: number | null;
  oneOffIssueShare: number | null;
  silencePromptShare: number | null;
  clusters: ThreadAnalyticsIntentCluster[];
  errorMessage: string | null;
}

export interface ThreadAnalytics {
  threadId: string;
  threadTitle: string;
  threadType: string;
  workspaceId: string;
  activityGapMinutes: number;
  totalMessages: number;
  totalSessions: number;
  totalSenders: number;
  userMessageCount: number;
  agentMessageCount: number;
  systemMessageCount: number;
  requestingUserMessageCount: number;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  elapsedMinutes: number;
  activeDurationMinutes: number;
  activePeriods: ThreadAnalyticsActivePeriod[];
  messageCountsBySender: ThreadAnalyticsSenderStat[];
  sessionBreakdown: ThreadAnalyticsSessionStat[];
}

export interface AgentWorkCalendarDay {
  date: string;
  minutesWorked: number;
  sessionCount: number;
  messageCount: number;
}

export interface AgentWorkCalendarAgent {
  agentId: string;
  agentName: string;
  groupType: string;
  groupLabel: string | null;
  departmentId: string | null;
  departmentName: string | null;
  days: AgentWorkCalendarDay[];
  totalMinutesWorked: number;
}

export interface AgentWorkCalendar {
  workspaceId: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  groupType: string | null;
  activityGapMinutes: number;
  days: string[];
  agents: AgentWorkCalendarAgent[];
}

export interface Approval {
  id: string;
  title: string;
  description: string;
  status: string;
  requestedByAgentId: string;
  taskId?: string | null;
  workspaceId: string;
  risk: string;
  steps: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  notes?: string | null;
  resolvedAt?: string | null;
  resolvedByUserId?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebSession {
  user: SessionUser;
  csrfToken: string;
}

export interface WsTicket {
  ticket: string;
  expiresIn: number;
}

export interface LogoutResult {
  success: boolean;
}

export interface MobileSessionSummary {
  id: string;
  deviceName?: string | null;
  platform?: string | null;
  revokedAt?: string | null;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  current?: boolean | null;
}

export interface WebSessionSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  lastSeenAt?: string | null;
  active: boolean;
}

export interface CreateMessageInput {
  content: string;
  type?: string;
  replyToId?: string;
  attachments?: MessageAttachment[];
  runtimeApprovalMode?: RuntimeApprovalMode;
  runtimeDispatchConfirmed?: boolean;
}

export type RuntimeApprovalMode =
  | "ask_for_approval"
  | "approve_for_me"
  | "full_access";

export type MessageAttachmentKind =
  | "image"
  | "audio"
  | "video"
  | "document"
  | "file";

export type MessageAttachmentStatus =
  | "uploaded"
  | "attached"
  | "missing"
  | "unavailable"
  | "failed";

export interface MessageAttachment {
  id: string;
  workspaceId?: string;
  threadId: string;
  messageId?: string | null;
  bridgeDeviceId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string;
  kind: MessageAttachmentKind;
  status: MessageAttachmentStatus;
  storage: "openclaw_local";
  localMediaRef: string;
  provenanceToken?: string;
  createdAt?: string;
}

export interface BeginOpenClawAttachmentUploadInput {
  threadId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: MessageAttachmentKind;
  totalChunks: number;
}

export interface BeginOpenClawAttachmentUploadResult {
  attachmentId: string;
  chunkSizeBytes: number;
  maxFileSizeBytes: number;
  maxFilesPerMessage: number;
}

export interface UploadOpenClawAttachmentChunkInput {
  threadId: string;
  attachmentId: string;
  chunkIndex: number;
  totalChunks: number;
  offsetBytes: number;
  chunkBase64: string;
}

export interface UploadOpenClawAttachmentChunkResult {
  attachmentId: string;
  chunkIndex: number;
  receivedBytes: number;
}

export interface CompleteOpenClawAttachmentUploadInput {
  threadId: string;
  attachmentId: string;
}

export interface ApprovalActionInput {
  notes?: string;
}

export interface Company {
  id: string;
  name: string;
  workspaceId: string;
  avatarUrl?: string | null;
  description?: string | null;
  industry?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  companyId: string;
  headAgentId?: string | null;
  description?: string | null;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: Company;
  teams?: Team[];
  teamCount?: number;
  agentCount?: number;
}

export interface Team {
  id: string;
  name: string;
  departmentId: string;
  leadAgentId?: string | null;
  description?: string | null;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
  department?: Department;
  agents?: Agent[];
  agentCount?: number;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  status: string;
  workspaceId?: string | null;
  externalId?: string | null;
  source?: string | null;
  lifecycleStatus?: AgentLifecycleStatus;
  lifecycleReason?: string | null;
  retiredAt?: string | null;
  deletionEligibleAt?: string | null;
  connectionId?: string | null;
  teamId?: string | null;
  departmentId?: string | null;
  companyId?: string | null;
  groupType?: string | null;
  groupLabel?: string | null;
  managerId?: string | null;
  description?: string | null;
  capabilities: string[];
  workingHoursMode: string;
  timezone: string;
  modelPrimary?: string | null;
  responsePresentation?: AgentResponsePresentation;
  provisioningStatus?: string | null;
  currentTaskId?: string | null;
  tasksCompletedToday: number;
  successRate: number;
  avgCompletionMinutes: number;
  totalMinutesWorked: number;
  budgetUsed: number;
  budgetLimit?: number | null;
  createdAt: string;
  updatedAt: string;
  team?: Team;
  runtimeBinding?: RuntimeBinding | null;
  runtimeType?: string | null;
  runtimeAvailability?:
    | "online"
    | "offline"
    | "queued"
    | "unavailable"
    | "revoked";
  executionAvailable?: boolean;
  executionUnavailableReason?:
    | "agent_inactive"
    | "identity_suppressed"
    | "binding_missing"
    | "binding_disabled"
    | "ownership_inactive"
    | "assignment_epoch_invalid"
    | "host_missing"
    | "host_inactive"
    | "host_stale"
    | null;
  runtimeDeviceId?: string | null;
  runtimeLastSeenAt?: string | null;
  executionOwnerKind?:
    | "relay_console_swift"
    | "external_bridge"
    | "managed"
    | null;
  runtimeHostId?: string | null;
  assignmentEpoch?: string | null;
  ownershipState?: RuntimeOwnershipState | null;
}

export interface RuntimeHost {
  id: string;
  workspaceId: string;
  displayName: string;
  hostKind: string;
  platform?: string | null;
  status: RuntimeHostStatus;
  bridgeDeviceId?: string | null;
  clientInstallationId?: string | null;
  managedRuntimeId?: string | null;
  softwareVersion?: string | null;
  protocolVersion?: string | null;
  supportedRuntimes: string[];
  capabilities: Record<string, unknown>;
  lastSeenAt?: string | null;
  retiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeObservation {
  id: string;
  workspaceId: string;
  agentId?: string | null;
  runtimeHostId: string;
  runtimeType: string;
  externalAgentId: string;
  status: RuntimeObservationStatus;
  connectionState:
    | "discovered"
    | "connection_pending"
    | "connected"
    | "disconnect_pending"
    | "disconnected"
    | "unavailable"
    | "quarantined";
  origin: "customer_existing" | "relay_created" | "legacy_unknown";
  manifestHash?: string | null;
  displayMetadata: Record<string, unknown>;
  capabilitySnapshot: Record<string, unknown>;
  compatibilityStatus: string;
  compatibilityReason?: string | null;
  inventoryGeneration?: string | null;
  observedState: Record<string, unknown>;
  quarantineReason?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  lastScannedAt?: string | null;
  connectedAt?: string | null;
  disconnectedAt?: string | null;
  documentConsentVersion?: number | null;
  isDismissed?: boolean;
}

export interface RuntimeProvisioningTarget {
  id: string;
  workspaceId: string;
  runtimeType: "hermes" | "openclaw";
  runtimeHostId?: string | null;
  status: "active" | "needs_review" | "unavailable" | "revoked";
  selectionSource:
    | "initial_connection"
    | "sole_eligible_host"
    | "administrator"
    | "legacy_backfill";
  selectedByUserId?: string | null;
  lastValidatedAt?: string | null;
  statusReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentIdentitySuppression {
  id: string;
  workspaceId: string;
  runtimeType: string;
  externalAgentId: string;
  runtimeHostId?: string | null;
  scope: "all_hosts" | "specific_host";
  reason: string;
  retiredAt?: string | null;
  liftedAt?: string | null;
}

export interface RuntimeAuthoritySnapshot {
  hosts: RuntimeHost[];
  observations: RuntimeObservation[];
  suppressions: AgentIdentitySuppression[];
  bindings: RuntimeBinding[];
}

export interface ActivateReviewedRuntimeObservationRequest {
  canonicalAgentId: string;
  expectedRuntimeHostId: string;
  expectedRuntimeType: string;
  expectedExternalAgentId: string;
}

export interface ManagedRuntime {
  id: string;
  workspaceId: string;
  agentId?: string | null;
  runtimeHostId?: string | null;
  runtimeType: "hermes";
  status: string;
  ownershipType: "relay_managed";
  region?: string | null;
  storageQuotaBytes: string;
  storageUsedBytes: string;
  modelAuthorizationStatus?: string | null;
  lastHealthyAt?: string | null;
  suspendedAt?: string | null;
  retentionEndsAt?: string | null;
  deletedAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeMigration {
  id: string;
  workspaceId: string;
  agentId: string;
  operationKey: string;
  runtimeType: "hermes" | "openclaw";
  sourceRuntimeHostId: string;
  destinationRuntimeHostId: string;
  sourceObservationId?: string | null;
  destinationObservationId?: string | null;
  status: string;
  sourceAssignmentEpoch?: string | null;
  destinationAssignmentEpoch?: string | null;
  manifestHash?: string | null;
  credentialsReauthorizationRequired: boolean;
  validationChecks: unknown[];
  lastError?: string | null;
  switchedAt?: string | null;
  completedAt?: string | null;
  rolledBackAt?: string | null;
}

export type RuntimeMigrationCategory =
  | "identity"
  | "configuration"
  | "memory"
  | "skills"
  | "tasks"
  | "history"
  | "artifactIndex";

export interface RuntimeMigrationManifest {
  schemaVersion: "relay-runtime-migration.v1";
  selectedCategories: RuntimeMigrationCategory[];
  payload: Partial<Record<RuntimeMigrationCategory, unknown>>;
}

export interface RelayRemediationOperation {
  id: string;
  workspaceId: string;
  operationKey: string;
  status:
    | "inventoried"
    | "dry_run_verified"
    | "applied"
    | "rolled_back"
    | "failed";
  backupReference?: string | null;
  inventoryChecksum?: string | null;
  dryRunChecksum?: string | null;
  beforeCounts: Record<string, number>;
  afterCounts: Record<string, number>;
  report: Record<string, unknown>;
  appliedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RelayRemediationManifest {
  version: "relay-workspace-remediation.v1";
  backupReference: string;
  backupEvidence: {
    provider: "railway_postgresql" | "encrypted_export";
    backupId: string;
    createdAt: string;
    verifiedAt: string;
    inventoryChecksum: string;
    restoreRehearsalReference?: string | null;
  };
  retireAgentIds?: string[];
  quarantineAgentIds?: string[];
  unbindAgentIds?: string[];
  archiveThreadIds?: string[];
  tombstoneDocumentIds?: string[];
  quarantineObservationIds?: string[];
  activateObservationIds?: string[];
  hardDeleteAgentIds?: string[];
  suppressions?: Array<{
    runtimeType: string;
    externalAgentId: string;
    runtimeHostId?: string | null;
    reason: string;
  }>;
  ownershipAssignments?: Array<{
    agentId: string;
    runtimeHostId: string;
    runtimeType: string;
    externalAgentId: string;
    keepExecutionDisabledUntilVerified?: boolean;
  }>;
  exactAgents?: Array<{
    id: string;
    name: string;
    externalId?: string | null;
  }>;
  documentAssertions?: Array<{
    agentId: string;
    legitimateDocumentIds: string[];
    legacyDocumentIds: string[];
    expectedLegitimateCount: number;
    expectedLegacyCount: number;
  }>;
  swiftInventory?: {
    installationId: string;
    rows: Array<{
      localAgentId: string;
      canonicalAgentId?: string | null;
      runtimeType: string;
      externalAgentId?: string | null;
    }>;
  };
}

export interface RuntimeReconciliationReport {
  version: "runtime-reconciliation.v1";
  workspaceId: string;
  generatedAt: string;
  checksum: string;
  counts: Record<string, number>;
  issues: Array<{
    code: string;
    severity: "info" | "warning" | "error";
    agentId?: string | null;
    runtimeHostId?: string | null;
    observationId?: string | null;
    documentId?: string | null;
    detail: Record<string, unknown>;
    safeRepair?: string | null;
  }>;
}

export interface RelayDeploymentCapabilities {
  deploymentId: string;
  deploymentKey: string;
  displayName: string;
  ownershipType: string;
  apiVersion: string;
  syncContractVersion: string;
  runtimeHostContractVersion?: string;
  supportedRuntimeHostContractVersions?: string[];
  runtimeContractVersion: string;
  marketplaceContractVersion: string;
  origins: { api: string; websocket: string };
  features: Record<string, unknown>;
  limits: {
    importBatchRecords: number;
    mutationBatchRecords: number;
    attachmentBytes: number;
  };
}

export interface RelayWorkspaceChange {
  id: string;
  workspaceId: string;
  sequence: string;
  changeType: "upsert" | "tombstone" | "access_revoked";
  objectType: string;
  objectId: string;
  serverVersion: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface RelayWorkspaceChangePage {
  changes: RelayWorkspaceChange[];
  cursor: string;
  hasMore: boolean;
}

export interface RelayMutationOutcome {
  clientMutationId: string;
  status: "acknowledged" | "conflict" | "rejected";
  duplicate?: boolean;
  canonicalObjectId?: string | null;
  serverVersion?: string;
  changeSequence?: string;
  code?: string;
}

export type RuntimeType = "openclaw" | "claude_code" | "hermes";
export const RUNTIME_STRUCTURED_JOB_CAPABILITY =
  "clawchat.runtime.structured_jobs";
export const RUNTIME_STRUCTURED_OUTPUT_CAPABILITY =
  "clawchat.runtime.structured_output";

export type RuntimeStructuredJobType =
  | "thread_wrap_up_report"
  | "condensed_team_chat_message"
  | "cron_inventory";

export interface RuntimeBinding {
  id: string;
  workspaceId: string;
  agentId: string;
  runtimeType: RuntimeType;
  runtimeHostId?: string | null;
  runtimeExternalAgentId?: string | null;
  assignmentEpoch?: string;
  ownershipState?: RuntimeOwnershipState;
  assignedAt?: string | null;
  lastConfirmedAt?: string | null;
  previousRuntimeHostId?: string | null;
  adapterKind: string;
  routingMode: string;
  workspaceRoot?: string | null;
  repoKey?: string | null;
  isEnabled: boolean;
  healthStatus: string;
  lastHealthCheckAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  capabilities: Record<string, unknown>;
  configMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeBindingInput {
  runtimeType: RuntimeType;
  adapterKind?: string;
  routingMode?: string;
  repoKey?: string | null;
  isEnabled?: boolean;
  capabilities?: Record<string, unknown>;
  configMetadata?: Record<string, unknown>;
}

export interface RuntimeThreadSession {
  id: string;
  workspaceId: string;
  threadId: string;
  threadSessionId: string;
  agentId: string;
  runtimeBindingId: string;
  runtimeSessionId: string;
  status: string;
  lastDispatchedMessageId?: string | null;
  lastRunStartedAt?: string | null;
  lastRunFinishedAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  lastActivityAt: string;
  closedAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeDispatch {
  id: string;
  workspaceId: string;
  threadId: string;
  threadSessionId: string;
  messageId: string;
  agentId: string;
  runtimeBindingId: string;
  runtimeThreadSessionId: string;
  dispatchKey: string;
  status: string;
  attemptNumber: number;
  startedAt?: string | null;
  completedAt?: string | null;
  timeoutAt?: string | null;
  postedMessageId?: string | null;
  runtimeRunId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  resultSummary?: string | null;
  resultMetadata: Record<string, unknown>;
  correlationId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeStructuredJobDispatch {
  jobId: string;
  workspaceId: string;
  jobType: RuntimeStructuredJobType;
  agentId: string;
  externalAgentId: string;
  runtimeType: "openclaw" | "hermes";
  prompt: string;
  schema: Record<string, unknown>;
  input: Record<string, unknown>;
  model?: string | null;
  timeoutMs: number;
  correlationId?: string | null;
  metadata: Record<string, unknown>;
}

export interface RuntimeStructuredJobResult {
  jobId: string;
  output: Record<string, unknown> | string;
  model?: string | null;
  usage?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface RuntimeStructuredJobError {
  jobId: string;
  code: string;
  message: string;
  retryable: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface RuntimeDispatchEventPayload {
  workspaceId: string;
  threadId: string;
  threadSessionId: string;
  dispatchId: string;
  messageId?: string | null;
  agentId: string;
  runtimeType: RuntimeType | string;
  runtimeBindingId: string;
  runtimeThreadSessionId: string;
  timestamp: string;
  draftText?: string | null;
  draftSeq?: number | null;
}

export interface RuntimeDispatchCancelResult {
  cancelled: boolean;
  dispatchId: string;
}

export interface RuntimeDispatchCompletedPayload extends RuntimeDispatchEventPayload {
  postedMessageId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RuntimeDispatchFailedPayload extends RuntimeDispatchEventPayload {
  code: string;
  message: string;
  retryable: boolean;
}

export interface RuntimeRunDeltaPayload extends RuntimeDispatchEventPayload {
  seq: number;
  text: string;
}

export interface RuntimeRunStatusPayload extends RuntimeDispatchEventPayload {
  code: string;
  message: string;
}

export type RuntimeTodoTaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface RuntimeTodoTask {
  id: string;
  content: string;
  status: RuntimeTodoTaskStatus;
}

export interface RuntimeRunToolPayload extends RuntimeDispatchEventPayload {
  toolName: string;
  phase: "started" | "updated" | "completed";
  summary?: string;
  tasks?: RuntimeTodoTask[];
  references?: RuntimeRunContextPayload["references"];
}

export interface RuntimeRunThinkingPayload extends RuntimeDispatchEventPayload {
  seq: number;
  thinking: string;
  kind?: "thinking" | "reasoning";
}

export interface RuntimeRunContextPayload extends RuntimeDispatchEventPayload {
  totalTokens: number | null;
  contextTokens: number | null;
  percentUsed: number | null;
  level: "unknown" | "ok" | "warn" | "critical" | "overflow";
  fresh: boolean;
  sessionId?: string;
  model?: string;
  modelProvider?: string;
  references?: Array<{
    uri: string;
    title?: string | null;
    kind?: string | null;
    source?: string | null;
  }>;
}

export interface RuntimeParticipantHealthPayload {
  workspaceId: string;
  threadId?: string | null;
  agentId: string;
  runtimeType: RuntimeType | string;
  status: string;
  message?: string | null;
  timestamp: string;
}

export type AgentOpsLiveRealState =
  | "offline"
  | "idle"
  | "queued"
  | "working"
  | "thinking"
  | "tooling"
  | "waiting_for_approval"
  | "error"
  | "completed"
  | "cancelled";

export type AgentOpsLiveConfidence = "strong" | "medium" | "weak";

export type AgentOpsLiveSource =
  | "runtime_dispatch"
  | "runtime_tool"
  | "runtime_thinking"
  | "task"
  | "approval"
  | "health"
  | "message"
  | "agent_status"
  | "none";

export interface AgentOpsLiveAgentState {
  agentId: string;
  realState: AgentOpsLiveRealState;
  confidence: AgentOpsLiveConfidence;
  source: AgentOpsLiveSource;
  reason: string;
  updatedAt: string;
  expiresAt?: string | null;
  threadId?: string | null;
  threadSessionId?: string | null;
  dispatchId?: string | null;
  taskId?: string | null;
  approvalId?: string | null;
  messageId?: string | null;
  runtimeType?: string | null;
  healthStatus?: string | null;
  toolName?: string | null;
  toolPhase?: "started" | "updated" | "completed" | null;
  appId?: string | null;
  workflowId?: string | null;
  departmentId?: string | null;
  roomId?: string | null;
  contextText?: string | null;
}

export interface AgentOpsLiveStateSnapshot {
  workspaceId: string;
  generatedAt: string;
  agents: AgentOpsLiveAgentState[];
}

export interface AgentOpsRuntimeOverviewBinding {
  id: string;
  workspaceId: string;
  agentId: string;
  agentName: string | null;
  runtimeType: RuntimeType | string;
  adapterKind: string;
  routingMode: string;
  workspaceRoot: string | null;
  repoKey: string | null;
  isEnabled: boolean;
  healthStatus: string;
  lastHealthCheckAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  capabilities: Record<string, unknown>;
  capabilityKeys: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentOpsRuntimeOverviewSession {
  id: string;
  workspaceId: string;
  threadId: string;
  threadTitle: string | null;
  threadSessionId: string;
  agentId: string;
  agentName: string | null;
  runtimeBindingId: string;
  runtimeType: RuntimeType | string | null;
  runtimeSessionId: string;
  status: string;
  lastDispatchedMessageId: string | null;
  lastRunStartedAt: string | null;
  lastRunFinishedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastActivityAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentOpsRuntimeOverviewDispatch {
  id: string;
  workspaceId: string;
  threadId: string;
  threadTitle: string | null;
  threadSessionId: string;
  messageId: string;
  agentId: string;
  agentName: string | null;
  runtimeBindingId: string;
  runtimeThreadSessionId: string;
  runtimeType: RuntimeType | string | null;
  status: string;
  attemptNumber: number;
  startedAt: string | null;
  completedAt: string | null;
  timeoutAt: string | null;
  postedMessageId: string | null;
  runtimeRunId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  failureBucket: string | null;
  resultSummary: string | null;
  latestStatusCode: string | null;
  latestToolName: string | null;
  latestToolPhase: string | null;
  contextUsageLevel: string | null;
  contextPercentUsed: number | null;
  correlationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentOpsRuntimeTypeSummary {
  runtimeType: RuntimeType | string;
  bindingCount: number;
  enabledBindingCount: number;
  healthyBindingCount: number;
  unhealthyBindingCount: number;
  activeSessionCount: number;
  activeDispatchCount: number;
  terminalDispatchCount: number;
  failedDispatchCount: number;
}

export interface AgentOpsRuntimeHealthSummary {
  status: string;
  count: number;
}

export interface AgentOpsRuntimeTerminalStateSummary {
  runtimeType: RuntimeType | string;
  status: string;
  count: number;
}

export interface AgentOpsRuntimeFailureBucket {
  runtimeType: RuntimeType | string;
  errorCode: string;
  count: number;
  latestAt: string;
  sampleDispatchId: string;
  sampleAgentId: string;
  sampleThreadId: string;
  sampleMessage: string | null;
}

export interface AgentOpsRuntimeOverviewSnapshot {
  workspaceId: string;
  generatedAt: string;
  windowHours: number;
  limits: {
    dispatches: number;
    sessions: number;
    summaryDispatches: number;
  };
  bindings: AgentOpsRuntimeOverviewBinding[];
  activeSessions: AgentOpsRuntimeOverviewSession[];
  recentDispatches: AgentOpsRuntimeOverviewDispatch[];
  summaries: {
    runtimeTypes: AgentOpsRuntimeTypeSummary[];
    health: AgentOpsRuntimeHealthSummary[];
    terminalStates: AgentOpsRuntimeTerminalStateSummary[];
    failureBuckets: AgentOpsRuntimeFailureBucket[];
  };
}

export type TaskTargetType =
  | "direct"
  | "team"
  | "department"
  | "company_meeting"
  | "agent_to_agent";

export type TaskStatus =
  | "queued"
  | "dispatched"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled";

export type TaskRecurrenceRule =
  | "none"
  | "every_15_minutes"
  | "every_30_minutes"
  | "every_45_minutes"
  | "hourly"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly";

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: string;
  assignedAgentId?: string | null;
  teamId?: string | null;
  departmentId?: string | null;
  targetType: TaskTargetType;
  threadId?: string | null;
  targetAgentId?: string | null;
  targetAgentTwoId?: string | null;
  workspaceId: string;
  createdByUserId?: string | null;
  createdByAgentId?: string | null;
  dueAt?: string | null;
  scheduledFor?: string | null;
  nextRunAt?: string | null;
  timezone: string;
  recurrenceRule?: TaskRecurrenceRule | null;
  completedAt?: string | null;
  tags?: string[] | null;
  budgetUsed: number;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  runCount: number;
  lastRunAt?: string | null;
  messageBody?: string | null;
  scheduledMessageId?: string | null;
  dispatchedMessageId?: string | null;
  lastDispatchedAt?: string | null;
  lastError?: string | null;
  cancelledAt?: string | null;
  requiresApproval: boolean;
  approvalId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  type: string;
  severity: string;
  workspaceId: string;
  agentId?: string | null;
  taskId?: string | null;
  isRead: boolean;
  expiresAt?: string | null;
  createdAt: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  agentId?: string | null;
  teamId?: string | null;
  workspaceId: string;
  taskId?: string | null;
  runId?: string | null;
  tags?: string[] | null;
  affectedSystems?: string[] | null;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportSnapshot {
  id: string;
  title: string;
  type: string;
  workspaceId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface ThreadWrapUpReport {
  id: string;
  threadId: string;
  threadSessionId: string;
  threadSessionSequenceNumber: number;
  workspaceId: string;
  teamId?: string | null;
  title: string;
  fileName: string;
  provider: string;
  model: string;
  status?: "generating" | "completed" | "failed" | string;
  errorMessage?: string | null;
  completedAt?: string | null;
  markdown: string;
  structuredData: Record<string, unknown>;
  messageCount: number;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThreadWrapUpResult {
  threadId: string;
  status: string;
  activeSessionId?: string | null;
  report: ThreadWrapUpReport;
}

export interface ShiftRule {
  id: string;
  scheduleId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  id: string;
  agentId?: string | null;
  teamId?: string | null;
  departmentId?: string | null;
  mode: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  shifts?: ShiftRule[];
}

export interface AvailabilityState {
  id: string;
  agentId: string;
  status: string;
  reason?: string | null;
  since: string;
  until?: string | null;
  setByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentPerformanceMetric {
  id: string;
  agentId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  tasksCompleted: number;
  tasksFailed: number;
  tasksRetried: number;
  successRate: number;
  avgCompletionMinutes: number;
  totalMinutesWorked: number;
  tokensUsed: number;
  cost: number;
  qualityScore?: number | null;
  incidentCount: number;
  approvalCount: number;
  createdAt: string;
}

export interface WorkLog {
  id: string;
  agentId: string;
  taskId?: string | null;
  runId?: string | null;
  action: string;
  details: string;
  timestamp: string;
  durationMinutes?: number | null;
  metadata: Record<string, unknown>;
}

export interface Review {
  id: string;
  agentId: string;
  reviewerId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  overallRating: number;
  summary: string;
  strengths: Array<Record<string, unknown>>;
  improvements: Array<Record<string, unknown>>;
  createdAt: string;
}

export interface Run {
  id: string;
  taskId: string;
  agentId: string;
  status: string;
  startedAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
  eventsCount: number;
  tokensUsed: number;
  cost: number;
  createdAt: string;
}

export interface RunEvent {
  id: string;
  runId: string;
  type: string;
  content: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface PermissionPolicy {
  id: string;
  name: string;
  workspaceId: string;
  scope: string;
  scopeId?: string | null;
  permissions: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemoryItem {
  id: string;
  teamId: string;
  title: string;
  content: string;
  type: string;
  tags: string[];
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HandoverNote {
  id: string;
  fromAgentId: string;
  toAgentId?: string | null;
  toTeamId?: string | null;
  content: string;
  taskIds: string[];
  createdAt: string;
  acknowledgedAt?: string | null;
}

export interface OpenClawConnection {
  id: string;
  workspaceId: string;
  instanceUrl: string;
  status: string;
  lastConnectedAt?: string | null;
  lastEventAt?: string | null;
  agentsSynced: number;
  useMockMode: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PaperclipConnectionStatus =
  | "unverified"
  | "ready"
  | "unauthorized"
  | "unreachable"
  | "error";

export interface PaperclipConnection {
  id: string;
  workspaceId: string;
  displayName: string;
  baseUrl: string;
  companyId: string;
  companyName?: string | null;
  authType: "bearer_token";
  status: PaperclipConnectionStatus;
  lastValidatedAt?: string | null;
  lastSuccessAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaperclipConnectionInput {
  displayName: string;
  baseUrl: string;
  companyId: string;
  bearerToken: string;
}

export interface UpdatePaperclipConnectionInput {
  displayName?: string;
  baseUrl?: string;
  companyId?: string;
  bearerToken?: string;
}

export interface PaperclipConnectionTestResult {
  ok: boolean;
  connection: PaperclipConnection;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface PaperclipIssueSummary {
  kind: "issue";
  id: string;
  identifier?: string | null;
  title: string;
  status: string;
  priority?: string | null;
  assigneeAgentId?: string | null;
  projectName?: string | null;
  updatedAt: string;
  deepLinkUrl: string;
  companyId?: string | null;
}

export interface PaperclipApprovalSummary {
  kind: "approval";
  id: string;
  title: string;
  approvalType: string;
  status: string;
  requestedByAgentId?: string | null;
  decisionNote?: string | null;
  linkedIssueCount: number;
  decidedAt?: string | null;
  updatedAt: string;
  deepLinkUrl: string;
  companyId?: string | null;
}

export type PaperclipLinkedObjectSummary =
  | PaperclipIssueSummary
  | PaperclipApprovalSummary;

export interface PaperclipThreadLink {
  id: string;
  workspaceId: string;
  threadId: string;
  connectionId: string;
  objectType: "issue" | "approval";
  paperclipObjectId: string;
  paperclipObjectRef?: string | null;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export type PaperclipLinkFetchState =
  | "unlinked"
  | "ok"
  | "unauthorized"
  | "unavailable"
  | "object_not_found"
  | "error";

export interface ThreadPaperclipLinkView {
  link?: PaperclipThreadLink | null;
  connection?: PaperclipConnection | null;
  objectSummary?: PaperclipLinkedObjectSummary | null;
  fetchState: PaperclipLinkFetchState;
  errorCode?: string | null;
  errorMessage?: string | null;
  fetchedAt?: string | null;
}

export interface PutThreadPaperclipLinkInput {
  connectionId: string;
  objectType: "issue" | "approval";
  objectRef: string;
}

export type OpenClawIntegrationStatusCode =
  | "not_configured"
  | "connected"
  | "needs_attention"
  | "offline";

export interface OpenClawIntegrationStatus {
  provider: "openclaw";
  status: OpenClawIntegrationStatusCode;
  title: string;
  description: string;
  isConfigured: boolean;
  isOnline: boolean;
  hasLiveAgents: boolean;
  isChatRoutable: boolean;
  needsAttention: boolean;
  connectionCount: number;
  pairedDeviceCount: number;
  onlineDeviceCount: number;
  liveBridgeControlCount: number;
  mappedAgentCount: number;
  liveAgentCount: number;
}

export interface BridgeEnrollment {
  id: string;
  workspaceId: string;
  workspaceName: string;
  code: string;
  deviceLabel?: string | null;
  expiresAt: string;
  status: string;
}

export interface BridgeDevice {
  id: string;
  workspaceId: string;
  label: string;
  devicePublicId: string;
  status: string;
  capabilities: string[];
  openCoreVersion?: string | null;
  pluginVersion?: string | null;
  runtimeType?: "hermes" | "openclaw" | null;
  hostType?: "macos-launchd" | "linux-systemd" | null;
  health?: "online" | "offline" | "revoked";
  compatibility?: {
    compatible: boolean;
    code: string | null;
    release: string;
    releaseStatus: string;
  };
  credentialVersion?: number;
  credentialRotatedAt?: string | null;
  lastSeenAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityMetrics {
  windowHours: number;
  authFailures: number;
  bridgeEnrollmentFailures: number;
  websocketDisconnects: number;
  crossWorkspaceAccessAttempts: number;
  auditEvents: number;
}

export interface OrgChart {
  companies: Company[];
  departments: Department[];
  teams: Team[];
  agents: Agent[];
  managerRelationships: Array<{
    id: string;
    managerId: string;
    reportId: string;
    createdAt: string;
  }>;
}

export interface CapacityEntry {
  agentId: string;
  agentName: string;
  status: string;
  currentLoad: number;
  maxLoad: number;
  availableCapacity: number;
  budgetUsed: number;
  budgetLimit?: number | null;
}

export interface CapacitySuggestion {
  overloadedAgentId: string;
  suggestedAgentId: string;
  reason: string;
}

export interface TeamDashboard {
  team: Team;
  agents: Agent[];
  runningTasks: Task[];
  blockedTasks: Task[];
  pendingApprovals: Approval[];
  recentIncidents: Incident[];
  recentHandovers: HandoverNote[];
  performanceSummary: {
    tasksCompleted: number;
    tasksFailed: number;
    totalMinutesWorked: number;
  };
}

export interface DepartmentDashboard {
  department: Department;
  teams: Team[];
  runningTasks: Task[];
  blockedTasks: Task[];
  pendingApprovals: Approval[];
  openIncidents: Incident[];
}

export interface CreateWorkspaceInput {
  name: string;
  type?: "personal" | "business";
  description?: string;
  avatarUrl?: string;
}

export interface CreateThreadInput {
  title: string;
  workspaceId?: string;
  type: string;
  participantIds?: string[];
  agentIds?: string[];
  teamId?: string;
  departmentId?: string;
  avatarUrl?: string;
}

export interface CreateAgentInput {
  name: string;
  workspaceId: string;
  role: string;
  source?: string;
  externalId?: string | null;
  teamId?: string | null;
  departmentId?: string | null;
  companyId?: string | null;
  groupType?: string | null;
  groupLabel?: string | null;
  description?: string;
  avatarUrl?: string;
  capabilities?: string[];
  workingHoursMode?: string;
  timezone?: string;
  modelPrimary?: string | null;
  responsePresentation?: AgentResponsePresentation;
  budgetLimit?: number;
  runtimeBinding?: RuntimeBindingInput | null;
}

export interface AgentWorkspaceFileInput {
  filename: string;
  content: string;
  isDefault?: boolean;
  source?: string;
}

export interface CreateProvisionedAgentInput {
  name: string;
  workspaceId: string;
  role: string;
  slug?: string;
  avatarUrl?: string;
  teamId?: string | null;
  departmentId?: string | null;
  companyId?: string | null;
  groupType?: string | null;
  groupLabel?: string | null;
  description?: string;
  modelPrimary?: string;
  responsePresentation?: AgentResponsePresentation;
  connectionId?: string | null;
  idempotencyKey?: string;
  files: AgentWorkspaceFileInput[];
}

export interface AgentProvisioningJob {
  id: string;
  workspaceId: string;
  requestedByUserId?: string | null;
  name: string;
  slug: string;
  role: string;
  connectionId?: string | null;
  runtimeType?: "hermes" | "openclaw" | null;
  runtimeHostId?: string | null;
  targetResolutionSource?: string | null;
  idempotencyKey: string;
  createdAgentId?: string | null;
  externalAgentId?: string | null;
  status: string;
  stage: string;
  message?: string | null;
  error?: string | null;
  payload: Record<string, unknown>;
  files: Array<Record<string, unknown>>;
  completedAt?: string | null;
  dispatchedAt?: string | null;
  acknowledgedAt?: string | null;
  nativeCreatedAt?: string | null;
  failedAt?: string | null;
  errorCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SetAgentStatusInput {
  status: string;
  reason?: string;
  durationMinutes?: number;
}

export interface UpdateAgentScheduleInput {
  mode: string;
  timezone?: string;
  shifts?: Array<{
    day: number;
    startHour: number;
    startMinute?: number;
    endHour: number;
    endMinute?: number;
  }>;
}

export interface CreateTaskInput {
  title: string;
  workspaceId: string;
  description?: string;
  status?: TaskStatus;
  priority?: string;
  assignedAgentId?: string;
  teamId?: string;
  departmentId?: string;
  targetType: TaskTargetType;
  threadId?: string;
  targetAgentId?: string;
  targetAgentTwoId?: string;
  messageBody: string;
  createdByAgentId?: string;
  dueAt?: string;
  scheduledFor?: string;
  timezone?: string;
  recurrenceRule?: TaskRecurrenceRule;
  tags?: string[];
  estimatedMinutes?: number;
  budgetUsed?: number;
  requiresApproval?: boolean;
  meetingId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: string;
  assignedAgentId?: string | null;
  teamId?: string | null;
  departmentId?: string | null;
  targetType?: TaskTargetType;
  threadId?: string | null;
  targetAgentId?: string | null;
  targetAgentTwoId?: string | null;
  messageBody?: string;
  dueAt?: string | null;
  scheduledFor?: string | null;
  timezone?: string;
  recurrenceRule?: TaskRecurrenceRule;
  requiresApproval?: boolean;
}

export interface CreateIncidentInput {
  title: string;
  description: string;
  workspaceId: string;
  severity?: string;
  teamId?: string;
  agentId?: string;
  taskId?: string;
  tags?: string[];
  affectedSystems?: string[];
}

export interface ResolveIncidentInput {
  notes?: string;
}

export interface CreateCompanyInput {
  name: string;
  workspaceId: string;
  description?: string;
  industry?: string;
  avatarUrl?: string;
}

export interface CreateDepartmentInput {
  name: string;
  workspaceId?: string;
  companyId?: string;
  description?: string;
  color?: string;
  headAgentId?: string | null;
}

export interface CreateTeamInput {
  name: string;
  departmentId: string;
  description?: string;
  color?: string;
  leadAgentId?: string | null;
}

export interface CreateConnectionInput {
  workspaceId: string;
  instanceUrl: string;
  apiKey?: string;
  useMockMode?: boolean;
}

export interface CreatePermissionPolicyInput {
  name: string;
  workspaceId: string;
  scope?: string;
  scopeId?: string;
  permissions?: Array<Record<string, unknown>>;
}

export interface LibraryFileInput {
  filename: string;
  content: string;
  contentEncoding?: "utf8" | "base64";
  contentType?: string;
}

export interface CreateLibraryFolderInput {
  folder: string;
}

export interface WriteLibraryFilesInput {
  folder: string;
  files: LibraryFileInput[];
}

export interface DeleteLibraryFileInput {
  folder?: string;
  filename: string;
}

export interface DeleteLibraryFolderInput {
  folder: string;
}

export type HermesWorkspaceFolder = "agent" | "shared" | "sessions" | "project";

export interface HermesWorkspaceWriteFileInput {
  filename: string;
  content: string;
  encoding?: "utf8" | "base64";
}

export interface HermesWorkspaceWriteFilesInput {
  agentId: string;
  folder: HermesWorkspaceFolder;
  path?: string;
  files: HermesWorkspaceWriteFileInput[];
}

export interface HermesWorkspaceDeleteFileInput {
  agentId: string;
  folder: HermesWorkspaceFolder;
  path?: string;
  filename: string;
}

export interface HermesWorkspaceCreateFolderInput {
  agentId: string;
  folder: HermesWorkspaceFolder;
  path?: string;
  filename: string;
}

export interface LibraryDeleteFolderResult {
  folder: string;
  deleted: boolean;
}

export interface LibraryFolderEntry {
  name: string;
  path: string;
}

export interface LibraryFileEntry {
  filename: string;
  path: string;
  size: number;
  updatedAt?: string | null;
  documentId?: string;
  documentKind?: string;
  desiredVersion?: string;
  appliedVersion?: string;
  syncState?: ManagedDocumentSyncState;
  runtimeHostId?: string | null;
  lastObservedAt?: string | null;
  tombstoned?: boolean;
}

export interface LibraryListResult {
  folder: string;
  folders: LibraryFolderEntry[];
  files: LibraryFileEntry[];
}

export interface LibraryReadResult {
  folder: string;
  filename: string;
  content: string;
  size: number;
  updatedAt?: string | null;
  serverVersion?: string;
  documentId?: string;
  documentKind?: string;
  desiredVersion?: string;
  appliedVersion?: string;
  syncState?: ManagedDocumentSyncState;
  runtimeHostId?: string | null;
  lastObservedAt?: string | null;
}

export interface LibraryWriteResult {
  folder: string;
  written: string[];
  createdFolder: boolean;
}

export interface LibraryDeleteResult {
  folder: string;
  filename: string;
  deleted: boolean;
}

export type WorkspaceArtifactKind =
  | "document"
  | "image"
  | "video"
  | "audio"
  | "data"
  | "folder"
  | "unknown";

export type WorkspaceArtifactPresentationState =
  | "available"
  | "unavailable"
  | "moved"
  | "expired"
  | "deleted"
  | "permission_denied";

export interface WorkspaceArtifact {
  id: string;
  sourceArtifactId: string;
  title: string;
  kind: WorkspaceArtifactKind;
  sourceKind: string;
  relativePath: string;
  filename: string;
  fileExtension?: string | null;
  byteCount?: number | null;
  updatedAt?: string | null;
  agentId?: string | null;
  taskId?: string | null;
  agentName?: string | null;
  agentAvatarUrl?: string | null;
  cronJobId?: string | null;
  cronJobName?: string | null;
  isReadableText: boolean;
  harnessId?: string | null;
  harnessType?: string | null;
  harnessLabel?: string | null;
  contentHash?: string | null;
  externalUrl?: string | null;
  externalProvider?: string | null;
  sourceIdentityKind: "client_installation" | "bridge_device";
  sourceIdentityId: string;
  sourceMachineId: string;
  sourceMachineLabel: string;
  sourcePlatform: "macos" | "windows" | "linux" | "unknown";
  runtimeHostId?: string | null;
  sourceHealth: "online" | "offline" | "revoked" | "external";
  sourceLastSeenAt?: string | null;
  presentationState: WorkspaceArtifactPresentationState;
  presentationReason?: string | null;
  cloudContentAvailable: false;
  storageLocation: "source_machine";
  syncedAt: string;
}

export interface WorkspaceArtifactListResult {
  artifacts: WorkspaceArtifact[];
  refreshedAt: string;
}

export interface WorkspaceArtifactSyncItem {
  id: string;
  title: string;
  kind: WorkspaceArtifactKind;
  sourceKind: string;
  relativePath: string;
  fileExtension?: string | null;
  byteCount?: number | null;
  updatedAt?: string | null;
  agentId?: string | null;
  taskId?: string | null;
  agentName?: string | null;
  cronJobId?: string | null;
  cronJobName?: string | null;
  isReadableText: boolean;
  harnessId?: string | null;
  harnessType?: string | null;
  harnessLabel?: string | null;
  contentHash?: string | null;
  externalUrl?: string | null;
  externalProvider?: string | null;
  presentationState?: WorkspaceArtifactPresentationState;
  presentationReason?: string | null;
}

export interface WorkspaceArtifactSyncInput {
  sourceInstallationId?: string;
  machineId?: string;
  machineLabel?: string;
  platform?: "macos" | "windows" | "linux" | "unknown";
  artifacts: WorkspaceArtifactSyncItem[];
}

export interface WorkspaceArtifactSyncResult {
  synchronized: number;
  sourceMachineId: string;
  sourceIdentityId: string;
  refreshedAt: string;
}

export interface CreateTeamMemoryItemInput {
  title: string;
  content: string;
  type?: string;
  tags?: string[];
}

export type RealtimeClientEvent =
  | { type: "authenticate"; token: string }
  | { type: "subscribe_workspace"; workspaceId: string }
  | { type: "unsubscribe_workspace"; workspaceId: string }
  | { type: "subscribe_thread"; threadId: string }
  | { type: "unsubscribe_thread"; threadId: string }
  | { type: "request_pending_dispatches"; threadId: string }
  | {
      type: "request_agent_ops_live_state";
      workspaceId: string;
      agentIds: string[];
    }
  | { type: "typing_start"; threadId: string }
  | { type: "typing_stop"; threadId: string };

export type RealtimeServerEvent =
  | {
      type: "authenticated";
      data: {
        userId: string;
        kind: "mobile" | "web" | "bridge";
        workspaceId?: string;
      };
    }
  | { type: "subscribed_workspace"; data: { workspaceId: string } }
  | { type: "unsubscribed_workspace"; data: { workspaceId: string } }
  | { type: "subscribed_thread"; data: { threadId: string } }
  | { type: "unsubscribed_thread"; data: { threadId: string } }
  | { type: "message.new"; data: Message }
  | { type: "message.condensed"; data: MessageCondensedUpdatedPayload }
  | { type: "thread.update"; data: Thread }
  | { type: "typing:start"; data: { threadId: string; userId: string } }
  | { type: "typing:stop"; data: { threadId: string; userId: string } }
  | {
      type: "runtime.dispatch.queued";
      data: RuntimeDispatchEventPayload;
    }
  | {
      type: "runtime.dispatch.started";
      data: RuntimeDispatchEventPayload;
    }
  | { type: "runtime.run.delta"; data: RuntimeRunDeltaPayload }
  | { type: "runtime.run.thinking"; data: RuntimeRunThinkingPayload }
  | { type: "runtime.run.status"; data: RuntimeRunStatusPayload }
  | { type: "runtime.run.tool"; data: RuntimeRunToolPayload }
  | { type: "runtime.run.context"; data: RuntimeRunContextPayload }
  | {
      type: "runtime.dispatch.completed";
      data: RuntimeDispatchCompletedPayload;
    }
  | {
      type: "runtime.dispatch.failed";
      data: RuntimeDispatchFailedPayload;
    }
  | {
      type: "runtime.dispatch.cancelled";
      data: RuntimeDispatchEventPayload;
    }
  | {
      type: "runtime.participant.health";
      data: RuntimeParticipantHealthPayload;
    }
  | {
      type: "agent_ops.live_state.snapshot";
      data: AgentOpsLiveStateSnapshot;
    }
  | {
      type: "agent_ops.live_state.updated";
      data: AgentOpsLiveAgentState;
    }
  | { type: "session.revoked"; data: { reason: string } }
  | { type: "auth_error"; data: { error: string } };

export type RealtimeEnvelope = RealtimeServerEvent;
