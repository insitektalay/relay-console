import { ForbiddenException } from "@nestjs/common";
import { type MarketplaceAppDefinition } from "./catalog/marketplace-catalog.types";
import { assertMarketplaceReleaseConnectEligible } from "./marketplace-release-policy";

export type MarketplaceBetaGateReason =
  | "global_kill_switch"
  | "beta_disabled"
  | "allowed"
  | "local_repo"
  | "blocked_for_beta"
  | "beta_allowlist_empty"
  | "not_in_beta_allowlist";

export type MarketplaceBetaGateConfig = {
  betaMode: boolean;
  globalKillSwitch: boolean;
  allowedApps: Set<string>;
  blockedApps: Set<string>;
};

export type MarketplaceBetaGateResult = {
  betaMode: boolean;
  available: boolean;
  reason: MarketplaceBetaGateReason;
  hiddenFromCatalog: boolean;
  message: string | null;
};

const TRUE_VALUES = new Set(["1", "true", "yes", "y", "on"]);

function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

function parseSlugList(value: string | undefined) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map(normalizeSlug)
      .filter(Boolean),
  );
}

export function getMarketplaceBetaGateConfig(
  env: NodeJS.ProcessEnv = process.env,
): MarketplaceBetaGateConfig {
  return {
    betaMode: TRUE_VALUES.has(
      String(env.CLAWCHAT_MARKETPLACE_BETA_MODE ?? "")
        .trim()
        .toLowerCase(),
    ),
    globalKillSwitch: TRUE_VALUES.has(
      String(env.CLAWCHAT_MARKETPLACE_KILL_SWITCH ?? "")
        .trim()
        .toLowerCase(),
    ),
    allowedApps: parseSlugList(env.CLAWCHAT_MARKETPLACE_ALLOWED_APPS),
    blockedApps: parseSlugList(env.CLAWCHAT_MARKETPLACE_BLOCKED_APPS),
  };
}

export function evaluateMarketplaceBetaGate(
  app: Pick<MarketplaceAppDefinition, "slug" | "sourceType">,
  config: MarketplaceBetaGateConfig = getMarketplaceBetaGateConfig(),
): MarketplaceBetaGateResult {
  const slug = normalizeSlug(app.slug);
  if (config.globalKillSwitch) {
    return unavailable("global_kill_switch");
  }
  if (!config.betaMode) {
    return {
      betaMode: false,
      available: true,
      reason: "beta_disabled",
      hiddenFromCatalog: false,
      message: null,
    };
  }

  if (config.blockedApps.has(slug)) {
    return unavailable("blocked_for_beta");
  }

  if (app.sourceType === "local_repo") {
    return {
      betaMode: true,
      available: true,
      reason: "local_repo",
      hiddenFromCatalog: false,
      message: null,
    };
  }

  return {
    betaMode: true,
    available: true,
    reason: "allowed",
    hiddenFromCatalog: false,
    message: null,
  };
}

export function applyMarketplaceBetaGateMetadata(
  app: MarketplaceAppDefinition,
  config: MarketplaceBetaGateConfig = getMarketplaceBetaGateConfig(),
): MarketplaceAppDefinition {
  const gate = evaluateMarketplaceBetaGate(app, config);
  if (!gate.betaMode) return app;
  return {
    ...app,
    sourceMetadata: {
      ...(app.sourceMetadata ?? {}),
      marketplaceBetaGate: gate,
    },
  };
}

export function assertMarketplaceBetaGateAllowed(
  app: Pick<MarketplaceAppDefinition, "slug" | "sourceType" | "name">,
  config: MarketplaceBetaGateConfig = getMarketplaceBetaGateConfig(),
) {
  assertMarketplaceReleaseConnectEligible(app);
  const gate = evaluateMarketplaceBetaGate(app, config);
  if (gate.available) return gate;
  throw new ForbiddenException(
    gate.message ?? `${app.name} is not included in the current ClawChat beta.`,
  );
}

function unavailable(
  reason: MarketplaceBetaGateReason,
): MarketplaceBetaGateResult {
  return {
    betaMode: true,
    available: false,
    reason,
    hiddenFromCatalog: false,
    message: "This app has been temporarily disabled by Relay.",
  };
}
