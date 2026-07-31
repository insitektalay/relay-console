export type BloomreachEngagementOperation = {
  id: string;
  method: "GET" | "POST";
  path: string;
  policy: "structural_read" | "sensitive_read" | "manage";
};
export const BLOOMREACH_ENGAGEMENT_OPERATIONS: BloomreachEngagementOperation[] =
  [
    {
      id: "list_catalogs",
      method: "GET",
      path: "/data/v2/projects/{projectToken}/catalogs",
      policy: "structural_read",
    },
    {
      id: "get_catalog",
      method: "GET",
      path: "/data/v2/projects/{projectToken}/catalogs/{catalogId}",
      policy: "structural_read",
    },
    {
      id: "get_customer_attributes",
      method: "POST",
      path: "/data/v2/projects/{projectToken}/customers/attributes",
      policy: "sensitive_read",
    },
    {
      id: "update_customer_properties",
      method: "POST",
      path: "/track/v2/projects/{projectToken}/customers",
      policy: "manage",
    },
  ];
export const BLOOMREACH_ENGAGEMENT_OPERATION_BY_ID = new Map(
  BLOOMREACH_ENGAGEMENT_OPERATIONS.map((operation) => [
    operation.id,
    operation,
  ]),
);
export const BLOOMREACH_ENGAGEMENT_STRUCTURAL_READ_OPERATION_IDS =
  BLOOMREACH_ENGAGEMENT_OPERATIONS.filter(
    (operation) => operation.policy === "structural_read",
  ).map((operation) => operation.id);
export const BLOOMREACH_ENGAGEMENT_SENSITIVE_READ_OPERATION_IDS =
  BLOOMREACH_ENGAGEMENT_OPERATIONS.filter(
    (operation) => operation.policy === "sensitive_read",
  ).map((operation) => operation.id);
export const BLOOMREACH_ENGAGEMENT_MANAGE_OPERATION_IDS =
  BLOOMREACH_ENGAGEMENT_OPERATIONS.filter(
    (operation) => operation.policy === "manage",
  ).map((operation) => operation.id);
