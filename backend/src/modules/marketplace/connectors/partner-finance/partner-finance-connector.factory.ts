import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

type Field = MarketplaceConnectorManifest["auth"]["credentialSchema"][number];

export function partnerFinanceConnector(input: {
  slug: string;
  name: string;
  functionPrefix: string;
  docsUrl: string;
  websiteUrl: string;
  credentialSchema: Field[];
  readDescription: string;
  fullDescription: string;
}): MarketplaceConnectorManifest {
  const actionPrefix = input.slug.replace(/-/g, "_");
  const read = action(
    `${actionPrefix}_read`,
    `Read ${input.name} data`,
    input.readDescription,
  );
  const full = action(
    `${actionPrefix}_full_api`,
    `Use full ${input.name} API`,
    input.fullDescription,
  );
  const guards = [
    action(
      `${actionPrefix}_secret_exposure`,
      "Expose credentials",
      "Customer credentials and provider tokens never enter agent-visible requests or results.",
    ),
    action(
      `${actionPrefix}_other_origin`,
      "Use another origin",
      "Requests stay on the provider's allowlisted official API environment.",
    ),
    action(
      `${actionPrefix}_unbounded_transfer`,
      "Run an unbounded transfer",
      "Relay bounds query fields, bodies, results, redirects, and execution time.",
    ),
  ];
  const query = {
    type: "object",
    additionalProperties: {
      oneOf: [
        { type: "string" },
        { type: "number" },
        { type: "boolean" },
        { type: "array", items: { type: "string" }, maxItems: 100 },
      ],
    },
  };
  return {
    slug: input.slug,
    name: input.name,
    connectorType: "native_clawchat",
    providerDocsUrl: input.docsUrl,
    providerWebsiteUrl: input.websiteUrl,
    capabilities: [
      {
        ...capability(
          "financial_data_read",
          "Read financial data",
          input.readDescription,
          true,
        ),
        platformCapability: `${actionPrefix}_read`,
      },
      {
        ...capability(
          "full_api",
          `Full ${input.name} API`,
          input.fullDescription,
          true,
        ),
        platformCapability: `${actionPrefix}_full_api`,
      },
    ],
    auth: { type: "api_key", credentialSchema: input.credentialSchema },
    tools: [
      {
        name: `${input.functionPrefix}.read`,
        functionName: `${actionPrefix}_read`,
        aliases: [`${input.slug}.read`],
        capability: "financial_data_read",
        platformCapability: `${actionPrefix}_read`,
        action: "read",
        approvalRequired: false,
        description: input.readDescription,
        inputSchema: {
          type: "object",
          properties: {
            method: { type: "string", enum: ["GET", "POST"] },
            path: { type: "string", minLength: 1, maxLength: 2000 },
            query,
            json: { type: "object" },
          },
          required: ["path"],
          additionalProperties: false,
        },
      },
      {
        name: `${input.functionPrefix}.manage`,
        functionName: `${actionPrefix}_manage`,
        aliases: [`${input.slug}.manage`],
        capability: "full_api",
        platformCapability: `${actionPrefix}_full_api`,
        action: "write",
        approvalRequired: true,
        description: input.fullDescription,
        inputSchema: {
          type: "object",
          properties: {
            method: {
              type: "string",
              enum: ["POST", "PUT", "PATCH", "DELETE"],
            },
            path: { type: "string", minLength: 1, maxLength: 2000 },
            query,
            json: { type: "object" },
            approvalId: { type: "string", maxLength: 200 },
          },
          required: ["method", "path"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: `${actionPrefix}_safe`,
        label: "Safe",
        description:
          "Bounded reads run directly; mutations and administrative operations require approval.",
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [full],
        blockedActions: guards,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description: `Every selected ${input.name} operation runs without Relay per-action approval; provider authorization, account binding, limits, secret isolation, request bounds, and audits still apply.`,
        defaultSelected: false,
        allowedActions: [read, full],
        approvalRequiredActions: [],
        blockedActions: guards,
      },
    ],
    healthChecks: [
      {
        id: "provider",
        label: `Validate the customer-owned ${input.name} credentials with a bounded provider request`,
      },
    ],
  };
}
