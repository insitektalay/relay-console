export type MoEngageOperation = {
  id: string;
  method: "POST";
  path: string;
  policy: "sensitive_read" | "manage";
};
export const MOENGAGE_OPERATIONS: MoEngageOperation[] = [
  {
    id: "get_user",
    method: "POST",
    path: "/v1/customers/export",
    policy: "sensitive_read",
  },
  {
    id: "update_user",
    method: "POST",
    path: "/v1/customer/{workspaceId}",
    policy: "manage",
  },
];
export const MOENGAGE_OPERATION_BY_ID = new Map(
  MOENGAGE_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const MOENGAGE_SENSITIVE_READ_OPERATION_IDS = MOENGAGE_OPERATIONS.filter(
  (operation) => operation.policy === "sensitive_read",
).map((operation) => operation.id);
export const MOENGAGE_MANAGE_OPERATION_IDS = MOENGAGE_OPERATIONS.filter(
  (operation) => operation.policy === "manage",
).map((operation) => operation.id);
