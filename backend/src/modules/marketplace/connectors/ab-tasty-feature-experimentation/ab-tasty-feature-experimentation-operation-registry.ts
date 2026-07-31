export const AB_TASTY_FEATURE_EXPERIMENTATION_OPERATIONS = [
  {
    id: "list_campaigns",
    path: "/v1/accounts/{accountId}/account_environments/{accountEnvironmentId}/campaigns",
    collection: true,
  },
  {
    id: "get_campaign",
    path: "/v1/accounts/{accountId}/account_environments/{accountEnvironmentId}/campaigns/{resourceId}",
    collection: false,
  },
];
export type AbTastyFeatureExperimentationOperation =
  (typeof AB_TASTY_FEATURE_EXPERIMENTATION_OPERATIONS)[number];
export const AB_TASTY_FEATURE_EXPERIMENTATION_OPERATION_BY_ID = new Map(
  AB_TASTY_FEATURE_EXPERIMENTATION_OPERATIONS.map((operation) => [
    operation.id,
    operation,
  ]),
);
export const AB_TASTY_FEATURE_EXPERIMENTATION_OPERATION_IDS =
  AB_TASTY_FEATURE_EXPERIMENTATION_OPERATIONS.map((operation) => operation.id);
