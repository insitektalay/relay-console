export type ActiTimeOperation = {
  id: string;
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  pathParameters: readonly string[];
  bodyAllowed: boolean;
};

const operation = (
  id: string,
  method: ActiTimeOperation["method"],
  path: string,
): ActiTimeOperation => ({
  id,
  method,
  path,
  pathParameters: [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]),
  bodyAllowed: !["GET", "DELETE"].includes(method),
});

export const ACTITIME_SOURCE_SHA256 =
  "8918b46df30a9b8de53fe0325fa86f8aec9a1d1dbe03668e82f5cc93b19b96ca";

export const ACTITIME_OPERATIONS = [
  operation("customers.get", "GET", "/customers/{id}"),
  operation("customers.list", "GET", "/customers"),
  operation("customers.comments", "GET", "/customers/{id}/comments"),
  operation("customers.update", "PATCH", "/customers/{id}"),
  operation("customers.create", "POST", "/customers"),
  operation("customers.delete", "DELETE", "/customers/{id}"),
  operation("projects.get", "GET", "/projects/{id}"),
  operation("projects.list", "GET", "/projects"),
  operation("projects.comments", "GET", "/projects/{id}/comments"),
  operation("projects.update", "PATCH", "/projects/{id}"),
  operation("projects.create", "POST", "/projects"),
  operation("projects.delete", "DELETE", "/projects/{id}"),
  operation("tasks.get", "GET", "/tasks/{id}"),
  operation("tasks.list", "GET", "/tasks"),
  operation("tasks.comments", "GET", "/tasks/{id}/comments"),
  operation("tasks.update", "PATCH", "/tasks/{id}"),
  operation("tasks.create", "POST", "/tasks"),
  operation("tasks.delete", "DELETE", "/tasks/{id}"),
  operation("timetrack.list", "GET", "/timetrack"),
  operation("timetrack.get", "GET", "/timetrack/{userId}/{date}/{taskId}"),
  operation("timetrack.update", "PATCH", "/timetrack/{userId}/{date}/{taskId}"),
  operation(
    "timetrack.adjust",
    "PATCH",
    "/timetrack/{userId}/{date}/{taskId}/time",
  ),
  operation("timetrack.lock", "POST", "/timetrack/lock"),
  operation("timetrack.unlock", "POST", "/timetrack/unlock"),
  operation("leavetime.list", "GET", "/leavetime"),
  operation(
    "leavetime.update",
    "PATCH",
    "/leavetime/{userId}/{date}/{leaveTypeId}",
  ),
  operation(
    "leavetime.adjust",
    "PATCH",
    "/leavetime/{userId}/{date}/{leaveTypeId}/time",
  ),
  operation("users.list", "GET", "/users"),
  operation("users.me", "GET", "/users/me"),
  operation("users.get", "GET", "/users/{uid}"),
  operation("users.schedule", "GET", "/users/{uid}/schedule"),
  operation("users.update", "PATCH", "/users/{uid}"),
  operation("users.create", "POST", "/users"),
  operation("users.invite", "POST", "/users/invitation"),
  operation("departments.get", "GET", "/departments/{id}"),
  operation("departments.list", "GET", "/departments"),
  operation("timeZoneGroups.get", "GET", "/timeZoneGroups/{id}"),
  operation("timeZoneGroups.default", "GET", "/timeZoneGroups/default"),
  operation("timeZoneGroups.list", "GET", "/timeZoneGroups"),
  operation("typesOfWork.get", "GET", "/typesOfWork/{id}"),
  operation("typesOfWork.default", "GET", "/typesOfWork/default"),
  operation("typesOfWork.list", "GET", "/typesOfWork"),
  operation("workflowStatuses.get", "GET", "/workflowStatuses/{id}"),
  operation("workflowStatuses.list", "GET", "/workflowStatuses"),
  operation("workflowStatuses.update", "PATCH", "/workflowStatuses/{id}"),
  operation("workflowStatuses.create", "POST", "/workflowStatuses"),
  operation("workflowStatuses.delete", "DELETE", "/workflowStatuses/{id}"),
  operation("leaveTypes.get", "GET", "/leaveTypes/{id}"),
  operation("leaveTypes.list", "GET", "/leaveTypes"),
  operation("userRates.list", "GET", "/userRates"),
  operation("userRates.get", "GET", "/userRates/{uid}"),
  operation("userRates.replace", "PUT", "/userRates/{uid}"),
  operation("info.get", "GET", "/info"),
  operation("batch.execute", "POST", "/batch"),
  operation("hooks.list", "GET", "/hooks"),
  operation("hooks.create", "POST", "/hooks"),
  operation("hooks.unsubscribe", "POST", "/hooks/unsubscribe"),
  operation("hooks.delete", "DELETE", "/hooks/{id}"),
] as const;

export const ACTITIME_OPERATION_BY_ID = new Map(
  ACTITIME_OPERATIONS.map((item) => [item.id, item]),
);
export const ACTITIME_READ_OPERATION_IDS = ACTITIME_OPERATIONS.filter(
  (item) => item.method === "GET",
).map((item) => item.id);
export const ACTITIME_MANAGE_OPERATION_IDS = ACTITIME_OPERATIONS.filter(
  (item) => item.method !== "GET",
).map((item) => item.id);
