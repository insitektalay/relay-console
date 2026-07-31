import { type MarketplaceAppDefinition } from "../catalog/marketplace-catalog.types";
import {
  type MarketplacePackFactoryConfig,
  type MarketplacePackSource,
} from "./types";

export function buildPackFactoryConfigFromApp(
  app: MarketplaceAppDefinition,
): MarketplacePackFactoryConfig {
  return {
    appSlug: app.slug,
    name: app.name,
    category: app.category,
    riskLevel: app.riskLevel,
    providerUrl: app.providerWebsiteUrl,
    docs: {
      apiOverview: app.providerDocsUrl,
      webhooks: app.webhookRequirements.length ? app.providerDocsUrl : undefined,
    },
    authTypes: app.connectionTypes,
    knownObjects: inferKnownObjects(app),
    highRiskActions: [
      ...app.approvalRequiredActions.map((action) => action.id),
      ...app.blockedActions.map((action) => action.id),
    ],
    commonWorkflows: inferCommonWorkflows(app),
    manuallySuppliedNotes: [
      app.description,
      app.agentUseSummary,
      ...app.webhookRequirements,
    ].filter(Boolean),
    existingApp: app,
  };
}

export function mergeImportedSourceModel(
  config: MarketplacePackFactoryConfig,
  importedSourceModel: MarketplacePackFactoryConfig["importedSourceModel"],
): MarketplacePackFactoryConfig {
  if (!importedSourceModel) return config;
  return {
    ...config,
    importedSourceModel,
    authTypes: importedSourceModel.authTypes.length
      ? [...new Set([...config.authTypes, ...importedSourceModel.authTypes])]
      : config.authTypes,
    knownObjects: importedSourceModel.objects.length
      ? [...new Set([...(config.knownObjects ?? []), ...importedSourceModel.objects])]
      : config.knownObjects,
    highRiskActions: importedSourceModel.highRiskSignals.length
      ? [...new Set([...(config.highRiskActions ?? []), ...importedSourceModel.highRiskSignals])]
      : config.highRiskActions,
    commonWorkflows: importedSourceModel.workflowSignals.length
      ? [...new Set([...(config.commonWorkflows ?? []), ...importedSourceModel.workflowSignals])]
      : config.commonWorkflows,
  };
}

export function buildPackSources(
  config: MarketplacePackFactoryConfig,
): MarketplacePackSource[] {
  const docs = config.docs ?? {};
  const sources: MarketplacePackSource[] = [];
  if (config.providerUrl) {
    sources.push({
      kind: "provider_website",
      url: config.providerUrl,
      title: `${config.name} provider website`,
      official: true,
    });
  }
  if (docs.apiOverview) {
    sources.push({
      kind: "official_api_docs",
      url: docs.apiOverview,
      title: `${config.name} API overview`,
      official: true,
    });
  }
  if (docs.auth) {
    sources.push({
      kind: "auth_docs",
      url: docs.auth,
      title: `${config.name} auth docs`,
      official: true,
    });
  }
  if (docs.scopes) {
    sources.push({
      kind: "auth_docs",
      url: docs.scopes,
      title: `${config.name} scopes or permissions docs`,
      official: true,
    });
  }
  if (docs.rateLimits) {
    sources.push({
      kind: "official_api_docs",
      url: docs.rateLimits,
      title: `${config.name} rate limit docs`,
      official: true,
    });
  }
  if (docs.webhooks) {
    sources.push({
      kind: "webhook_docs",
      url: docs.webhooks,
      title: `${config.name} webhook docs`,
      official: true,
    });
  }
  if (docs.openApiSpec) {
    sources.push({
      kind: "openapi_spec",
      url: docs.openApiSpec,
      title: `${config.name} OpenAPI spec`,
      official: true,
    });
  }
  if (docs.postmanCollection) {
    sources.push({
      kind: "postman_collection",
      url: docs.postmanCollection,
      title: `${config.name} Postman collection`,
      official: true,
    });
  }
  if (docs.mcpManifest) {
    sources.push({
      kind: "mcp_manifest",
      url: docs.mcpManifest,
      title: `${config.name} MCP manifest`,
      official: false,
    });
  }
  for (const note of config.manuallySuppliedNotes ?? []) {
    sources.push({
      kind: "manual_notes",
      notes: note,
      title: `${config.name} marketplace note`,
      official: false,
    });
  }
  for (const source of config.importedSourceModel?.sourceSummaries ?? []) {
    if (!source.url && !source.title) continue;
    sources.push({
      kind: source.kind,
      url: source.url,
      title: source.title,
      official: source.official,
      ingestion: {
        status: source.status,
        importedAt: config.importedSourceModel.extractedAt,
        contentLength: source.contentLength,
        contentHash: source.contentHash,
        error: source.error,
        coverage: config.importedSourceModel.coverage,
      },
    });
  }
  return sources;
}

function inferKnownObjects(app: MarketplaceAppDefinition) {
  const words = [
    ...app.description.split(/[^a-zA-Z0-9]+/),
    ...app.agentUseSummary.split(/[^a-zA-Z0-9]+/),
  ]
    .map((word) => word.trim().toLowerCase())
    .filter((word) => word.length > 3);
  return [...new Set(words)].slice(0, 8);
}

function inferCommonWorkflows(app: MarketplaceAppDefinition) {
  return [
    ...app.allowedActions.map((action) => action.id),
    ...app.approvalRequiredActions.map((action) => `prepare_${action.id}`),
  ].slice(0, 8);
}
