export type AdobeRealTimeCdpOperation = {
  id: string;
  path: string;
  policy: "structural_read" | "sensitive_read";
};

export const ADOBE_REAL_TIME_CDP_OPERATIONS: AdobeRealTimeCdpOperation[] = [
  {
    id: "list_datasets",
    path: "/data/foundation/catalog/dataSets",
    policy: "structural_read",
  },
  {
    id: "list_audience_definitions",
    path: "/data/core/ups/segment/definitions",
    policy: "sensitive_read",
  },
  {
    id: "get_profile",
    path: "/data/core/ups/access/entities",
    policy: "sensitive_read",
  },
];

export const ADOBE_REAL_TIME_CDP_OPERATION_BY_ID = new Map(
  ADOBE_REAL_TIME_CDP_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const ADOBE_REAL_TIME_CDP_STRUCTURAL_READ_OPERATION_IDS =
  ADOBE_REAL_TIME_CDP_OPERATIONS.filter(
    (operation) => operation.policy === "structural_read",
  ).map((operation) => operation.id);
export const ADOBE_REAL_TIME_CDP_SENSITIVE_READ_OPERATION_IDS =
  ADOBE_REAL_TIME_CDP_OPERATIONS.filter(
    (operation) => operation.policy === "sensitive_read",
  ).map((operation) => operation.id);
