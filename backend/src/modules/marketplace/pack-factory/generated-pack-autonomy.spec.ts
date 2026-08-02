import { compileGeneratedMarketplacePack } from "./generated-pack-compiler";
import { defaultLocalAppAutonomyPolicy } from "../local-app-autonomy.policy";
import { type MarketplaceAppDefinition } from "../catalog/marketplace-catalog.types";
import { type MarketplaceGeneratedPack } from "./types";

function app(mode: "safe_default" | "dangerously_skip_permissions"): MarketplaceAppDefinition {
  return {
    slug: "local-localappconnector",
    name: "LocalAppConnector",
    sourceType: "local_repo",
    category: "developer",
    description: "Local app",
    agentUseSummary: "Operate local app",
    connectionTypes: ["local_repo"],
    credentialRequirements: [],
    webhookRequirements: [],
    approvalProfile: "local_repo_conservative",
    approvalProfiles: [
      {
        id: "local_repo_conservative",
        label: "Local repo conservative",
        description: "Default",
        defaultSelected: true,
      },
    ],
    riskLevel: "medium",
    capabilities: [],
    allowedActions: [],
    approvalRequiredActions: [],
    blockedActions: [],
    providerDocsUrl: "",
    providerWebsiteUrl: "",
    runtimeSupport: [{ format: "hermes", installSupport: "installable", label: "Hermes", description: "" }],
    availability: "available",
    packQuality: {
      level: "generated_reviewed",
      publicationStatus: "published",
      label: "Generated",
      description: "",
      confidence: "medium",
      reviewed: true,
      source: "local_repo",
    },
    sourceMetadata: { autonomyPolicy: defaultLocalAppAutonomyPolicy(mode) },
  };
}

function pack(): MarketplaceGeneratedPack {
  return {
    appSlug: "local-localappconnector",
    name: "LocalAppConnector",
    category: "developer",
    riskLevel: "medium",
    approvalProfiles: [
      {
        id: "local_repo_conservative",
        label: "Local repo conservative",
        description: "Default",
        defaultSelected: true,
      },
    ],
    allowedActions: [],
    approvalRequiredActions: [],
    blockedActions: [],
    sourceUrls: [],
    sources: [],
    capabilities: [],
    authTypes: [],
    knownObjects: [],
    highRiskActions: [],
    commonWorkflows: [],
    endpointFamilies: [],
    generatedAt: new Date().toISOString(),
    qualityLevel: "generated_reviewed",
    publicationStatus: "published",
    canonicalSources: {
      "workflow.md": "# Workflow\n\nUse current policy.",
      "safe_actions.md": "# Safe actions",
      "permissions.md": "# Permissions",
      "auth.md": "# Auth",
    },
    toolSchemaDraft: {},
    quality: {
      score: 100,
      confidence: "medium",
      missingSections: [],
      warnings: [],
      officialDocsCoverage: {
        apiOverview: true,
        auth: true,
        scopes: true,
        rateLimits: true,
        webhooks: true,
      },
      highRiskActionsDetected: false,
      reviewStatus: "approved",
    },
  };
}

describe("generated pack autonomy policy", () => {
  it("includes current mode and supersedes stale context for autonomous external mode", () => {
    const compiled = compileGeneratedMarketplacePack({
      app: app("dangerously_skip_permissions"),
      pack: pack(),
      runtimeFormat: "hermes",
      selectedCapabilities: ["read", "draft", "write_internal", "email_send"],
      libraryTargetFolder: "marketplace/local-localappconnector",
    });
    const skill = compiled.files.find((file) => file.relativePath.endsWith("SKILL.md"))?.content ?? "";
    expect(skill).toContain("CURRENT LOCAL APP AUTONOMY MODE: dangerously_skip_permissions");
    expect(skill).toContain("supersedes stale chat history");
    expect(skill).toContain("Needed Tool request");
    expect(skill).toContain(
      "Local app unreachable triggers runtime recovery; do not treat it as a final task blocker.",
    );
    expect(skill.toLowerCase()).not.toContain("no outreach");
  });
});
