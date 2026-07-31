import catalogDocument = require("./generated-provider-catalog.json");
import {
  type MarketplaceActionPolicy,
  type MarketplaceAppDefinition,
  type MarketplaceApprovalProfile,
  type MarketplaceRuntimeSupport,
} from "./marketplace-catalog.types";
import {
  GENERATED_MARKETPLACE_PROVIDER_IDENTITIES,
  GENERATED_MARKETPLACE_PROVIDER_SOURCE_SHA256,
  type MarketplaceProviderSlug,
} from "./generated-provider-identities";

type ProviderManifest = Record<string, any>;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function actions(value: unknown): MarketplaceActionPolicy[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      id: text(entry.id),
      label: text(entry.label ?? entry.name, text(entry.id)),
      description: text(entry.description, text(entry.label ?? entry.name)),
    }))
    .filter((entry) => entry.id);
}

function actionReferences(
  value: unknown,
  index: Map<string, MarketplaceActionPolicy>,
) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return index.get(entry);
      if (entry && typeof entry === "object") return actions([entry])[0];
      return undefined;
    })
    .filter((entry): entry is MarketplaceActionPolicy => Boolean(entry));
}

function runtimeSupport(value: unknown): MarketplaceRuntimeSupport[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const rawSupport = text(entry.installSupport, "unsupported");
      const installSupport = [
        "installable",
        "native",
        "native_tools",
        "native_wrapper_tools",
        "server_proxy",
      ].includes(rawSupport)
        ? "installable"
        : rawSupport === "preview_only"
          ? "preview_only"
          : "unsupported";
      const format = entry.format === "hermes" ? "hermes" : "openclaw";
      return {
        format,
        installSupport,
        label: text(
          entry.label,
          `${format === "hermes" ? "Hermes" : "OpenClaw"} ${installSupport === "installable" ? "supported" : installSupport === "preview_only" ? "preview" : "unavailable"}`,
        ),
        description: text(
          entry.description,
          "No runtime description supplied.",
        ),
      } satisfies MarketplaceRuntimeSupport;
    });
}

function availability(
  value: unknown,
): MarketplaceAppDefinition["availability"] {
  if (["unsupported", "unavailable"].includes(text(value)))
    return "unsupported";
  if (
    [
      "available",
      "awaiting_provider_setup",
      "provider_setup_required",
      "beta_available",
    ].includes(text(value))
  ) {
    return "available";
  }
  return "preview";
}

