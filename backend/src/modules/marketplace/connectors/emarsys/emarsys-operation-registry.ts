export type EmarsysOperation = {
  id: string;
  method: "GET" | "POST" | "PUT";
  path: string;
  policy: "structural_read" | "sensitive_read" | "manage";
};

export const EMARSYS_OPERATIONS: EmarsysOperation[] = [
  {
    id: "list_available_fields",
    method: "GET",
    path: "/api/v3/field/translate/en",
    policy: "structural_read",
  },
  {
    id: "list_email_campaign_categories",
    method: "GET",
    path: "/api/v3/emailcategory",
    policy: "structural_read",
  },
  {
    id: "get_email_campaign",
    method: "GET",
    path: "/api/v3/email/{emailId}",
    policy: "sensitive_read",
  },
  {
    id: "get_contact_by_email",
    method: "GET",
    path: "/api/v3/contact/query/",
    policy: "sensitive_read",
  },
  {
    id: "create_contact",
    method: "POST",
    path: "/api/v3/contact",
    policy: "manage",
  },
  {
    id: "update_contact",
    method: "PUT",
    path: "/api/v3/contact",
    policy: "manage",
  },
];

export const EMARSYS_OPERATION_BY_ID = new Map(
  EMARSYS_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const EMARSYS_STRUCTURAL_READ_OPERATION_IDS = EMARSYS_OPERATIONS.filter(
  (operation) => operation.policy === "structural_read",
).map((operation) => operation.id);
export const EMARSYS_SENSITIVE_READ_OPERATION_IDS = EMARSYS_OPERATIONS.filter(
  (operation) => operation.policy === "sensitive_read",
).map((operation) => operation.id);
export const EMARSYS_MANAGE_OPERATION_IDS = EMARSYS_OPERATIONS.filter(
  (operation) => operation.policy === "manage",
).map((operation) => operation.id);
