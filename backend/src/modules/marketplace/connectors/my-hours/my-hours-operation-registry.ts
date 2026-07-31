export type MyHoursOperation = {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  pathParameters: readonly string[];
  bodyAllowed: boolean;
  mutating: boolean;
};

const operation = (
  id: string,
  method: MyHoursOperation["method"],
  path: string,
  mutating = method !== "GET",
): MyHoursOperation => ({
  id,
  method,
  path,
  pathParameters: [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]),
  bodyAllowed: !["GET", "DELETE"].includes(method),
  mutating,
});

export const MY_HOURS_SOURCE_SHA256 =
  "c76007b2db50cb69723172f053041bf3f398296ddad5807b845a11d9b6b0e874";

// The official collection contains 36 examples, including the same GET /Tags
// request twice. This registry pins the 35 unique operations.
export const MY_HOURS_OPERATIONS = [
  operation("logs.recent", "GET", "/Logs"),
  operation("logs.addForUser", "POST", "/Admin/addLogOnBehalf"),
  operation("logs.addSelf", "POST", "/Logs/insertlog"),
  operation("logs.startTimer", "POST", "/Logs/startNewLog"),
  operation("logs.stopTimer", "POST", "/Logs/stoptimer"),
  operation("logs.update", "PUT", "/Admin/editLogOnBehalf"),
  operation("logs.delete", "DELETE", "/Logs/{logId}"),
  operation("logs.assignTags", "POST", "/Logs/{logId}/assignTags"),
  operation("logs.unassignTags", "POST", "/Logs/{logId}/unassignTags"),
  operation("tags.list", "GET", "/Tags"),
  operation("projects.listAll", "GET", "/Projects/getAll"),
  operation("projects.listActive", "GET", "/Projects"),
  operation("projects.create", "POST", "/Projects"),
  operation("projects.update", "PUT", "/Projects"),
  operation("projects.archive", "PUT", "/Projects/archive"),
  operation("projects.copy", "GET", "/Projects/{projectId}/copy", true),
  operation("projectTasks.list", "GET", "/Projects/{projectId}/tasklist"),
  operation("projectTasks.create", "POST", "/Projects/{projectId}/task"),
  operation("projectTasks.update", "PUT", "/Projects/{projectId}/task"),
  operation(
    "projectTasks.archive",
    "PUT",
    "/Projects/{projectId}/task/{projectTaskId}/archive",
  ),
  operation("projectUsers.list", "GET", "/Projects/{projectId}/userlist"),
  operation(
    "projectUsers.assign",
    "PUT",
    "/Projects/{projectId}/assignUser/{userId}",
  ),
  operation("projects.get", "GET", "/Projects/{projectId}/overview"),
  operation("reports.activity", "PUT", "/Reports/activitydx", false),
  operation("reports.dashboard", "GET", "/Reports/dashboardOptimized"),
  operation("clients.list", "GET", "/Clients"),
  operation("clients.create", "POST", "/Clients"),
  operation("clients.update", "PUT", "/Clients"),
  operation("tags.create", "POST", "/Tags"),
  operation("users.list", "GET", "/Users/getAll"),
  operation("users.get", "GET", "/Users/{userId}/get"),
  operation("users.create", "POST", "/Users"),
  operation("users.update", "PUT", "/Users"),
  operation("users.archive", "PUT", "/Users/{userId}/archive"),
  operation("teams.members", "GET", "/Teams/{teamId}/teammembers"),
] as const;

export const MY_HOURS_OPERATION_BY_ID = new Map(
  MY_HOURS_OPERATIONS.map((item) => [item.id, item]),
);
export const MY_HOURS_READ_OPERATION_IDS = MY_HOURS_OPERATIONS.filter(
  (item) => !item.mutating,
).map((item) => item.id);
export const MY_HOURS_MANAGE_OPERATION_IDS = MY_HOURS_OPERATIONS.filter(
  (item) => item.mutating,
).map((item) => item.id);
