export type MessageGearsOperation = {
  id: string;
  action: string;
  policy: "structural_read" | "sensitive_read" | "manage";
  parameters: string[];
};

export const MESSAGEGEARS_OPERATIONS: MessageGearsOperation[] = [
  {
    id: "get_account_summary",
    action: "AccountSummary",
    policy: "structural_read",
    parameters: ["ActivityDate"],
  },
  {
    id: "get_bulk_job_summary",
    action: "BulkJobSummary",
    policy: "sensitive_read",
    parameters: ["BulkJobRequestId", "BulkJobCorrelationId"],
  },
  {
    id: "preview_message",
    action: "MessagePreview",
    policy: "sensitive_read",
    parameters: [
      "FromName",
      "FromAddress",
      "ReplyToAddress",
      "SubjectLine",
      "RecipientXml",
      "ContextDataXml",
      "HtmlTemplate",
      "TextTemplate",
      "TemplateLanguage",
    ],
  },
  {
    id: "send_transactional_job",
    action: "TransactionalJobSubmit",
    policy: "manage",
    parameters: [
      "FromName",
      "FromAddress",
      "ReplyToAddress",
      "SubjectLine",
      "RecipientXml",
      "HtmlTemplate",
      "TextTemplate",
      "TemplateLanguage",
      "CorrelationId",
      "UnsubscribeHeader",
    ],
  },
  {
    id: "send_transactional_campaign",
    action: "TransactionalCampaignSubmit",
    policy: "manage",
    parameters: [
      "CampaignId",
      "RecipientXml",
      "ContextDataXml",
      "CorrelationId",
    ],
  },
];

export const MESSAGEGEARS_OPERATION_BY_ID = new Map(
  MESSAGEGEARS_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const MESSAGEGEARS_STRUCTURAL_READ_OPERATION_IDS =
  MESSAGEGEARS_OPERATIONS.filter(
    (operation) => operation.policy === "structural_read",
  ).map((operation) => operation.id);
export const MESSAGEGEARS_SENSITIVE_READ_OPERATION_IDS =
  MESSAGEGEARS_OPERATIONS.filter(
    (operation) => operation.policy === "sensitive_read",
  ).map((operation) => operation.id);
export const MESSAGEGEARS_MANAGE_OPERATION_IDS = MESSAGEGEARS_OPERATIONS.filter(
  (operation) => operation.policy === "manage",
).map((operation) => operation.id);
