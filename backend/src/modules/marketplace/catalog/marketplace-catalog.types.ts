// Provider manifests are the canonical catalog and may introduce a category
// without requiring a backend code release just to extend this union.
export type MarketplaceCategory = string;

export type MarketplaceRiskLevel = "low" | "medium" | "high" | "critical";

export type MarketplaceRuntimeFormat = "openclaw" | "hermes";
export type MarketplaceAppSourceType =
  | "external_provider"
  | "local_repo"
  | "uploaded_pack"
  | "third_party_pack";

export type MarketplacePackQualityLevel =
  | "curated"
  | "generated_reviewed"
  | "generated_draft";

export type MarketplacePackPublicationStatus =
  | "published"
  | "review_needed"
  | "draft"
  | "blocked";

export type MarketplaceActionPolicy = {
  id: string;
  label: string;
  description: string;
};

export type MarketplaceCredentialRequirement = {
  name: string;
  label: string;
  required: boolean;
  secret: boolean;
  helpText: string;
  requiredForAuthTypes?: string[];
  inputType?: "text" | "select";
  options?: MarketplaceCredentialOption[];
  defaultValue?: string;
};

export type MarketplaceCredentialOption = {
  value: string;
  label: string;
};

export type MarketplaceCapability = {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
};

export type MarketplaceOAuthAccessOption = {
  id: string;
  label: string;
  description: string;
  scopes: string[];
  capabilityIds: string[];
  defaultSelected: boolean;
};

export type MarketplaceApprovalProfile = {
  id: string;
  label: string;
  description: string;
  defaultSelected: boolean;
  allowedActions?: MarketplaceActionPolicy[];
  approvalRequiredActions?: MarketplaceActionPolicy[];
  blockedActions?: MarketplaceActionPolicy[];
};

export type MarketplaceRuntimeSupport = {
  format: MarketplaceRuntimeFormat;
  installSupport: "installable" | "preview_only" | "unsupported";
  label: string;
  description: string;
};

export type MarketplaceRoleManifestSource = "default" | "explicit" | "inferred";

export type MarketplaceRoleManifestEntry = {
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
};

export type MarketplaceRoleManifest = {
  roles: MarketplaceRoleManifestEntry[];
  roleCount: number;
};

export type MarketplacePackQualitySummary = {
  level: MarketplacePackQualityLevel;
  publicationStatus: MarketplacePackPublicationStatus;
  label: string;
  description: string;
  confidence: "high" | "medium" | "low";
  reviewed: boolean;
  source: "curated_source" | "pack_factory" | "local_repo";
};

export type MarketplaceAppRelease = {
  manifestVersion: string;
  releaseChannel: string;
  freezeStatus: "open" | "frozen";
  state:
    | "available"
    | "preview"
    | "provider_setup_required"
    | "provider_review_pending"
    | "customer_credential_required"
    | "unsupported"
    | "coming_later";
  label: string;
  connectEligible: boolean;
  liveVerified: boolean;
  verificationLevel: "documentation_reviewed" | "relay_verified";
  reason: string;
};

export type MarketplaceAppDefinition = {
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
  oauthAccessOptions?: MarketplaceOAuthAccessOption[];
  runtimeSupport: MarketplaceRuntimeSupport[];
  roleManifest?: MarketplaceRoleManifest;
  availability: "available" | "preview" | "unsupported";
  release?: MarketplaceAppRelease;
  packQuality: MarketplacePackQualitySummary;
  sourceMetadata?: Record<string, unknown>;
};

export function capability(
  id: string,
  label: string,
  description: string,
  defaultEnabled: boolean,
): MarketplaceCapability {
  return { id, label, description, defaultEnabled };
}

export function action(
  id: string,
  label: string,
  description: string,
): MarketplaceActionPolicy {
  return { id, label, description };
}

export function blocked(
  id: string,
  label: string,
  description: string,
): MarketplaceActionPolicy {
  return action(id, label, description);
}
