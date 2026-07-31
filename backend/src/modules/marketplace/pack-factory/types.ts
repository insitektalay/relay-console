import {
  type MarketplaceActionPolicy,
  type MarketplaceAppDefinition,
  type MarketplaceApprovalProfile,
  type MarketplaceCapability,
  type MarketplaceCategory,
  type MarketplacePackPublicationStatus,
  type MarketplacePackQualityLevel,
  type MarketplaceRiskLevel,
  type MarketplaceRoleManifest,
  type MarketplaceRuntimeFormat,
} from "../catalog/marketplace-catalog.types";

export type MarketplacePackSourceKind =
  | "official_api_docs"
  | "openapi_spec"
  | "postman_collection"
  | "mcp_manifest"
  | "provider_website"
  | "auth_docs"
  | "webhook_docs"
  | "manual_notes"
  | "local_repo_manifest"
  | "local_repo_docs"
  | "curated_source_pack";

export type MarketplacePackSource = {
  kind: MarketplacePackSourceKind;
  url?: string;
  filePath?: string;
  title?: string;
  notes?: string;
  official: boolean;
  ingestion?: MarketplacePackSourceIngestion;
};

export type MarketplacePackSourceIngestion = {
  status: "not_imported" | "imported" | "failed";
  importedAt?: string;
  contentType?: string;
  contentLength?: number;
  contentHash?: string;
  error?: string;
  coverage?: Partial<MarketplaceExtractedSourceCoverage>;
};

export type MarketplaceExtractedEndpoint = {
  method?: string;
  path: string;
  family: string;
  summary?: string;
  sourceUrl?: string;
};

export type MarketplaceExtractedSourceCoverage = {
  apiOverview: boolean;
  auth: boolean;
  scopes: boolean;
  rateLimits: boolean;
  webhooks: boolean;
  errors: boolean;
  endpoints: boolean;
  objects: boolean;
  safetyPolicy: boolean;
  workflows: boolean;
  examples: boolean;
  officialSources: boolean;
};

export type MarketplaceExtractedSourceModel = {
  extractedAt: string;
  sourceUrls: string[];
  sourceSummaries: Array<{
    kind: MarketplacePackSourceKind;
    url?: string;
    title?: string;
    official: boolean;
    status: "imported" | "failed" | "not_imported";
    contentLength?: number;
    contentHash?: string;
    error?: string;
    signals: string[];
  }>;
  coverage: MarketplaceExtractedSourceCoverage;
  objects: string[];
  authTypes: string[];
  scopeSignals: string[];
  rateLimitSignals: string[];
  webhookSignals: string[];
  endpoints: MarketplaceExtractedEndpoint[];
  endpointFamilies: Array<{
    id: string;
    label: string;
    guidance: string;
    representativeEndpoints: string[];
  }>;
  workflowSignals: string[];
  safetySignals: string[];
  exampleSignals: string[];
  highRiskSignals: string[];
  missingSections: string[];
  warnings: string[];
  ingestionErrors: Array<{ source: string; error: string }>;
};

export type MarketplacePackGenerationJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type MarketplacePackReviewStatus =
  | "not_reviewed"
  | "ai_reviewed"
  | "human_reviewed"
  | "approved"
  | "rejected";

export type MarketplacePackReviewOutcome =
  | "ready_for_review"
  | "needs_sources"
  | "needs_safety_review"
  | "needs_auth_review"
  | "needs_endpoint_review"
  | "needs_manual_review"
  | "failed_generation";

export type MarketplacePackReviewGateResult = {
  appSlug: string;
  outcome: MarketplacePackReviewOutcome;
  passed: boolean;
  score: number;
  blockingReasons: string[];
  warnings: string[];
  highRiskWarnings: string[];
  recommendedNextAction: string;
  checks: {
    officialSourceCoverage: boolean;
    authCoverage: boolean;
    permissionsCoverage: boolean;
    endpointObjectCoverage: boolean;
    webhookEventCoverage: boolean;
    rateLimitCoverage: boolean;
    errorHandlingCoverage: boolean;
    safetyPolicyCoverage: boolean;
    approvalProfileQuality: boolean;
    blockedActionQuality: boolean;
    examplesWorkflowQuality: boolean;
    secretSafetyScan: boolean;
    highRiskConservatism: boolean;
    openclawCompileSuccess: boolean;
    hermesCompileSuccess: boolean;
  };
};

