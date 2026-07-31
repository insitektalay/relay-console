export type SalesforceDataCloudOperation = {
  id: string;
  method: "GET" | "POST";
  path: string;
  policy: "structural_read" | "sensitive_read";
};

export const SALESFORCE_DATA_CLOUD_OPERATIONS: SalesforceDataCloudOperation[] =
  [
    {
      id: "get_query_metadata",
      method: "GET",
      path: "/api/v3/query/{queryId}/metadata",
      policy: "structural_read",
    },
    {
      id: "submit_bounded_query",
      method: "POST",
      path: "/api/v3/query",
      policy: "sensitive_read",
    },
    {
      id: "get_query_status",
      method: "GET",
      path: "/api/v3/query/{queryId}",
      policy: "sensitive_read",
    },
    {
      id: "get_query_rows",
      method: "GET",
      path: "/api/v3/query/{queryId}/rows",
      policy: "sensitive_read",
    },
  ];

export const SALESFORCE_DATA_CLOUD_OPERATION_BY_ID = new Map(
  SALESFORCE_DATA_CLOUD_OPERATIONS.map((operation) => [
    operation.id,
    operation,
  ]),
);
export const SALESFORCE_DATA_CLOUD_STRUCTURAL_READ_OPERATION_IDS =
  SALESFORCE_DATA_CLOUD_OPERATIONS.filter(
    (operation) => operation.policy === "structural_read",
  ).map((operation) => operation.id);
export const SALESFORCE_DATA_CLOUD_SENSITIVE_READ_OPERATION_IDS =
  SALESFORCE_DATA_CLOUD_OPERATIONS.filter(
    (operation) => operation.policy === "sensitive_read",
  ).map((operation) => operation.id);
