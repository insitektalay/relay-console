import { ForbiddenException } from "@nestjs/common";
import manifestDocument = require("./marketplace-release-manifest.json");
import { type MarketplaceAppDefinition } from "./catalog/marketplace-catalog.types";

export type MarketplaceReleaseState =
  | "available"
  | "preview"
  | "provider_setup_required"
  | "provider_review_pending"
  | "customer_credential_required"
  | "unsupported"
  | "coming_later";

export type MarketplaceReleaseDecision = {
  state: MarketplaceReleaseState;
  label: string;
  connectEligible: boolean;
  liveVerified: boolean;
  reason: string;
};

export type MarketplaceProviderReleaseDecision = MarketplaceReleaseDecision & {
  slug: string;
  reviewedAt: string;
};

export type MarketplaceReleaseManifest = {
  schemaVersion: "relay.marketplace-release.v1";
  manifestVersion: string;
  releaseChannel: string;
  freeze: {
    status: "open" | "frozen";
    frozenAt: string | null;
    sourceRevision: string | null;
  };
  defaultProvider: MarketplaceReleaseDecision;
  providers: MarketplaceProviderReleaseDecision[];
};

export type MarketplaceAppRelease = MarketplaceReleaseDecision & {
  manifestVersion: string;
  releaseChannel: string;
  freezeStatus: "open" | "frozen";
  verificationLevel: "documentation_reviewed" | "relay_verified";
};

const LABELS: Record<MarketplaceReleaseState, string> = {
  available: "Available",
  preview: "Preview",
  provider_setup_required: "Provider setup required",
  provider_review_pending: "Provider review pending",
  customer_credential_required: "Beta — customer credentials required",
  unsupported: "Unsupported",
  coming_later: "Coming later",
};

function validateManifest(input: unknown): MarketplaceReleaseManifest {
  const manifest = input as MarketplaceReleaseManifest;
  if (
    manifest?.schemaVersion !== "relay.marketplace-release.v1" ||
    !manifest.manifestVersion ||
    !manifest.releaseChannel ||
    !["open", "frozen"].includes(manifest.freeze?.status) ||
    !manifest.defaultProvider ||
    !Array.isArray(manifest.providers)
  ) {
    throw new Error("The bundled Marketplace release manifest is invalid.");
  }
  const seen = new Set<string>();
  for (const [index, decision] of [
    manifest.defaultProvider,
    ...manifest.providers,
  ].entries()) {
    if (LABELS[decision.state] !== decision.label || !decision.reason?.trim()) {
      throw new Error(`Marketplace release decision ${index} is invalid.`);
    }
    const usable =
      decision.state === "available" ||
      decision.state === "customer_credential_required";
    if (
      (decision.connectEligible && !usable) ||
      (decision.liveVerified && !decision.connectEligible)
    ) {
      throw new Error(
        `Marketplace release decision ${index} does not fail closed.`,
      );
    }
    if (index > 0) {
      const provider = decision as MarketplaceProviderReleaseDecision;
      if (
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(provider.slug) ||
        seen.has(provider.slug)
      ) {
        throw new Error(
          `Marketplace release provider ${index} has an invalid or duplicate slug.`,
        );
      }
      seen.add(provider.slug);
    }
  }
  if (
    manifest.defaultProvider.connectEligible ||
    manifest.defaultProvider.liveVerified
  ) {
    throw new Error(
      "The Marketplace release manifest default must fail closed.",
    );
  }
  if (
    manifest.freeze.status !== "frozen" &&
    manifest.providers.some((provider) => provider.connectEligible)
  ) {
    throw new Error(
      "The Marketplace release manifest cannot enable Connect before freeze.",
    );
  }
  return Object.freeze(manifest);
}

export const MARKETPLACE_RELEASE_MANIFEST = validateManifest(manifestDocument);

export const MARKETPLACE_RELEASE_MANIFEST_SUMMARY = Object.freeze({
  schemaVersion: MARKETPLACE_RELEASE_MANIFEST.schemaVersion,
  manifestVersion: MARKETPLACE_RELEASE_MANIFEST.manifestVersion,
  releaseChannel: MARKETPLACE_RELEASE_MANIFEST.releaseChannel,
  freezeStatus: MARKETPLACE_RELEASE_MANIFEST.freeze.status,
  frozenAt: MARKETPLACE_RELEASE_MANIFEST.freeze.frozenAt,
  sourceRevision: MARKETPLACE_RELEASE_MANIFEST.freeze.sourceRevision,
});

export function resolveMarketplaceReleaseDecision(
  app: Pick<MarketplaceAppDefinition, "slug" | "sourceType">,
): MarketplaceAppRelease {
  if (app.sourceType === "local_repo") {
    return {
      manifestVersion: MARKETPLACE_RELEASE_MANIFEST.manifestVersion,
      releaseChannel: MARKETPLACE_RELEASE_MANIFEST.releaseChannel,
      freezeStatus: MARKETPLACE_RELEASE_MANIFEST.freeze.status,
      state: "available",
      label: "Available",
      connectEligible: true,
      liveVerified: true,
      verificationLevel: "relay_verified",
      reason:
        "This is a customer-managed local application and is not governed by the provider release cohort.",
    };
  }
  const slug = app.slug.trim().toLowerCase();
  const decision =
    MARKETPLACE_RELEASE_MANIFEST.providers.find(
      (provider) => provider.slug === slug,
    ) ?? MARKETPLACE_RELEASE_MANIFEST.defaultProvider;
  return {
    manifestVersion: MARKETPLACE_RELEASE_MANIFEST.manifestVersion,
    releaseChannel: MARKETPLACE_RELEASE_MANIFEST.releaseChannel,
    freezeStatus: MARKETPLACE_RELEASE_MANIFEST.freeze.status,
    state: decision.state,
    label: decision.label,
    connectEligible: decision.connectEligible,
    liveVerified: decision.liveVerified,
    verificationLevel: decision.liveVerified
      ? "relay_verified"
      : "documentation_reviewed",
    reason: decision.reason,
  };
}

export function applyMarketplaceReleaseMetadata(
  app: MarketplaceAppDefinition,
): MarketplaceAppDefinition {
  const release = resolveMarketplaceReleaseDecision(app);
  const configuredOnly =
    release.connectEligible &&
    !release.liveVerified &&
    app.capabilities.length === 0 &&
    app.allowedActions.length === 0 &&
    app.approvalRequiredActions.length === 0 &&
    app.runtimeSupport.every(
      (runtime) => runtime.installSupport === "unsupported",
    );
  return {
    ...app,
    availability: release.connectEligible ? "available" : "preview",
    agentUseSummary: configuredOnly
      ? `${app.name} credentials can be encrypted and saved as configured but unverified. No provider request, runtime installation, or agent action is enabled until Relay ships a bounded connector.`
      : app.agentUseSummary,
    release,
    sourceMetadata: {
      ...(app.sourceMetadata ?? {}),
      marketplaceRelease: release,
      marketplaceLaunchMode: configuredOnly
        ? "configured_only_no_provider_egress"
        : "bounded_connector",
    },
  };
}

export function assertMarketplaceReleaseConnectEligible(
  app: Pick<MarketplaceAppDefinition, "slug" | "sourceType" | "name">,
) {
  const release = resolveMarketplaceReleaseDecision(app);
  if (release.freezeStatus === "frozen" && release.connectEligible) {
    return release;
  }
  throw new ForbiddenException(
    `${app.name} cannot connect yet: ${release.label}. ${release.reason}`,
  );
}