export type MarketplacePackGenerationJob = {
  id: string;
  appSlug: string;
  status: MarketplacePackGenerationJobStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type MarketplacePackQualityScore = {
  score: number;
  confidence: "high" | "medium" | "low";
  missingSections: string[];
  warnings: string[];
  officialDocsCoverage: {
    apiOverview: boolean;
    auth: boolean;
    scopes: boolean;
    rateLimits: boolean;
    webhooks: boolean;
  };
  highRiskActionsDetected: boolean;
  reviewStatus: MarketplacePackReviewStatus;
};

export type MarketplacePackPublication = {
  qualityLevel: MarketplacePackQualityLevel;
  status: MarketplacePackPublicationStatus;
  label: string;
  reviewed: boolean;
};

export type MarketplacePackFactoryDocsConfig = {
  apiOverview?: string;
  auth?: string;
  scopes?: string;
  rateLimits?: string;
  webhooks?: string;
  openApiSpec?: string;
  postmanCollection?: string;
  mcpManifest?: string;
};

export type MarketplacePackFactoryConfig = {
  appSlug: string;
  name: string;
  category: MarketplaceCategory;
  riskLevel: MarketplaceRiskLevel;
  providerUrl?: string;
  docs?: MarketplacePackFactoryDocsConfig;
  authTypes: string[];
  knownObjects?: string[];
  highRiskActions?: string[];
  commonWorkflows?: string[];
  manuallySuppliedNotes?: string[];
  importedSourceModel?: MarketplaceExtractedSourceModel;
  existingApp?: MarketplaceAppDefinition;
};

export type MarketplaceGeneratedPack = {
  appSlug: string;
  name: string;
  category: MarketplaceCategory;
  riskLevel: MarketplaceRiskLevel;
  qualityLevel: MarketplacePackQualityLevel;
  publicationStatus: MarketplacePackPublicationStatus;
  generatedAt: string;
  sourceUrls: string[];
  sources: MarketplacePackSource[];
  capabilities: MarketplaceCapability[];
  approvalProfiles: MarketplaceApprovalProfile[];
  allowedActions: MarketplaceActionPolicy[];
  approvalRequiredActions: MarketplaceActionPolicy[];
  blockedActions: MarketplaceActionPolicy[];
  authTypes: string[];
  knownObjects: string[];
  highRiskActions: string[];
  commonWorkflows: string[];
  extractedSourceModel?: MarketplaceExtractedSourceModel;
  endpointFamilies: Array<{
    id: string;
    label: string;
    guidance: string;
    representativeEndpoints: string[];
  }>;
  canonicalSources: Record<string, string>;
  toolSchemaDraft: Record<string, unknown>;
  quality: MarketplacePackQualityScore;
  reviewGate?: MarketplacePackReviewGateResult;
  roleManifest?: MarketplaceRoleManifest;
};

export type MarketplaceGeneratedPackCompileInput = {
  app: MarketplaceAppDefinition;
  pack: MarketplaceGeneratedPack;
  runtimeFormat: MarketplaceRuntimeFormat;
  selectedCapabilities: string[];
  approvalProfileId?: string | null;
  blockedActionIds?: string[];
  connection?: {
    displayName?: string | null;
    environment?: string | null;
    authType?: string | null;
  } | null;
  libraryTargetFolder: string;
};

export type MarketplaceCompiledPackFile = {
  relativePath: string;
  content: string;
  classification: string;
  refreshPolicy: string;
};

export type MarketplaceCompiledPackPreview = {
  runtimeFormat: MarketplaceRuntimeFormat;
  files: MarketplaceCompiledPackFile[];
  approvalProfileId: string;
  metadata: Record<string, unknown>;
};

export type MarketplaceBatchGenerationReport = {
  generatedAt: string;
  totalApps: number;
  curatedCount: number;
  generatedCount: number;
  missingSourceCount: number;
  failedGenerationCount: number;
  appsNeedingReview: string[];
  apps: Array<{
    slug: string;
    name: string;
    qualityLevel: MarketplacePackQualityLevel;
    publicationStatus: MarketplacePackPublicationStatus;
    score: number;
    confidence: "high" | "medium" | "low";
    missingSections: string[];
    warnings: string[];
  }>;
};
