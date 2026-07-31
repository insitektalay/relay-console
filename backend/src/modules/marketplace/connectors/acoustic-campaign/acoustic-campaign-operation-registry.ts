export type AcousticCampaignOperation = {
  id: string;
  method: "GET" | "PATCH";
  path: string;
  policy: "structural_read" | "sensitive_read" | "manage";
};

export const ACOUSTIC_CAMPAIGN_OPERATIONS: AcousticCampaignOperation[] = [
  {
    id: "get_program",
    method: "GET",
    path: "/rest/programs/{programId}",
    policy: "structural_read",
  },
  {
    id: "get_contact",
    method: "GET",
    path: "/rest/databases/{databaseId}/contacts/{contactId}",
    policy: "sensitive_read",
  },
  {
    id: "update_contact",
    method: "PATCH",
    path: "/rest/databases/{databaseId}/contacts/{contactId}",
    policy: "manage",
  },
];

export const ACOUSTIC_CAMPAIGN_OPERATION_BY_ID = new Map(
  ACOUSTIC_CAMPAIGN_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const ACOUSTIC_CAMPAIGN_STRUCTURAL_READ_OPERATION_IDS =
  ACOUSTIC_CAMPAIGN_OPERATIONS.filter(
    (operation) => operation.policy === "structural_read",
  ).map((operation) => operation.id);
export const ACOUSTIC_CAMPAIGN_SENSITIVE_READ_OPERATION_IDS =
  ACOUSTIC_CAMPAIGN_OPERATIONS.filter(
    (operation) => operation.policy === "sensitive_read",
  ).map((operation) => operation.id);
export const ACOUSTIC_CAMPAIGN_MANAGE_OPERATION_IDS =
  ACOUSTIC_CAMPAIGN_OPERATIONS.filter(
    (operation) => operation.policy === "manage",
  ).map((operation) => operation.id);
