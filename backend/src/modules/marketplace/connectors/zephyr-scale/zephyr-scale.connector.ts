import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action("zephyr_scale_test_case_list", "List test cases", "List at most twenty-five Zephyr Scale test cases in the bound Jira project."),
  action("zephyr_scale_test_case_get", "Read a test case", "Read one exact Zephyr Scale test case in the bound Jira project."),
  action("zephyr_scale_test_cycle_list", "List test cycles", "List at most twenty-five Zephyr Scale test cycles in the bound Jira project."),
];
const fullApi = [action("zephyr_scale_full_api", "Use full Zephyr Scale API", "Use a documented Zephyr Scale Cloud API v2 operation authorized by the access key; Safe mode requires approval.")];

export const ZEPHYR_SCALE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "zephyr-scale",
  name: "Zephyr Scale",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://support.smartbear.com/zephyr-scale-cloud/api-docs/",
  providerWebsiteUrl: "https://smartbear.com/product/zephyr/",
  capabilities: [
    { ...capability("test_management_read", "Read test management data", "Read bounded test cases and test cycles from one exact Jira project.", true), platformCapability: "zephyr_scale_read" },
    { ...capability("full_api", "Full Zephyr Scale API", "Use the documented Cloud API v2 surface allowed by the access key and Jira permissions.", true), platformCapability: "zephyr_scale_full_api" },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      { name: "ZEPHYR_SCALE_API_TOKEN", label: "Zephyr Scale API access token", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Generate an API access key from Zephyr API keys. Relay encrypts it and sends it only to the selected SmartBear regional API origin." },
      { name: "ZEPHYR_SCALE_REGION", label: "Zephyr Scale data region", required: true, secret: false, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Enter US, EU, AU or DE to select the documented regional Cloud API origin." },
      { name: "ZEPHYR_SCALE_PROJECT_KEY", label: "Jira project key", required: true, secret: false, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Enter one exact Jira project key, such as RELAY, to bind bounded reads to one project." },
    ],
  },
  tools: [
    { name: "zephyrScale.listTestCases", functionName: "zephyr_scale_test_case_list", aliases: ["zephyrScale.listTestCases", "zephyr_scale_test_case_list"], capability: "test_management_read", platformCapability: "zephyr_scale_read", action: "read", approvalRequired: false, description: "List at most twenty-five test cases in the bound Jira project.", inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 25 } }, additionalProperties: false } },
    { name: "zephyrScale.getTestCase", functionName: "zephyr_scale_test_case_get", aliases: ["zephyrScale.getTestCase", "zephyr_scale_test_case_get"], capability: "test_management_read", platformCapability: "zephyr_scale_read", action: "read", approvalRequired: false, description: "Read one exact test case key in the bound Jira project.", inputSchema: { type: "object", properties: { testCaseKey: { type: "string", pattern: "^[A-Z][A-Z0-9_]*-T[1-9][0-9]*$" } }, required: ["testCaseKey"], additionalProperties: false } },
    { name: "zephyrScale.listTestCycles", functionName: "zephyr_scale_test_cycle_list", aliases: ["zephyrScale.listTestCycles", "zephyr_scale_test_cycle_list"], capability: "test_management_read", platformCapability: "zephyr_scale_read", action: "read", approvalRequired: false, description: "List at most twenty-five test cycles in the bound Jira project.", inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 25 } }, additionalProperties: false } },
    { name: "zephyrScale.request", functionName: "zephyr_scale_request", aliases: ["zephyrScale.request", "zephyr_scale_request", "zephyr_scale_full_api"], capability: "full_api", platformCapability: "zephyr_scale_full_api", action: "admin", approvalRequired: true, description: "Call a documented Zephyr Scale Cloud API v2 method and relative path on the bound regional origin; credential routes are excluded.", inputSchema: { type: "object", properties: { method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] }, path: { type: "string", pattern: "^/" }, query: { type: "object", maxProperties: 50 }, json: { type: "object", maxProperties: 500 }, approvalId: { type: "string", maxLength: 200 } }, required: ["method", "path"], additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "zephyr_scale_safe", label: "Safe", description: "Bounded test-case and test-cycle reads run directly; every other Zephyr Scale operation requires approval.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: fullApi, blockedActions: [] },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "Every selected access-key-authorized Zephyr Scale operation runs without Relay per-action approval; project and region binding, provider permissions, fixed routing, bounds, redaction and audits still apply.", defaultSelected: false, allowedActions: [...reads, ...fullApi], approvalRequiredActions: [], blockedActions: [] },
  ],
  healthChecks: [{ id: "project", label: "Zephyr Scale token, region and Jira-project access" }],
};
