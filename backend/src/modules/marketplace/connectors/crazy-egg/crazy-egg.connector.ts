import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const writes = [
  action(
    "crazy_egg_conversions_record",
    "Record conversions",
    "Record 1 to 25 real conversion events for one exact site, including the required goal and user identifier plus bounded documented metadata.",
  ),
];
const blockedActions = [
  blocked(
    "crazy_egg_analytics_read",
    "Read analytics or recordings",
    "Web analytics, Live View, visitors, sessions, recordings, heatmaps, snapshots, confetti, overlays, funnels, reports, surveys, CTAs, and A/B test results are blocked because the Conversion Tracking API exposes no read surface.",
  ),
  blocked(
    "crazy_egg_broader_mutation",
    "Change broader Crazy Egg state",
    "Sites, snapshots, recordings, heatmaps, surveys, CTAs, tests, goals, tracking settings, team members, billing, and account administration are blocked.",
  ),
  blocked(
    "crazy_egg_synthetic_conversion",
    "Create synthetic conversions",
    "Health probes, test conversions, fabricated goals, unknown user identifiers, and events without a real customer-authorized source are blocked.",
  ),
  blocked(
    "crazy_egg_raw_bulk",
    "Use raw or unsupported access",
    "Raw paths, custom origins, undocumented fields, more than 25 conversions, payloads over 64 KB, retries, polling, browser automation, private endpoints, and provider-response pass-through are blocked.",
  ),
];

export const CRAZY_EGG_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "crazy-egg",
  name: "Crazy Egg",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://support.crazyegg.com/knowledge-base/conversion-tracking-api/",
  providerWebsiteUrl: "https://www.crazyegg.com/",
  capabilities: [
    {
      ...capability(
        "conversion_record",
        "Record conversions",
        "Record bounded real conversion events for one exact Crazy Egg site.",
        true,
      ),
      platformCapability: "crazy_egg_conversion_record",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CRAZY_EGG_SITE_API_KEY",
        label: "Crazy Egg Conversion Tracking site API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Have an authorized administrator enable Conversion Tracking for one site, generate its dedicated Site API Key, and store it only through Relay's encrypted flow.",
      },
    ],
  },
  tools: [
    {
      name: "crazyEgg.recordConversions",
      functionName: "crazy_egg_conversions_record",
      aliases: ["crazyEgg.recordConversions", "crazy_egg_conversions_record"],
      capability: "conversion_record",
      platformCapability: "crazy_egg_conversion_record",
      action: "write",
      approvalRequired: true,
      description:
        "Record a bounded batch of real conversion events through Crazy Egg's fixed site-scoped endpoint.",
      inputSchema: {
        type: "object",
        required: ["goalConversions"],
        properties: {
          goalConversions: {
            type: "array",
            minItems: 1,
            maxItems: 25,
            items: {
              type: "object",
              required: ["goalName", "userIdentifier"],
              properties: {
                goalName: { type: "string", minLength: 1, maxLength: 128 },
                userIdentifier: {
                  type: "string",
                  minLength: 1,
                  maxLength: 256,
                },
                url: { type: "string", maxLength: 2048 },
                value: { type: "number" },
                currency: { type: "string", pattern: "^[A-Z]{3}$" },
                visitCount: { type: "integer", minimum: 0, maximum: 1000000 },
                landingPage: { type: "string", maxLength: 2048 },
                referrer: { type: "string", maxLength: 2048 },
                country: { type: "string", pattern: "^[A-Z]{2}$" },
                userAgent: { type: "string", maxLength: 512 },
                utmParams: { type: "object", maxProperties: 5 },
                customData: { type: "object", maxProperties: 5 },
                timestamp: { type: "string", maxLength: 64 },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "crazy_egg_conversion_safe",
      label: "Safe",
      description:
        "Every bounded conversion write requires approval; reads, broader mutations, synthetic conversions, and raw access remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Bounded conversion writes run without Relay per-action approval; exact site-key authority, schema and payload bounds, audits, no retries, and the prohibition on fabricated events remain enforced.",
      defaultSelected: false,
      allowedActions: writes,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "site_api_key_shape_only",
      label: "Non-mutating local key-presence check",
    },
  ],
};