function normalizeManifest(
  manifest: ProviderManifest,
): MarketplaceAppDefinition {
  const allowed = actions(manifest.actions?.allowed);
  const approvalRequired = actions(manifest.actions?.approvalRequired);
  const blocked = actions(manifest.actions?.blocked);
  const slug = text(manifest.slug) as MarketplaceProviderSlug;
  const identity = GENERATED_MARKETPLACE_PROVIDER_IDENTITIES[slug];
  if (!identity) {
    throw new Error(`Generated Marketplace identity is missing for ${slug}`);
  }
  const executableActionIds = [...allowed, ...approvalRequired].map(
    ({ id }) => id,
  );
  if (
    executableActionIds.length !== identity.executableActionIds.length ||
    executableActionIds.some(
      (actionId, index) => actionId !== identity.executableActionIds[index],
    )
  ) {
    throw new Error(
      `Generated Marketplace action identity is stale for ${slug}`,
    );
  }
  const actionIndex = new Map(
    [...allowed, ...approvalRequired, ...blocked].map((entry) => [
      entry.id,
      entry,
    ]),
  );
  const approvalProfiles: MarketplaceApprovalProfile[] = Array.isArray(
    manifest.approvalProfiles,
  )
    ? manifest.approvalProfiles.map((profile: Record<string, unknown>) => ({
        id: text(profile.id),
        label: text(profile.label ?? profile.name, text(profile.id)),
        description: text(
          profile.description,
          text(profile.label ?? profile.name),
        ),
        defaultSelected: profile.defaultSelected !== false,
        allowedActions: actionReferences(profile.allowedActions, actionIndex),
        approvalRequiredActions: actionReferences(
          profile.approvalRequiredActions,
          actionIndex,
        ),
        blockedActions: actionReferences(profile.blockedActions, actionIndex),
      }))
    : [];
  if (
    executableActionIds.length > 0 &&
    !approvalProfiles.some(
      (profile) => profile.id === "dangerously_skip_permissions",
    )
  ) {
    approvalProfiles.push({
      id: "dangerously_skip_permissions",
      label: "Direct writes",
      description:
        "Selected provider-authorized actions can run without Relay per-action approval. Connection ownership, provider-granted authority, selected capabilities, blocked actions, request bounds, rate limits, audit evidence, and secret non-exposure remain enforced.",
      defaultSelected: false,
      allowedActions: [...allowed, ...approvalRequired],
      approvalRequiredActions: [],
      blockedActions: blocked,
    });
  }
  const selectedProfile =
    approvalProfiles.find((profile) => profile.defaultSelected)?.id ??
    approvalProfiles[0]?.id ??
    "unavailable";

  return {
    slug,
    name: text(manifest.name, text(manifest.slug)),
    sourceType: "external_provider",
    category: text(manifest.category, "other"),
    description: text(manifest.description, text(manifest.name)),
    agentUseSummary: text(manifest.agentUseSummary, text(manifest.description)),
    connectionTypes: Array.isArray(manifest.connection?.types)
      ? manifest.connection.types.map(String)
      : [],
    credentialRequirements: Array.isArray(
      manifest.connection?.credentialRequirements,
    )
      ? manifest.connection.credentialRequirements
          .filter(
            (credential: unknown): credential is Record<string, unknown> =>
              Boolean(credential) && typeof credential === "object",
          )
          .map((credential: Record<string, unknown>) => ({
            name: text(credential.name ?? credential.key ?? credential.id),
            label: text(
              credential.label,
              text(credential.name ?? credential.key ?? credential.id),
            ),
            required: credential.required !== false,
            secret: credential.secret !== false,
            helpText: text(credential.helpText ?? credential.description),
            requiredForAuthTypes: Array.isArray(credential.requiredForAuthTypes)
              ? credential.requiredForAuthTypes.map(String)
              : undefined,
            inputType: credential.inputType === "select" ? "select" : undefined,
            options: Array.isArray(credential.options)
              ? credential.options
                  .filter(
                    (option: unknown): option is Record<string, unknown> =>
                      Boolean(option) && typeof option === "object",
                  )
                  .map((option: Record<string, unknown>) => ({
                    value: text(option.value),
                    label: text(option.label, text(option.value)),
                  }))
                  .filter((option) => option.value)
              : undefined,
            defaultValue:
              typeof credential.defaultValue === "string"
                ? credential.defaultValue
                : undefined,
          }))
          .filter((credential) => credential.name)
      : [],
    webhookRequirements: Array.isArray(manifest.connection?.webhookRequirements)
      ? manifest.connection.webhookRequirements.map((entry: unknown) =>
          typeof entry === "string" ? entry : JSON.stringify(entry),
        )
      : [],
    approvalProfile: selectedProfile,
    approvalProfiles,
    riskLevel: ["low", "medium", "high", "critical"].includes(
      manifest.riskLevel,
    )
      ? manifest.riskLevel
      : "high",
    capabilities: Array.isArray(manifest.capabilities)
      ? manifest.capabilities.map((capability: Record<string, unknown>) => ({
          id: text(capability.id),
          label: text(capability.label ?? capability.name, text(capability.id)),
          description: text(
            capability.description,
            text(capability.label ?? capability.name),
          ),
          defaultEnabled:
            capability.defaultEnabled !== false &&
            capability.defaultSelected !== false,
        }))
      : [],
    allowedActions: allowed,
    approvalRequiredActions: approvalRequired,
    blockedActions: blocked,
    providerDocsUrl: text(manifest.provider?.docsUrl),
    providerWebsiteUrl: text(manifest.provider?.websiteUrl),
    accountCreationUrl:
      text(manifest.provider?.accountCreationUrl) || undefined,
    oauthAccessOptions: Array.isArray(manifest.authentication?.accessOptions)
      ? manifest.authentication.accessOptions.map(
          (option: Record<string, unknown>) => ({
            id: text(option.id),
            label: text(option.label, text(option.id)),
            description: text(option.description),
            scopes: Array.isArray(option.scopes)
              ? option.scopes.filter(
                  (scope: unknown): scope is string =>
                    typeof scope === "string",
                )
              : [],
            capabilityIds: Array.isArray(option.capabilityIds)
              ? option.capabilityIds.filter(
                  (capabilityId: unknown): capabilityId is string =>
                    typeof capabilityId === "string",
                )
              : [],
            defaultSelected: option.defaultSelected === true,
          }),
        )
      : undefined,
    runtimeSupport: runtimeSupport(manifest.runtimeSupport),
    availability: availability(manifest.availability),
    packQuality: {
      level: "generated_reviewed",
      publicationStatus: "published",
      label: "Provider manifest",
      description:
        "Generated from the reviewed canonical Marketplace provider manifest.",
      confidence: "high",
      reviewed: true,
      source: "curated_source",
    },
    sourceMetadata: {
      catalogSource: "provider_manifest",
      schemaVersion: manifest.schemaVersion,
      authentication: manifest.authentication ?? null,
      callbackPath: manifest.connection?.callbackPath ?? null,
      providerSetup: manifest.providerSetup ?? null,
      evidence: manifest.evidence ?? [],
      manifestAvailability: manifest.availability ?? null,
    },
  };
}

export const GENERATED_MARKETPLACE_CATALOG: MarketplaceAppDefinition[] =
  Object.freeze(
    (catalogDocument.manifests as ProviderManifest[]).map(normalizeManifest),
  ) as unknown as MarketplaceAppDefinition[];

if (
  catalogDocument.sourceSHA256 !== GENERATED_MARKETPLACE_PROVIDER_SOURCE_SHA256
) {
  throw new Error(
    "Generated Marketplace catalog and typed identities have different source hashes",
  );
}

export const GENERATED_MARKETPLACE_CATALOG_SUMMARY = Object.freeze({
  schemaVersion: catalogDocument.schemaVersion,
  generatedAt: catalogDocument.generatedAt,
  manifestCount: catalogDocument.manifestCount,
  sourceSHA256: catalogDocument.sourceSHA256,
});
