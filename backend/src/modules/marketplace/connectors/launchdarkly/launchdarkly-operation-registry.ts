export const LAUNCHDARKLY_OPERATIONS = [
  {
    id: "list_feature_flags",
    path: "/api/v2/flags/{projectKey}",
    collection: true,
  },
  {
    id: "get_feature_flag",
    path: "/api/v2/flags/{projectKey}/{resourceId}",
    collection: false,
  },
];

export type LaunchDarklyOperation = (typeof LAUNCHDARKLY_OPERATIONS)[number];
export const LAUNCHDARKLY_OPERATION_BY_ID = new Map(
  LAUNCHDARKLY_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const LAUNCHDARKLY_OPERATION_IDS = LAUNCHDARKLY_OPERATIONS.map(
  (operation) => operation.id,
);
