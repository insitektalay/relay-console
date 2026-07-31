import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "xray_test_management_tests_list",
    "List tests",
    "List at most twenty fixed-field tests from one exact Jira project.",
  ),
  action(
    "xray_test_management_test_get",
    "Read test",
    "Read bounded metadata for one exact numeric Test issue ID.",
  ),
  action(
    "xray_test_management_executions_list",
    "List test executions",
    "List at most twenty fixed-field Test Executions from one exact Jira project.",
  ),
  action(
    "xray_test_management_run_get",
    "Read test run",
    "Read one exact Test Run identified by its Test and Test Execution issue IDs.",
  ),
];
const writes = [
  action(
    "xray_test_management_run_status_update",
    "Update test-run status",
    "Update the status of one exact project-bound Test Run.",
  ),
];
const allActions = [...reads, ...writes];
const blockedActions = [
  blocked(
    "xray_test_management_create_delete",
    "Create or delete test entities",
    "Tests, Preconditions, Plans, Executions, Sets and their associations cannot be created, copied, imported, reset or deleted.",
  ),
  blocked(
    "xray_test_management_run_details",
    "Change detailed run evidence",
    "Comments, timers, assignees, executors, steps, examples, iterations, parameters, defects, evidence and attachments are unavailable.",
  ),
  blocked(
    "xray_test_management_jira",
    "Access broader Jira data",
    "Jira fields, JQL, issue keys, users, comments, attachments, projects and non-Xray issue APIs are unavailable.",
  ),
  blocked(
    "xray_test_management_raw_graphql",
    "Run arbitrary Xray queries",
    "Agents cannot submit GraphQL, choose fields, filters, JQL, offsets, project IDs, endpoints or arbitrary variables.",
  ),
  blocked(
    "xray_test_management_import_export",
    "Import or export results",
    "JUnit, Cucumber, Xray JSON, Robot, NUnit and other imports, exports, backups and bulk operations are unavailable.",
  ),
  blocked(
    "xray_test_management_unbounded",
    "Read unbounded test data",
    "Twenty-row lists, one exact resource, fixed low-resolver documents and 256 KiB responses are the maximum supported surface.",
  ),
];
const issueIdProperty = {
  type: "string",
  pattern: "^[0-9]{1,30}$",
  maxLength: 30,
};

export const XRAY_TEST_MANAGEMENT_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "xray-test-management",
    name: "Xray Test Management",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://getxraydocs.atlassian.net/wiki/spaces/XRAYCLOUD/pages/44577089/Authentication+-+REST+v2",
    providerWebsiteUrl: "https://www.getxray.app/",
    capabilities: [
      {
        ...capability(
          "tests_read",
          "Read tests",
          "List bounded Test metadata and inspect one exact Test inside one configured Jira project.",
          true,
        ),
        platformCapability: "xray_test_management_tests_read",
      },
      {
        ...capability(
          "execution_read",
          "Read executions and runs",
          "List bounded Test Executions and inspect one exact Test Run without Jira fields or test content.",
          true,
        ),
        platformCapability: "xray_test_management_execution_read",
      },
      {
        ...capability(
          "run_status_write",
          "Update run status",
          "Update only the status of an exact project-bound Test Run.",
          false,
        ),
        platformCapability: "xray_test_management_run_status_write",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "XRAY_TEST_MANAGEMENT_CLIENT_ID",
          label: "Xray client ID",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "The Client ID from a dedicated user-linked Xray Cloud API key.",
        },
        {
          name: "XRAY_TEST_MANAGEMENT_CLIENT_SECRET",
          label: "Xray client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "The matching Client Secret. Railway sends it only to Xray's fixed authentication endpoint and never logs the returned token.",
        },
        {
          name: "XRAY_TEST_MANAGEMENT_PROJECT_ID",
          label: "Jira project ID",
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["api_key"],
          helpText:
            "The exact numeric Jira project ID that bounds every supported Xray resource.",
        },
      ],
    },
    tools: [
      {
        name: "xrayTestManagement.listTests",
        functionName: "xray_test_management_tests_list",
        aliases: [
          "xrayTestManagement.listTests",
          "xray_test_management_tests_list",
        ],
        capability: "tests_read",
        platformCapability: "xray_test_management_tests_read",
        action: "read",
        approvalRequired: true,
        description: "List at most twenty fixed-field project Tests.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "xrayTestManagement.getTest",
        functionName: "xray_test_management_test_get",
        aliases: [
          "xrayTestManagement.getTest",
          "xray_test_management_test_get",
        ],
        capability: "tests_read",
        platformCapability: "xray_test_management_tests_read",
        action: "read",
        approvalRequired: true,
        description: "Read bounded metadata for one exact project Test.",
        inputSchema: {
          type: "object",
          required: ["issueId"],
          properties: {
            issueId: issueIdProperty,
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "xrayTestManagement.listTestExecutions",
        functionName: "xray_test_management_executions_list",
        aliases: [
          "xrayTestManagement.listTestExecutions",
          "xray_test_management_executions_list",
        ],
        capability: "execution_read",
        platformCapability: "xray_test_management_execution_read",
        action: "read",
        approvalRequired: true,
        description: "List at most twenty fixed-field project Test Executions.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "xrayTestManagement.getTestRun",
        functionName: "xray_test_management_run_get",
        aliases: [
          "xrayTestManagement.getTestRun",
          "xray_test_management_run_get",
        ],
        capability: "execution_read",
        platformCapability: "xray_test_management_execution_read",
        action: "read",
        approvalRequired: true,
        description: "Read one exact project-bound Test Run.",
        inputSchema: {
          type: "object",
          required: ["testIssueId", "testExecIssueId"],
          properties: {
            testIssueId: issueIdProperty,
            testExecIssueId: issueIdProperty,
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
      {
        name: "xrayTestManagement.updateTestRunStatus",
        functionName: "xray_test_management_run_status_update",
        aliases: [
          "xrayTestManagement.updateTestRunStatus",
          "xray_test_management_run_status_update",
        ],
        capability: "run_status_write",
        platformCapability: "xray_test_management_run_status_write",
        action: "write",
        approvalRequired: true,
        description:
          "Update only the status of one exact project-bound Test Run.",
        inputSchema: {
          type: "object",
          required: ["testIssueId", "testExecIssueId", "status"],
          properties: {
            testIssueId: issueIdProperty,
            testExecIssueId: issueIdProperty,
            status: {
              type: "string",
              pattern: "^[A-Za-z][A-Za-z0-9 _-]{0,39}$",
              maxLength: 40,
            },
            approvalId: { type: "string", maxLength: 200 },
          },
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "xray_test_management_safe",
        label: "Safe",
        description:
          "All private test reads and run-status updates require approval. Exact project binding, fixed low-resolver documents, bounds and audits always apply.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: allActions,
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "All five selected test-management actions run without Relay per-action approval; exact authority, project binding, fixed documents, bounds, redaction and audits still apply.",
        defaultSelected: false,
        allowedActions: allActions,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "xray-cloud-project",
        label: "Xray API key and exact Jira project access",
      },
    ],
  };
