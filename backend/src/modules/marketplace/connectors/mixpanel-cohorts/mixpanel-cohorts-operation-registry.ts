export const MIXPANEL_COHORTS_OPERATIONS = [
  {
    id: "list_saved_cohorts",
    method: "POST" as const,
    path: "/api/query/cohorts/list",
  },
];

export const MIXPANEL_COHORTS_OPERATION_BY_ID = new Map(
  MIXPANEL_COHORTS_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const MIXPANEL_COHORTS_OPERATION_IDS = MIXPANEL_COHORTS_OPERATIONS.map(
  (operation) => operation.id,
);
