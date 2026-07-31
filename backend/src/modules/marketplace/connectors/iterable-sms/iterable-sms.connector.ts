import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  ITERABLE_SMS_MANAGE_OPERATION_IDS,
  ITERABLE_SMS_OPERATIONS,
  ITERABLE_SMS_SAFE_READ_OPERATION_IDS,
  ITERABLE_SMS_SENSITIVE_READ_OPERATION_IDS,
} from "./iterable-sms-operation-registry";

const readiness = action(
  "iterable_sms_readiness",
  "Read Iterable SMS readiness",
  "Read channels, message types, and SMS templates from the exact project and data center.",
);
const sensitive = action(
  "iterable_sms_history",
  "Read Iterable SMS history",
  "Read a bounded SMS-only sent-message history with approval.",
);
const manage = action(
  "iterable_sms_manage",
  "Manage Iterable SMS",
  "Update a consented phone/subscription, trigger double opt-in, send or cancel SMS/proofs, and verify phone numbers with approval.",
);
const blocks = [
  blocked(
    "iterable_sms_secret_exposure",
    "Expose credentials",
    "API keys, JWTs, verification codes in results, authorization headers, and secrets never enter agent-visible credential fields or logs.",
  ),
  blocked(
    "iterable_sms_unattested_consent",
    "Act without consent attestation",
    "Phone collection, subscription changes, double opt-in, SMS/proof sends, and verification starts require explicit recorded consent attestation.",
  ),
  blocked(
    "iterable_sms_broader_api",
    "Use broader Iterable APIs",
    "Non-SMS templates/messages, campaigns, exports, bulk operations, arbitrary paths/origins/headers, and destructive administration are blocked.",
  ),
  blocked(
    "iterable_sms_provider_setup",
    "Provision SMS infrastructure",
    "SMS providers, senders, channels, message types, verification profiles, carrier registration, and compliance settings require provider-side setup outside Relay.",
  ),
];

export const ITERABLE_SMS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "iterable-sms",
  name: "Iterable SMS",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://support.iterable.com/hc/en-us/articles/17712346382100-Setting-up-SMS",
  providerWebsiteUrl: "https://iterable.com/products/mobile/sms/",
  capabilities: [
    {
      ...capability(
        "readiness",
        "Read SMS readiness",
        "Use four bounded SMS channel, message-type, and template reads.",
        true,
      ),
      platformCapability: "iterable_sms_readiness",
    },
    {
      ...capability(
        "history",
        "Read SMS history",
        "Use one bounded SMS-only sent-message read with approval.",
        false,
      ),
      platformCapability: "iterable_sms_history",
    },
    {
      ...capability(
        "manage",
        "Manage SMS engagement",
        "Use eight consent, send/cancel, proof, and verification operations with approval.",
        false,
      ),
      platformCapability: "iterable_sms_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ITERABLE_SMS_SERVER_API_KEY",
        label: "Iterable SMS server-side API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Use a dedicated server-side key for the exact SMS-enabled project.",
      },
      {
        name: "ITERABLE_SMS_REGION",
        label: "Iterable SMS data center",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Set to us for USDC or eu for EDC; Relay maps this enum to a fixed origin.",
      },
    ],
  },
  tools: [
    tool(
      "iterableSms.read",
      "iterable_sms_read",
      "readiness",
      "iterable_sms_readiness",
      "read",
      false,
      ITERABLE_SMS_SAFE_READ_OPERATION_IDS,
    ),
    tool(
      "iterableSms.readSensitive",
      "iterable_sms_read_sensitive",
      "history",
      "iterable_sms_history",
      "read",
      true,
      ITERABLE_SMS_SENSITIVE_READ_OPERATION_IDS,
    ),
    tool(
      "iterableSms.manage",
      "iterable_sms_manage",
      "manage",
      "iterable_sms_manage",
      "write",
      true,
      ITERABLE_SMS_MANAGE_OPERATION_IDS,
    ),
  ],
  approvalProfiles: [
    {
      id: "iterable_sms_safe",
      label: "Safe",
      description:
        "Four readiness reads run directly; SMS history and all eight consent/send/verification mutations require approval.",
      defaultSelected: true,
      allowedActions: [readiness],
      approvalRequiredActions: [sensitive, manage],
      blockedActions: blocks,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${ITERABLE_SMS_OPERATIONS.length} selected operations run without Relay per-action approval; consent attestation, fixed SMS routes/filters, bounds, audits, and secret/provider-setup blocks remain enforced.`,
      defaultSelected: false,
      allowedActions: [readiness, sensitive, manage],
      approvalRequiredActions: [],
      blockedActions: blocks,
    },
  ],
  healthChecks: [
    {
      id: "channels",
      label:
        "Iterable SMS API key, project/data-center binding, and channel visibility",
    },
  ],
};

function tool(
  name: string,
  functionName: string,
  capabilityId: string,
  platformCapability: string,
  actionType: "read" | "write",
  approvalRequired: boolean,
  operations: string[],
) {
  return {
    name,
    functionName,
    aliases: [name, functionName],
    capability: capabilityId,
    platformCapability,
    action: actionType,
    approvalRequired,
    description:
      "Run one pinned Iterable SMS operation with bounded input and output.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: operations },
        query: { type: "object", maxProperties: 7 },
        body: { type: "object", maxProperties: 50 },
        consentAttestation: { type: "boolean" },
        approvalId: { type: "string", maxLength: 200 },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  };
}
