export type IterableSmsOperation = {
  id: string;
  method: "GET" | "POST";
  path: string;
  query?: string[];
  body?: boolean;
  sensitive?: boolean;
  consentAttestation?: boolean;
};

export const ITERABLE_SMS_OPERATIONS: IterableSmsOperation[] = [
  { id: "list_channels", method: "GET", path: "/api/channels" },
  { id: "list_message_types", method: "GET", path: "/api/messageTypes" },
  {
    id: "list_sms_templates",
    method: "GET",
    path: "/api/templates",
    query: ["startDateTime", "endDateTime"],
  },
  {
    id: "get_sms_template",
    method: "GET",
    path: "/api/templates/sms/get",
    query: ["templateId", "locale"],
  },
  {
    id: "get_sms_sent_messages",
    method: "GET",
    path: "/api/users/getSentMessages",
    query: [
      "email",
      "userId",
      "limit",
      "campaignIds",
      "startDateTime",
      "endDateTime",
      "excludeBlastCampaigns",
    ],
    sensitive: true,
  },
  {
    id: "update_sms_user",
    method: "POST",
    path: "/api/users/update",
    body: true,
    consentAttestation: true,
  },
  {
    id: "update_sms_subscriptions",
    method: "POST",
    path: "/api/users/updateSubscriptions",
    body: true,
    consentAttestation: true,
  },
  {
    id: "subscribe_double_opt_in",
    method: "POST",
    path: "/api/subscriptions/subscribeToDoubleOptIn",
    body: true,
    consentAttestation: true,
  },
  {
    id: "send_sms",
    method: "POST",
    path: "/api/sms/target",
    body: true,
    consentAttestation: true,
  },
  { id: "cancel_sms", method: "POST", path: "/api/sms/cancel", body: true },
  {
    id: "send_sms_template_proof",
    method: "POST",
    path: "/api/templates/sms/proof",
    body: true,
    consentAttestation: true,
  },
  {
    id: "begin_phone_verification",
    method: "POST",
    path: "/api/verify/sms/begin",
    body: true,
    consentAttestation: true,
  },
  {
    id: "check_phone_verification",
    method: "POST",
    path: "/api/verify/sms/check",
    body: true,
  },
];

export const ITERABLE_SMS_OPERATION_BY_ID = new Map(
  ITERABLE_SMS_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const ITERABLE_SMS_SAFE_READ_OPERATION_IDS =
  ITERABLE_SMS_OPERATIONS.filter(
    (operation) => operation.method === "GET" && !operation.sensitive,
  ).map((operation) => operation.id);
export const ITERABLE_SMS_SENSITIVE_READ_OPERATION_IDS =
  ITERABLE_SMS_OPERATIONS.filter(
    (operation) => operation.method === "GET" && operation.sensitive,
  ).map((operation) => operation.id);
export const ITERABLE_SMS_MANAGE_OPERATION_IDS = ITERABLE_SMS_OPERATIONS.filter(
  (operation) => operation.method === "POST",
).map((operation) => operation.id);
