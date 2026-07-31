export type OrttoOperation = {
  id: string;
  method: "POST" | "PUT";
  path: string;
  policy: "structural_read" | "sensitive_read" | "manage";
  body: "required" | "optional" | "none";
};

export const ORTTO_OPERATIONS: OrttoOperation[] = [
  {
    id: "get_instance_schema",
    method: "POST",
    path: "/v1/instance-schema/get",
    policy: "structural_read",
    body: "optional",
  },
  {
    id: "list_audiences",
    method: "POST",
    path: "/v1/audiences/get",
    policy: "structural_read",
    body: "optional",
  },
  {
    id: "list_person_custom_fields",
    method: "POST",
    path: "/v1/person/custom-field/get",
    policy: "structural_read",
    body: "none",
  },
  {
    id: "list_account_custom_fields",
    method: "POST",
    path: "/v1/accounts/custom-field/get",
    policy: "structural_read",
    body: "none",
  },
  {
    id: "list_tags",
    method: "POST",
    path: "/v1/tags/get",
    policy: "structural_read",
    body: "optional",
  },
  {
    id: "list_sent_campaigns",
    method: "POST",
    path: "/v1/campaign/calendar",
    policy: "structural_read",
    body: "required",
  },
  {
    id: "list_reports",
    method: "POST",
    path: "/v1/reports/list",
    policy: "structural_read",
    body: "optional",
  },
  {
    id: "get_people",
    method: "POST",
    path: "/v1/person/get",
    policy: "sensitive_read",
    body: "optional",
  },
  {
    id: "get_subscriptions",
    method: "POST",
    path: "/v1/person/subscriptions",
    policy: "sensitive_read",
    body: "required",
  },
  {
    id: "get_accounts",
    method: "POST",
    path: "/v1/accounts/get",
    policy: "sensitive_read",
    body: "optional",
  },
  {
    id: "get_campaign_report",
    method: "POST",
    path: "/v1/campaign/reports/get",
    policy: "sensitive_read",
    body: "required",
  },
  {
    id: "get_report",
    method: "POST",
    path: "/v1/reports/get",
    policy: "sensitive_read",
    body: "required",
  },
  {
    id: "merge_people",
    method: "POST",
    path: "/v1/person/merge",
    policy: "manage",
    body: "required",
  },
  {
    id: "merge_accounts",
    method: "POST",
    path: "/v1/accounts/merge",
    policy: "manage",
    body: "required",
  },
  {
    id: "update_audience_subscription",
    method: "PUT",
    path: "/v1/audience/subscribe",
    policy: "manage",
    body: "required",
  },
  {
    id: "create_person_activities",
    method: "POST",
    path: "/v1/activities/create",
    policy: "manage",
    body: "required",
  },
  {
    id: "create_account_activities",
    method: "POST",
    path: "/v1/accounts/activities/create",
    policy: "manage",
    body: "required",
  },
  {
    id: "send_transactional_email",
    method: "POST",
    path: "/v1/transactional/send",
    policy: "manage",
    body: "required",
  },
  {
    id: "send_transactional_push",
    method: "POST",
    path: "/v1/transactional/send-push",
    policy: "manage",
    body: "required",
  },
];

export const ORTTO_OPERATION_BY_ID = new Map(
  ORTTO_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const ORTTO_STRUCTURAL_READ_OPERATION_IDS = ORTTO_OPERATIONS.filter(
  (operation) => operation.policy === "structural_read",
).map((operation) => operation.id);
export const ORTTO_SENSITIVE_READ_OPERATION_IDS = ORTTO_OPERATIONS.filter(
  (operation) => operation.policy === "sensitive_read",
).map((operation) => operation.id);
export const ORTTO_MANAGE_OPERATION_IDS = ORTTO_OPERATIONS.filter(
  (operation) => operation.policy === "manage",
).map((operation) => operation.id);
