export type SailthruOperation = {
  id: string;
  method: "GET" | "POST";
  endpoint: "list" | "user" | "template";
  policy: "structural_read" | "sensitive_read" | "manage";
};

export const SAILTHRU_OPERATIONS: SailthruOperation[] = [
  {
    id: "get_list",
    method: "GET",
    endpoint: "list",
    policy: "structural_read",
  },
  { id: "get_user", method: "GET", endpoint: "user", policy: "sensitive_read" },
  {
    id: "get_template",
    method: "GET",
    endpoint: "template",
    policy: "sensitive_read",
  },
  {
    id: "set_list_membership",
    method: "POST",
    endpoint: "user",
    policy: "manage",
  },
  {
    id: "set_email_optout",
    method: "POST",
    endpoint: "user",
    policy: "manage",
  },
];

export const SAILTHRU_OPERATION_BY_ID = new Map(
  SAILTHRU_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const SAILTHRU_STRUCTURAL_READ_OPERATION_IDS =
  SAILTHRU_OPERATIONS.filter(
    (operation) => operation.policy === "structural_read",
  ).map((operation) => operation.id);
export const SAILTHRU_SENSITIVE_READ_OPERATION_IDS = SAILTHRU_OPERATIONS.filter(
  (operation) => operation.policy === "sensitive_read",
).map((operation) => operation.id);
export const SAILTHRU_MANAGE_OPERATION_IDS = SAILTHRU_OPERATIONS.filter(
  (operation) => operation.policy === "manage",
).map((operation) => operation.id);
